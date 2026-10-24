import { prepareMessage, type AppState, type Event } from "../domain";

export type Screen = "invitation" | "guests" | "send";

/** Drafts and imported incomplete events must never throw during rendering. */
export function safeMessage(event: Event, name: string): string | null {
  try {
    return prepareMessage(event, name);
  } catch {
    return null;
  }
}

/** An unresolved handoff always takes priority over editing the current draft. */
export function resumeScreen(state: AppState): Screen {
  return state.pendingHandoff
    ? "send"
    : state.guests.length && safeMessage(state.event, "Guest")
      ? "send"
      : "invitation";
}
