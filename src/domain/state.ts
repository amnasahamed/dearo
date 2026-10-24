import type { AppState, Event, Guest, PendingHandoff } from "./types";
import { LIMITS } from "./types";
import { parseBackup } from "./backup";
import { prepareMessage, normalizePhone } from "./messaging";
export function createInitialState(event: Event): AppState {
  return parseBackup(
    JSON.stringify({
      schemaVersion: 1,
      event: { ...event },
      guests: [],
      pendingHandoff: null,
      attempts: [],
    }),
  );
}
function validateTime(at: string): void {
  if (!Number.isFinite(Date.parse(at))) throw new Error("Invalid timestamp");
}
function guestById(state: AppState, id: string): Guest {
  const guest = state.guests.find((g) => g.id === id);
  if (!guest) throw new Error("Guest not found");
  return guest;
}
function updateGuest(
  state: AppState,
  id: string,
  changes: Partial<Guest>,
): AppState {
  guestById(state, id);
  return {
    ...state,
    guests: state.guests.map((g) => (g.id === id ? { ...g, ...changes } : g)),
  };
}
/** Caller MUST persist returned state successfully before opening WhatsApp. */
export function prepareHandoff(
  state: AppState,
  guestId: string,
  attemptId: string,
  at: string,
): AppState {
  if (state.guests.length > LIMITS.guests)
    throw new Error("Guest limit exceeded");
  if (state.pendingHandoff)
    throw new Error("Resolve the unfinished handoff before opening another");
  if (state.attempts.length >= LIMITS.attempts)
    throw new Error("Attempt history limit reached");
  if (
    !attemptId ||
    attemptId.length > 200 ||
    state.attempts.some((a) => a.id === attemptId)
  )
    throw new Error("Attempt ID must be unique");
  if (!Number.isFinite(Date.parse(at))) throw new Error("Invalid timestamp");
  const guest = guestById(state, guestId);
  if (!guest.selected || guest.status === "confirmed")
    throw new Error("Select an unconfirmed guest first");
  const pendingHandoff: PendingHandoff = {
    id: attemptId,
    guestId,
    recipient: normalizePhone(guest.phone, state.event.countryCode),
    preparedMessage: prepareMessage(state.event, guest.name),
    preparedAt: at,
  };
  return {
    ...updateGuest(state, guestId, { status: "opened" }),
    pendingHandoff,
  };
}
/** App foreground events are not evidence of sending. */
export function returnFromHandoff(state: AppState, at: string): AppState {
  validateTime(at);
  return state.pendingHandoff
    ? { ...state, pendingHandoff: { ...state.pendingHandoff, returnedAt: at } }
    : state;
}
/** Call only after the user explicitly confirms they sent this exact handoff. */
export function confirmHandoff(
  state: AppState,
  at: string,
  expectedAttemptId: string,
): AppState {
  validateTime(at);
  const pending = state.pendingHandoff;
  if (!pending) throw new Error("No handoff to confirm");
  if (pending.id !== expectedAttemptId)
    throw new Error("Handoff changed; review the current attempt");
  const guest = guestById(state, pending.guestId);
  if (guest.phone !== pending.recipient || guest.status !== "opened")
    throw new Error("Recipient changed since handoff; resolve as unconfirmed");
  return {
    ...updateGuest(state, pending.guestId, { status: "confirmed" }),
    pendingHandoff: null,
    attempts: [
      ...state.attempts,
      { ...pending, outcome: "confirmed", confirmedAt: at },
    ],
  };
}
export function cancelHandoff(
  state: AppState,
  expectedAttemptId: string,
): AppState {
  const pending = state.pendingHandoff;
  if (!pending) throw new Error("No handoff to resolve");
  if (pending.id !== expectedAttemptId)
    throw new Error("Handoff changed; review the current attempt");
  return {
    ...updateGuest(state, pending.guestId, { status: "review" }),
    pendingHandoff: null,
    attempts: [...state.attempts, { ...pending, outcome: "unconfirmed" }],
  };
}
export function skipGuest(state: AppState, id: string): AppState {
  if (state.pendingHandoff?.guestId === id)
    throw new Error("Resolve this handoff before skipping");
  if (guestById(state, id).status === "confirmed")
    throw new Error("Undo confirmation before skipping");
  return updateGuest(state, id, { status: "skipped" });
}
export function revisitGuest(state: AppState, id: string): AppState {
  if (state.pendingHandoff?.guestId === id)
    throw new Error("Resolve this handoff first");
  if (guestById(state, id).status === "confirmed")
    throw new Error("Undo confirmation before revisiting");
  return updateGuest(state, id, { status: "pending" });
}
/** Changes local tracking only. It cannot unsend a WhatsApp message. */
export function undoConfirmation(
  state: AppState,
  id: string,
  at: string,
): AppState {
  validateTime(at);
  if (guestById(state, id).status !== "confirmed")
    throw new Error("Guest is not confirmed");
  return {
    ...updateGuest(state, id, { status: "review" }),
    attempts: state.attempts.map((a) =>
      a.guestId === id && a.outcome === "confirmed" && !a.undoneAt
        ? { ...a, undoneAt: at }
        : a,
    ),
  };
}
export function nextGuest(state: AppState): Guest | undefined {
  if (state.pendingHandoff) return undefined;
  return state.guests.find((g) => g.selected && g.status === "pending");
}

/** Edit contact details without reassigning the identity of a recorded handoff. */
export function editGuestDetails(
  state: AppState,
  id: string,
  details: { name: string; phone: string },
): AppState {
  if (state.pendingHandoff) {
    throw new Error("Resolve the unfinished handoff before editing contacts");
  }
  const guest = guestById(state, id);
  if (typeof details.name !== "string" || details.name.length > LIMITS.name) {
    throw new Error("Name is too long or invalid");
  }
  const name = details.name.trim();
  const phone = normalizePhone(details.phone, state.event.countryCode);
  if (
    phone !== guest.phone &&
    state.attempts.some((attempt) => attempt.guestId === id)
  ) {
    throw new Error(
      "A contact with invitation history cannot change phone number; add a separate contact instead",
    );
  }
  if (state.guests.some((other) => other.id !== id && other.phone === phone)) {
    throw new Error("Another guest already uses this phone number");
  }
  return updateGuest(state, id, { name, phone });
}
