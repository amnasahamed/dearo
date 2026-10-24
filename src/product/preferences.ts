/** Product-only state. Never infer invitation sends or App Store ratings from lifecycle events. */
export interface ProductPreferences {
  schemaVersion: 1;
  onboarding: {
    completedVersion: number | null;
    skippedVersion: number | null;
  };
  hapticsEnabled: boolean;
  review: {
    firstUsedAt: string;
    completedQueueCount: number;
    explicitConfirmationCount: number;
    completedQueueIds: string[];
    explicitConfirmationIds: string[];
    lastRequestedAt: string | null;
  };
}
export const CURRENT_ONBOARDING_VERSION = 1;
export const REVIEW_POLICY = {
  minimumUseDays: 7,
  minimumCompletedQueues: 2,
  minimumExplicitConfirmations: 5,
  cooldownDays: 120,
} as const;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_RECORDS = 100_000;
const MAX_JSON_LENGTH = 25_000_000;
function timestamp(value: unknown): asserts value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
    !Number.isFinite(Date.parse(value)) ||
    new Date(value).toISOString() !== value
  )
    throw new Error("Timestamp must be a valid UTC ISO timestamp");
}
function object(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).some((key) => !keys.includes(key))
  )
    throw new Error("Invalid product preferences object");
}
function version(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 1)
    throw new Error("Invalid onboarding version");
}
function counter(value: unknown): asserts value is number {
  if (!Number.isSafeInteger(value) || (value as number) < 0)
    throw new Error("Invalid review counter");
}
function identifier(value: unknown): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new Error("Invalid product event identifier");
}
function ids(value: unknown): asserts value is string[] {
  if (!Array.isArray(value) || value.length > MAX_RECORDS)
    throw new Error("Invalid product event history");
  value.forEach(identifier);
  if (new Set(value).size !== value.length)
    throw new Error("Duplicate product event identifier");
}
export function createProductPreferences(now: string): ProductPreferences {
  timestamp(now);
  return {
    schemaVersion: 1,
    onboarding: { completedVersion: null, skippedVersion: null },
    hapticsEnabled: true,
    review: {
      firstUsedAt: now,
      completedQueueCount: 0,
      explicitConfirmationCount: 0,
      completedQueueIds: [],
      explicitConfirmationIds: [],
      lastRequestedAt: null,
    },
  };
}
/** Empty storage initializes defaults. Only explicit v0 and v1 schemas are accepted; corrupt input is never silently reset. */
export function parseProductPreferences(
  json: string | null,
  now: string,
): ProductPreferences {
  timestamp(now);
  if (json === null) return createProductPreferences(now);
  if (typeof json !== "string" || json.length > MAX_JSON_LENGTH)
    throw new Error("Product preferences are too large");
  const value: unknown = JSON.parse(json);
  object(value, [
    "schemaVersion",
    "onboarding",
    "hapticsEnabled",
    "review",
    "onboardingCompleted",
    "firstUsedAt",
  ]);
  if (value.schemaVersion === 0) {
    object(value, [
      "schemaVersion",
      "onboardingCompleted",
      "hapticsEnabled",
      "firstUsedAt",
    ]);
    if (
      value.onboardingCompleted !== undefined &&
      typeof value.onboardingCompleted !== "boolean"
    )
      throw new Error("Invalid legacy onboarding preference");
    if (
      value.hapticsEnabled !== undefined &&
      typeof value.hapticsEnabled !== "boolean"
    )
      throw new Error("Invalid legacy haptics preference");
    if (value.firstUsedAt !== undefined) timestamp(value.firstUsedAt);
    const initial = createProductPreferences(
      (value.firstUsedAt as string | undefined) ?? now,
    );
    return {
      ...initial,
      hapticsEnabled: (value.hapticsEnabled as boolean | undefined) ?? true,
      onboarding: {
        completedVersion: value.onboardingCompleted === true ? 1 : null,
        skippedVersion: null,
      },
    };
  }
  object(value, ["schemaVersion", "onboarding", "hapticsEnabled", "review"]);
  if (value.schemaVersion !== 1)
    throw new Error("Unsupported product preferences version");
  if (typeof value.hapticsEnabled !== "boolean")
    throw new Error("Invalid haptics preference");
  object(value.onboarding, ["completedVersion", "skippedVersion"]);
  for (const entry of [
    value.onboarding.completedVersion,
    value.onboarding.skippedVersion,
  ])
    if (entry !== null) version(entry);
  const review = value.review;
  object(review, [
    "firstUsedAt",
    "completedQueueCount",
    "explicitConfirmationCount",
    "completedQueueIds",
    "explicitConfirmationIds",
    "lastRequestedAt",
  ]);
  timestamp(review.firstUsedAt);
  if (review.lastRequestedAt !== null) {
    timestamp(review.lastRequestedAt);
    if (Date.parse(review.lastRequestedAt) < Date.parse(review.firstUsedAt))
      throw new Error("Review request predates first use");
  }
  counter(review.completedQueueCount);
  counter(review.explicitConfirmationCount);
  ids(review.completedQueueIds);
  ids(review.explicitConfirmationIds);
  if (
    review.completedQueueCount !== review.completedQueueIds.length ||
    review.explicitConfirmationCount !== review.explicitConfirmationIds.length
  )
    throw new Error("Review counters do not match recorded events");
  return value as unknown as ProductPreferences;
}
export function serializeProductPreferences(
  preferences: ProductPreferences,
): string {
  const json = JSON.stringify(preferences);
  parseProductPreferences(json, preferences.review.firstUsedAt);
  return json;
}
export function completeOnboarding(
  preferences: ProductPreferences,
  onboardingVersion = CURRENT_ONBOARDING_VERSION,
): ProductPreferences {
  version(onboardingVersion);
  return {
    ...preferences,
    onboarding: {
      ...preferences.onboarding,
      completedVersion: Math.max(
        preferences.onboarding.completedVersion ?? 0,
        onboardingVersion,
      ),
    },
  };
}
export function skipOnboarding(
  preferences: ProductPreferences,
  onboardingVersion = CURRENT_ONBOARDING_VERSION,
): ProductPreferences {
  version(onboardingVersion);
  return {
    ...preferences,
    onboarding: {
      ...preferences.onboarding,
      skippedVersion: Math.max(
        preferences.onboarding.skippedVersion ?? 0,
        onboardingVersion,
      ),
    },
  };
}
export function shouldShowOnboarding(
  preferences: ProductPreferences,
  onboardingVersion = CURRENT_ONBOARDING_VERSION,
): boolean {
  version(onboardingVersion);
  return (
    Math.max(
      preferences.onboarding.completedVersion ?? 0,
      preferences.onboarding.skippedVersion ?? 0,
    ) < onboardingVersion
  );
}
export function setHapticsEnabled(
  preferences: ProductPreferences,
  enabled: boolean,
): ProductPreferences {
  if (typeof enabled !== "boolean")
    throw new Error("Invalid haptics preference");
  return { ...preferences, hapticsEnabled: enabled };
}
/** Use the confirmed attempt ID. A foreground event or opening WhatsApp is never a confirmation. */
export function recordExplicitConfirmation(
  preferences: ProductPreferences,
  confirmationId: string,
): ProductPreferences {
  identifier(confirmationId);
  if (preferences.review.explicitConfirmationIds.includes(confirmationId))
    return preferences;
  if (preferences.review.explicitConfirmationIds.length >= MAX_RECORDS)
    throw new Error("Product event history limit reached");
  return {
    ...preferences,
    review: {
      ...preferences.review,
      explicitConfirmationCount:
        preferences.review.explicitConfirmationCount + 1,
      explicitConfirmationIds: [
        ...preferences.review.explicitConfirmationIds,
        confirmationId,
      ],
    },
  };
}
/** Use a stable completed queue/session ID; repeated callbacks do not increment the counter. */
export function recordCompletedQueue(
  preferences: ProductPreferences,
  completedQueueId: string,
): ProductPreferences {
  identifier(completedQueueId);
  if (preferences.review.completedQueueIds.includes(completedQueueId))
    return preferences;
  if (preferences.review.completedQueueIds.length >= MAX_RECORDS)
    throw new Error("Product event history limit reached");
  return {
    ...preferences,
    review: {
      ...preferences.review,
      completedQueueCount: preferences.review.completedQueueCount + 1,
      completedQueueIds: [
        ...preferences.review.completedQueueIds,
        completedQueueId,
      ],
    },
  };
}
export function isReviewEligible(
  preferences: ProductPreferences,
  now: string,
): boolean {
  timestamp(now);
  const elapsed = Date.parse(now) - Date.parse(preferences.review.firstUsedAt);
  const cooldown =
    preferences.review.lastRequestedAt === null
      ? Infinity
      : Date.parse(now) - Date.parse(preferences.review.lastRequestedAt);
  return (
    elapsed >= REVIEW_POLICY.minimumUseDays * DAY_MS &&
    preferences.review.completedQueueCount >=
      REVIEW_POLICY.minimumCompletedQueues &&
    preferences.review.explicitConfirmationCount >=
      REVIEW_POLICY.minimumExplicitConfirmations &&
    cooldown >= REVIEW_POLICY.cooldownDays * DAY_MS
  );
}
/** Persist this before invoking the OS request. A request does not prove a dialog was shown or a rating submitted. */
export function markReviewRequested(
  preferences: ProductPreferences,
  now: string,
): ProductPreferences {
  if (!isReviewEligible(preferences, now))
    throw new Error("Review request is not eligible");
  return {
    ...preferences,
    review: { ...preferences.review, lastRequestedAt: now },
  };
}
