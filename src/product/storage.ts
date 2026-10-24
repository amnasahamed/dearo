import {
  parseProductPreferences,
  serializeProductPreferences,
  type ProductPreferences,
} from "./preferences";

export interface PreferencesRepository {
  load(): Promise<ProductPreferences>;
  save(preferences: ProductPreferences): Promise<void>;
  clear(): Promise<void>;
}
/** Minimal injectable SQL port: tests never open a native database. */
export interface PreferencesDatabase {
  execAsync(sql: string): Promise<void>;
  getFirstAsync<T>(sql: string): Promise<T | null>;
  runAsync(sql: string, ...params: string[]): Promise<unknown>;
}
const UPSERT =
  "INSERT INTO product_preferences(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload";

/** Separate database, explicit whitelist schema, serialized writes, no event/guest payloads. */
export function createPreferencesRepository(
  open: () => Promise<PreferencesDatabase>,
  now: () => string = () => new Date().toISOString(),
): PreferencesRepository {
  let opening: Promise<PreferencesDatabase> | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  function database() {
    if (!opening)
      opening = (async () => {
        const db = await open();
        await db.execAsync(
          "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS product_preferences (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL);",
        );
        return db;
      })().catch((error) => {
        opening = undefined;
        throw error;
      });
    return opening;
  }
  function serial<T>(operation: () => Promise<T>): Promise<T> {
    const result = queue.then(operation, operation);
    queue = result.catch(() => undefined);
    return result;
  }
  return {
    load() {
      return serial(async () => {
        const db = await database();
        const row = await db.getFirstAsync<{ payload: string }>(
          "SELECT payload FROM product_preferences WHERE id = 1",
        );
        let preferences: ProductPreferences;
        try {
          preferences = parseProductPreferences(row?.payload ?? null, now());
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.startsWith("Unsupported product preferences version")
          )
            throw new Error(
              "These app preferences require a newer Dearo version. Update the app before opening them. They have not been changed.",
            );
          throw new Error(
            "Saved settings could not be read and were not overwritten. Your invitation data is separate. Reset settings explicitly to recover.",
          );
        }
        const payload = serializeProductPreferences(preferences);
        // Persist first use and explicit schema migrations before reporting a loaded state.
        if (!row || row.payload !== payload) await db.runAsync(UPSERT, payload);
        return preferences;
      });
    },
    save(preferences) {
      // Snapshot and validate at invocation so caller mutations cannot change a queued write.
      let payload: string;
      try {
        payload = serializeProductPreferences(preferences);
      } catch (error) {
        return Promise.reject(error);
      }
      return serial(async () => {
        await (await database()).runAsync(UPSERT, payload);
      });
    },
    clear() {
      return serial(async () => {
        await (
          await database()
        ).runAsync("DELETE FROM product_preferences WHERE id = 1");
      });
    },
  };
}
export const preferencesRepository = createPreferencesRepository(async () => {
  const SQLite = await import("expo-sqlite");
  return SQLite.openDatabaseAsync("dearo-preferences.db");
});
