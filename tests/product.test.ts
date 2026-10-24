import test from "node:test";
import assert from "node:assert/strict";
import {
  createProductPreferences,
  parseProductPreferences,
  serializeProductPreferences,
  completeOnboarding,
  skipOnboarding,
  shouldShowOnboarding,
  setHapticsEnabled,
  recordExplicitConfirmation,
  recordCompletedQueue,
  isReviewEligible,
  markReviewRequested,
  type ProductPreferences,
} from "../src/product/preferences";
const firstUse = "2026-01-01T00:00:00.000Z";
const atDay = (day: number) =>
  new Date(Date.parse(firstUse) + day * 86400000).toISOString();
function meaningfulUse(): ProductPreferences {
  let prefs = createProductPreferences(firstUse);
  prefs = recordCompletedQueue(prefs, "queue-one");
  prefs = recordCompletedQueue(prefs, "queue-two");
  for (let i = 0; i < 5; i++)
    prefs = recordExplicitConfirmation(prefs, `attempt-${i}`);
  return prefs;
}
test("fresh preferences default safely and never request review on first launch", () => {
  const initial = createProductPreferences(firstUse);
  assert.equal(initial.hapticsEnabled, true);
  assert.equal(shouldShowOnboarding(initial), true);
  assert.equal(initial.review.explicitConfirmationCount, 0);
  assert.equal(initial.review.completedQueueCount, 0);
  assert.equal(isReviewEligible(initial, firstUse), false);
  assert.equal(isReviewEligible(meaningfulUse(), firstUse), false);
  assert.deepEqual(parseProductPreferences(null, firstUse), initial);
});
test("onboarding completion and skip persist distinct versioned choices immutably", () => {
  const initial = createProductPreferences(firstUse);
  const skipped = skipOnboarding(initial);
  assert.equal(skipped.onboarding.skippedVersion, 1);
  assert.equal(skipped.onboarding.completedVersion, null);
  assert.equal(shouldShowOnboarding(skipped), false);
  assert.equal(shouldShowOnboarding(skipped, 2), true);
  const completed = completeOnboarding(skipped, 2);
  assert.equal(completed.onboarding.completedVersion, 2);
  assert.equal(completed.onboarding.skippedVersion, 1);
  assert.equal(shouldShowOnboarding(completed, 2), false);
  assert.equal(completeOnboarding(completed, 1).onboarding.completedVersion, 2);
  assert.equal(initial.onboarding.skippedVersion, null);
  assert.throws(() => skipOnboarding(initial, 0));
  assert.throws(() => completeOnboarding(initial, 1.5));
});
test("haptic preference is a strict boolean and never mutates prior settings", () => {
  const initial = createProductPreferences(firstUse);
  assert.equal(setHapticsEnabled(initial, false).hapticsEnabled, false);
  assert.equal(initial.hapticsEnabled, true);
  assert.throws(() => setHapticsEnabled(initial, "false" as any));
});
test("explicit confirmation and completed queue IDs are idempotent and private", () => {
  const initial = createProductPreferences(firstUse);
  const once = recordExplicitConfirmation(initial, "attempt-one");
  const twice = recordExplicitConfirmation(once, "attempt-one");
  assert.equal(twice.review.explicitConfirmationCount, 1);
  assert.equal(initial.review.explicitConfirmationCount, 0);
  const queued = recordCompletedQueue(twice, "queue-one");
  assert.equal(
    recordCompletedQueue(queued, "queue-one").review.completedQueueCount,
    1,
  );
  assert.deepEqual(queued.review.explicitConfirmationIds, ["attempt-one"]);
  assert.deepEqual(queued.review.completedQueueIds, ["queue-one"]);
  assert.throws(() => recordCompletedQueue(queued, ""));
  assert.throws(() => recordExplicitConfirmation(queued, "x".repeat(201)));
});
test("review policy requires every threshold and exactly seven days is eligible", () => {
  const ready = meaningfulUse();
  assert.equal(
    isReviewEligible(ready, new Date(Date.parse(atDay(7)) - 1).toISOString()),
    false,
  );
  assert.equal(isReviewEligible(ready, atDay(7)), true);
  assert.equal(isReviewEligible(ready, atDay(-1)), false);
  let oneQueue = createProductPreferences(firstUse);
  for (let i = 0; i < 5; i++)
    oneQueue = recordExplicitConfirmation(oneQueue, `a-${i}`);
  oneQueue = recordCompletedQueue(oneQueue, "q1");
  assert.equal(isReviewEligible(oneQueue, atDay(100)), false);
  let fourConfirmations = recordCompletedQueue(
    recordCompletedQueue(createProductPreferences(firstUse), "q1"),
    "q2",
  );
  for (let i = 0; i < 4; i++)
    fourConfirmations = recordExplicitConfirmation(fourConfirmations, `a-${i}`);
  assert.equal(isReviewEligible(fourConfirmations, atDay(100)), false);
  // There is deliberately no sentiment, rating intent, satisfaction or feedback input.
});
test("review request persists cooldown and needs 120 complete days before another request", () => {
  const ready = meaningfulUse();
  const requested = markReviewRequested(ready, atDay(7));
  assert.equal(ready.review.lastRequestedAt, null);
  assert.equal(requested.review.lastRequestedAt, atDay(7));
  assert.equal(isReviewEligible(requested, atDay(126)), false);
  assert.equal(
    isReviewEligible(
      requested,
      new Date(Date.parse(atDay(127)) - 1).toISOString(),
    ),
    false,
  );
  assert.equal(isReviewEligible(requested, atDay(127)), true);
  assert.throws(() => markReviewRequested(requested, atDay(8)), /not eligible/);
  assert.equal(isReviewEligible(requested, atDay(6)), false);
});
test("preferences round trip retains eligibility, counters and settings", () => {
  const prefs = setHapticsEnabled(
    completeOnboarding(markReviewRequested(meaningfulUse(), atDay(7))),
    false,
  );
  const restored = parseProductPreferences(
    serializeProductPreferences(prefs),
    atDay(8),
  );
  assert.deepEqual(restored, prefs);
  assert.equal(isReviewEligible(restored, atDay(8)), false);
});
test("known v0 migration preserves explicit choices but never invents completed activity", () => {
  const migrated = parseProductPreferences(
    JSON.stringify({
      schemaVersion: 0,
      onboardingCompleted: true,
      hapticsEnabled: false,
      firstUsedAt: firstUse,
    }),
    atDay(100),
  );
  assert.equal(migrated.schemaVersion, 1);
  assert.equal(migrated.onboarding.completedVersion, 1);
  assert.equal(migrated.hapticsEnabled, false);
  assert.equal(migrated.review.firstUsedAt, firstUse);
  assert.equal(migrated.review.explicitConfirmationCount, 0);
  assert.equal(migrated.review.completedQueueCount, 0);
  assert.equal(isReviewEligible(migrated, atDay(100)), false);
  assert.deepEqual(
    parseProductPreferences('{"schemaVersion":0}', firstUse),
    createProductPreferences(firstUse),
  );
});
test("corrupt or unknown schemas never silently reset preferences", () => {
  for (const json of [
    "",
    "{}",
    '{"schemaVersion":2}',
    '{"schemaVersion":0,"onboardingCompleted":"yes"}',
    '{"schemaVersion":0,"hapticsEnabled":[]}',
    '{"schemaVersion":0,"__proto__":{"polluted":true}}',
  ]) {
    assert.throws(() => parseProductPreferences(json, firstUse));
  }
  assert.equal(({} as any).polluted, undefined);
  const mutations: ((p: any) => void)[] = [
    (p) => {
      p.hapticsEnabled = "true";
    },
    (p) => {
      p.onboarding.completedVersion = [1];
    },
    (p) => {
      delete p.onboarding.skippedVersion;
    },
    (p) => {
      p.review.completedQueueCount = -1;
    },
    (p) => {
      p.review.explicitConfirmationCount = 1.1;
    },
    (p) => {
      p.review.explicitConfirmationCount = 6;
    },
    (p) => {
      p.review.explicitConfirmationIds[1] = p.review.explicitConfirmationIds[0];
    },
    (p) => {
      p.review.completedQueueIds = {};
    },
    (p) => {
      p.review.lastRequestedAt = atDay(-1);
    },
    (p) => {
      p.review.firstUsedAt = "2026-02-30T00:00:00.000Z";
    },
    (p) => {
      p.review.lastRequestedAt = ["2026-02-01T00:00:00.000Z"];
    },
    (p) => {
      p.review.rating = 5;
    },
    (p) => {
      p.satisfaction = "happy";
    },
  ];
  for (const mutate of mutations) {
    const invalid = JSON.parse(JSON.stringify(meaningfulUse()));
    mutate(invalid);
    assert.throws(() =>
      parseProductPreferences(JSON.stringify(invalid), firstUse),
    );
  }
});
test("future timestamps safely suppress eligibility and timestamp inputs are strict", () => {
  const prefs = meaningfulUse();
  assert.equal(isReviewEligible(prefs, atDay(-1)), false);
  for (const invalid of [
    "2026-01-01",
    "2026-02-30T00:00:00.000Z",
    "not-a-date",
    "2026-01-01T00:00:00Z",
  ]) {
    assert.throws(() => createProductPreferences(invalid));
    assert.throws(() => isReviewEligible(prefs, invalid));
  }
});
