import {
  createInitialState,
  prepareHandoff,
  confirmHandoff,
  type AppState,
  type Event,
  type Guest,
} from "../src/domain";
import {
  createProductPreferences,
  completeOnboarding,
  type ProductPreferences,
} from "../src/product/preferences";

/** Synthetic visual-QA scenarios only, never device/StoreKit/WhatsApp acceptance. */
export type PreviewScenario =
  "onboarding" | "invitation" | "guests" | "send" | "pending" | "summary";
export const PREVIEW_SCENARIOS: readonly PreviewScenario[] = [
  "onboarding",
  "invitation",
  "guests",
  "send",
  "pending",
  "summary",
];
export function resolvePreviewScenario(search: string): PreviewScenario {
  const candidate = new URLSearchParams(search).get("scenario");
  return PREVIEW_SCENARIOS.includes(candidate as PreviewScenario)
    ? (candidate as PreviewScenario)
    : "onboarding";
}
const PREVIEW_TIME = "2026-10-24T12:00:00.000Z";
const event: Event = {
  id: "synthetic-preview-event",
  title: "Maya & Arjun",
  invitationUrl: "https://example.com/wedding",
  messageTemplate:
    "Dear {guest},\n\nWe would love to celebrate our wedding with you. Find all the details here:\n{link}\n\nWith love,\nMaya & Arjun",
  countryCode: "US",
};
const names = [
  "Alex Example",
  "Sam Sample",
  "Jordan Example",
  "Morgan Sample",
  "Taylor Example",
  "Riley Sample",
];
/** All phone numbers use the reserved fictional NANP 555-0100–0199 range. */
export function syntheticGuests(): Guest[] {
  return names.map((name, index) => ({
    id: `synthetic-guest-${index + 1}`,
    name,
    phone: `+1202555010${index + 1}`,
    selected: true,
    status: "pending",
  }));
}
export interface PreviewFixture {
  state: AppState;
  preferences: ProductPreferences;
}
export function createPreviewFixture(
  scenario: PreviewScenario,
): PreviewFixture {
  let state = createInitialState({ ...event });
  let preferences = createProductPreferences(PREVIEW_TIME);
  if (scenario !== "onboarding") preferences = completeOnboarding(preferences);
  if (scenario === "onboarding" || scenario === "invitation")
    return { state, preferences };
  state = { ...state, guests: syntheticGuests() };
  const confirmedCount = scenario === "summary" ? state.guests.length : 2;
  for (let index = 0; index < confirmedCount; index++) {
    state = prepareHandoff(
      state,
      state.guests[index].id,
      `synthetic-attempt-${index + 1}`,
      PREVIEW_TIME,
    );
    state = confirmHandoff(
      state,
      PREVIEW_TIME,
      `synthetic-attempt-${index + 1}`,
    );
  }
  if (scenario === "pending")
    state = prepareHandoff(
      state,
      state.guests[2].id,
      "synthetic-pending-attempt",
      PREVIEW_TIME,
    );
  // Production resumeScreen returns send for any valid event with guests.
  // The "guests" scenario uses Back in the UI, rather than a hidden production override.
  return { state, preferences };
}
