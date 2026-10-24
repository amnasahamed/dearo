import * as SQLite from "expo-sqlite";
import { parseBackup, serializeBackup, type AppState } from "../domain";
import type { Repository } from "./controller";
let opening: Promise<SQLite.SQLiteDatabase> | undefined;
async function database() {
  if (!opening)
    opening = (async () => {
      const db = await SQLite.openDatabaseAsync("dearo.db");
      await db.execAsync(
        "PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS event_snapshot (id INTEGER PRIMARY KEY CHECK(id = 1), payload TEXT NOT NULL);",
      );
      return db;
    })().catch((error) => {
      opening = undefined;
      throw error;
    });
  return opening;
}
export const repository: Repository = {
  async load() {
    const row = await (
      await database()
    ).getFirstAsync<{ payload: string }>(
      "SELECT payload FROM event_snapshot WHERE id = 1",
    );
    if (!row) return null;
    try {
      return parseBackup(row.payload);
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith("Unsupported backup schema")
      )
        throw error;
      throw new Error(
        "Saved data could not be read. It has not been overwritten. Restore a backup or explicitly clear this event.",
      );
    }
  },
  async save(state: AppState) {
    const payload = serializeBackup(state);
    // One SQLite statement is atomic; errors leave the previous snapshot intact.
    await (
      await database()
    ).runAsync(
      "INSERT INTO event_snapshot(id,payload) VALUES(1,?) ON CONFLICT(id) DO UPDATE SET payload = excluded.payload",
      payload,
    );
  },
  async clear() {
    await (
      await database()
    ).runAsync("DELETE FROM event_snapshot WHERE id = 1");
  },
};
