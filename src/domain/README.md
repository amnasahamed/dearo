# Dearo domain contract

Import public APIs from `src/domain/index.ts`. Functions are synchronous and contain no network, filesystem, native contacts, or UI calls. State transitions return new objects and do not mutate their input.

## Safe WhatsApp handoff

1. Call `prepareHandoff(state, guestId, uniqueAttemptId, isoTimestamp)`.
2. Persist the returned **whole state successfully** before launching any external app.
3. Build the external URL from the persisted `pendingHandoff.recipient` and `pendingHandoff.preparedMessage`, never from an edited guest or event.
4. On foreground return, `returnFromHandoff(state, isoTimestamp)` only records return time. It cannot confirm sending.
5. Ask the user whether they sent that invitation. Explicit affirmation calls `confirmHandoff(state, isoTimestamp, expectedAttemptId)`. An explicit unresolved/cancel decision calls `cancelHandoff(state, expectedAttemptId)` and records an unconfirmed attempt for review.
6. Persist each decision before advancing. A pending handoff blocks another prepare call and blocks `nextGuest`.

The message and recipient are snapshots. Confirm rejects changed recipients or non-opened guest status. The app should disable guest number editing while a handoff is pending. Event/template edits cannot alter the existing snapshot.

Undo confirmation is local tracking only; it does not unsend a message. An undo retains the original confirmed attempt, records `undoneAt`, and returns the guest to review. Review and skipped guests are only requeued through `revisitGuest`.

## Imports

`importContactsPreview(text, format, countryCode, existingGuests)` accepts CSV, pasted rows, and basic vCard 3/4 plain-text contacts. Preview rows include stable row numbers, normalized E.164 phone numbers, errors, and duplicate/conflicting-name annotations. No contacts are added automatically.

CSV accepts `name`/`full name`/`guest` and `phone`/`number`/`mobile`/`telephone` headers in either order, or name then phone without headers. Paste accepts name-comma-number, name-tab-number, name-space-number, or a bare number. Basic vCard supports FN, TEL, folded lines, and multiple TEL fields. It does not decode quoted-printable, base64, or arbitrary structured contact metadata.

`applyImportDecisions(state, preview, decisions)` takes explicit `{row,action:'add',id}` or `{row,action:'skip'}` decisions. A stable ID is required for every added row. Invalid and unreviewed rows are not imported. This MVP permits only one guest per normalized phone number, preventing accidental repeat messages or merging conflicting names. Choose one imported row and skip the others; retaining multiple people on one phone is not supported.

## Backup and limits

`serializeBackup` validates before serialization. `parseBackup` accepts strict schema version 1, rejects extra object keys, invalid references, duplicate guest/attempt IDs, duplicate phones, unsafe URLs, invalid timestamps, and inconsistent pending recipients. It restores pending handoffs unchanged, not as sent.

Limits: 1 MB import text, 5 MB backup JSON, 5,000 guests, 20,000 attempt records, 200-character guest names, 10,000-character message templates. Backup JSON contains personal contact details and invitation message snapshots: the app must make export a deliberate user action and warn about sharing.

## Editing contacts

`editGuestDetails(state, guestId, { name, phone })` normalizes the phone, validates the name, and rejects duplicate numbers. All contact edits are blocked while any handoff is pending. Once a guest has any attempt history, including unconfirmed or undone confirmations, their phone cannot change. Name-only corrections remain allowed after resolving a handoff. Add a separate contact for a different number so past attempts cannot be attributed to a new recipient.
