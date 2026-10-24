import type { CountryCode } from "libphonenumber-js";
export type { CountryCode };
export type GuestStatus =
  "pending" | "opened" | "confirmed" | "skipped" | "review";
export interface Event {
  id: string;
  title: string;
  invitationUrl: string;
  messageTemplate: string;
  countryCode: CountryCode;
}
export interface Guest {
  id: string;
  name: string;
  phone: string;
  selected: boolean;
  status: GuestStatus;
}
export interface PendingHandoff {
  id: string;
  guestId: string;
  recipient: string;
  preparedMessage: string;
  preparedAt: string;
  returnedAt?: string;
}
export interface Attempt extends PendingHandoff {
  outcome: "confirmed" | "cancelled" | "unconfirmed";
  confirmedAt?: string;
  undoneAt?: string;
}
export interface AppState {
  schemaVersion: 1;
  event: Event;
  guests: Guest[];
  pendingHandoff: PendingHandoff | null;
  attempts: Attempt[];
}
export interface ImportRow {
  row: number;
  name: string;
  rawPhone: string;
  phone?: string;
  error?: string;
  duplicateOf?: string;
  conflict?: boolean;
}
export interface ImportPreview {
  rows: ImportRow[];
  errors: string[];
}
export interface ImportDecision {
  row: number;
  action: "add" | "skip";
  id?: string;
}
export const LIMITS = {
  guests: 5000,
  importBytes: 1_000_000,
  backupBytes: 5_000_000,
  name: 200,
  message: 10000,
  attempts: 20000,
} as const;
