import { isSupportedCountry } from "libphonenumber-js";
import type { AppState, CountryCode } from "./types";
import { LIMITS } from "./types";
import { utf8ByteLength } from "./limits";
import { validateInvitationUrl, normalizePhone } from "./messaging";
function object(
  value: unknown,
  keys: string[],
): asserts value is Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.getPrototypeOf(value) !== Object.prototype ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new Error("Invalid backup object or unexpected key");
}
function str(
  value: unknown,
  max: number,
  allowEmpty = false,
): asserts value is string {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (!allowEmpty && !value.trim())
  )
    throw new Error("Invalid backup string");
}
function date(value: unknown): void {
  str(value, 40);
  if (!Number.isFinite(Date.parse(value)))
    throw new Error("Invalid backup timestamp");
}
export function parseBackup(text: string): AppState {
  if (typeof text !== "string" || utf8ByteLength(text) > LIMITS.backupBytes)
    throw new Error("Backup exceeds 5 MB limit");
  const state: unknown = JSON.parse(text);
  object(state, [
    "schemaVersion",
    "event",
    "guests",
    "pendingHandoff",
    "attempts",
  ]);
  if (state.schemaVersion !== 1)
    throw new Error(
      "Unsupported backup schema version. Update Dearo before opening this data; it has not been changed.",
    );
  const event = state.event;
  object(event, [
    "id",
    "title",
    "invitationUrl",
    "messageTemplate",
    "countryCode",
  ]);
  str(event.id, 200);
  str(event.title, 200, true);
  str(event.invitationUrl, 4096, true);
  str(event.messageTemplate, LIMITS.message, true);
  str(event.countryCode, 2);
  if (!isSupportedCountry(event.countryCode))
    throw new Error("Invalid default country");
  if (event.invitationUrl) validateInvitationUrl(event.invitationUrl);
  if (!Array.isArray(state.guests) || state.guests.length > LIMITS.guests)
    throw new Error("Invalid guest list");
  const ids = new Set<string>(),
    phones = new Set<string>();
  for (const guest of state.guests) {
    object(guest, ["id", "name", "phone", "selected", "status"]);
    str(guest.id, 200);
    str(guest.name, LIMITS.name, true);
    str(guest.phone, 20);
    if (
      normalizePhone(guest.phone, event.countryCode as CountryCode) !==
        guest.phone ||
      phones.has(guest.phone) ||
      ids.has(guest.id)
    )
      throw new Error("Duplicate or invalid guest");
    if (
      typeof guest.selected !== "boolean" ||
      typeof guest.status !== "string" ||
      !["pending", "opened", "confirmed", "skipped", "review"].includes(
        guest.status,
      )
    )
      throw new Error("Invalid guest state");
    ids.add(guest.id);
    phones.add(guest.phone);
  }
  const attemptIds = new Set<string>();
  const validateHandoff = (value: unknown, attempt: boolean) => {
    object(value, [
      "id",
      "guestId",
      "recipient",
      "preparedMessage",
      "preparedAt",
      "returnedAt",
      ...(attempt ? ["outcome", "confirmedAt", "undoneAt"] : []),
    ]);
    str(value.id, 200);
    str(value.guestId, 200);
    str(value.recipient, 20);
    str(value.preparedMessage, LIMITS.message + 5000);
    date(value.preparedAt);
    if (
      !ids.has(value.guestId) ||
      attemptIds.has(value.id) ||
      normalizePhone(value.recipient, event.countryCode as CountryCode) !==
        value.recipient
    )
      throw new Error("Invalid handoff reference");
    attemptIds.add(value.id);
    if (value.returnedAt !== undefined) date(value.returnedAt);
    if (attempt) {
      if (
        typeof value.outcome !== "string" ||
        !["confirmed", "cancelled", "unconfirmed"].includes(value.outcome)
      )
        throw new Error("Invalid attempt outcome");
      if (value.confirmedAt !== undefined) date(value.confirmedAt);
      if (value.undoneAt !== undefined) date(value.undoneAt);
      if (value.outcome === "confirmed" && !value.confirmedAt)
        throw new Error("Confirmed attempt requires timestamp");
    }
  };
  if (!Array.isArray(state.attempts) || state.attempts.length > LIMITS.attempts)
    throw new Error("Invalid attempts");
  for (const attempt of state.attempts) validateHandoff(attempt, true);
  if (state.pendingHandoff !== null) {
    validateHandoff(state.pendingHandoff, false);
    const pending = state.pendingHandoff as Record<string, unknown>;
    const guest = state.guests.find((g) => g.id === pending.guestId);
    if (guest.status !== "opened" || guest.phone !== pending.recipient)
      throw new Error(
        "Pending handoff requires the same recipient and an opened guest",
      );
  }
  return state as unknown as AppState;
}
export function serializeBackup(state: AppState): string {
  const text = JSON.stringify(state, null, 2);
  parseBackup(text);
  return text;
}
