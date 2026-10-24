import test from "node:test";
import assert from "node:assert/strict";
import {
  createPreferencesRepository,
  type PreferencesDatabase,
} from "../src/product/storage";
import {
  createProductPreferences,
  setHapticsEnabled,
} from "../src/product/preferences";
import { requestNativeReview } from "../src/product/review";
const NOW = "2026-10-24T12:00:00.000Z";
function fixture(initial: string | null = null) {
  let payload = initial;
  const calls: string[] = [];
  let fail = false;
  const db: PreferencesDatabase = {
    async execAsync(sql) {
      calls.push(sql);
    },
    async getFirstAsync<T>() {
      return (payload === null ? null : { payload }) as T | null;
    },
    async runAsync(sql, next) {
      calls.push(sql);
      if (fail) throw new Error("disk full");
      payload = sql.startsWith("DELETE") ? null : next;
    },
  };
  return {
    db,
    calls,
    payload: () => payload,
    fail: (value: boolean) => {
      fail = value;
    },
  };
}
test("preferences initialize once and persist first use independently", async () => {
  const f = fixture();
  let now = NOW;
  const repo = createPreferencesRepository(
    async () => f.db,
    () => now,
  );
  const first = await repo.load();
  now = "2026-10-25T12:00:00.000Z";
  assert.equal(
    (await repo.load()).review.firstUsedAt,
    first.review.firstUsedAt,
  );
  assert.ok(f.calls.every((sql) => !sql.includes("event_snapshot")));
  assert.equal(f.calls.filter((sql) => sql.startsWith("INSERT")).length, 1);
});
test("corrupt preferences are not overwritten or silently reset", async () => {
  const f = fixture("{corrupt");
  const repo = createPreferencesRepository(
    async () => f.db,
    () => NOW,
  );
  await assert.rejects(repo.load(), /not overwritten/);
  assert.equal(f.payload(), "{corrupt");
  await repo.clear();
  assert.equal((await repo.load()).schemaVersion, 1);
});
test("preference writes reject guest fields, retain previous payload on failure and recover", async () => {
  const f = fixture();
  const repo = createPreferencesRepository(
    async () => f.db,
    () => NOW,
  );
  const prefs = await repo.load();
  const previous = f.payload();
  await assert.rejects(
    repo.save({ ...prefs, guests: [{ name: "Secret" }] } as typeof prefs),
  );
  assert.equal(f.payload(), previous);
  f.fail(true);
  await assert.rejects(repo.save(setHapticsEnabled(prefs, false)), /disk full/);
  assert.equal(f.payload(), previous);
  f.fail(false);
  await repo.save(setHapticsEnabled(prefs, false));
  assert.equal((await repo.load()).hapticsEnabled, false);
});
test("queued preferences are serialized at invocation time", async () => {
  const f = fixture();
  const repo = createPreferencesRepository(
    async () => f.db,
    () => NOW,
  );
  const prefs = createProductPreferences(NOW);
  const saving = repo.save(prefs);
  prefs.hapticsEnabled = false;
  await saving;
  assert.equal((await repo.load()).hapticsEnabled, true);
});
test("native review checks availability and never claims display or rating", async () => {
  let requests = 0;
  assert.equal(
    await requestNativeReview({
      isAvailableAsync: async () => false,
      requestReview: async () => {
        requests++;
      },
    }),
    "unavailable",
  );
  assert.equal(requests, 0);
  assert.equal(
    await requestNativeReview({
      isAvailableAsync: async () => true,
      requestReview: async () => {
        requests++;
      },
    }),
    "requested",
  );
  assert.equal(requests, 1);
  await assert.rejects(
    requestNativeReview({
      isAvailableAsync: async () => true,
      requestReview: async () => {
        throw new Error("native failure");
      },
    }),
    /native failure/,
  );
});

test("supported legacy preferences migrate without touching invitation data", async () => {
  const f = fixture(
    JSON.stringify({
      schemaVersion: 0,
      onboardingCompleted: true,
      hapticsEnabled: false,
      firstUsedAt: NOW,
    }),
  );
  const repo = createPreferencesRepository(
    async () => f.db,
    () => NOW,
  );
  assert.equal((await repo.load()).onboarding.completedVersion, 1);
  assert.equal(JSON.parse(f.payload()!).schemaVersion, 1);
  assert.equal((await repo.load()).hapticsEnabled, false);
});

test("failed database opening can be retried without resetting preferences", async () => {
  const f = fixture();
  let opens = 0;
  const repo = createPreferencesRepository(
    async () => {
      if (++opens === 1) throw new Error("database unavailable");
      return f.db;
    },
    () => NOW,
  );
  await assert.rejects(repo.load(), /database unavailable/);
  assert.equal((await repo.load()).review.firstUsedAt, NOW);
  assert.equal(opens, 2);
});
