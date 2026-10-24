# Dearo — Software Requirements Specification

Version 1.0 · 24 October 2026 · Implementation baseline

## 1. Product purpose and boundaries
Dearo is an installed iOS and Android invitation companion. An organiser prepares one invitation, chooses guests, and opens one guest's WhatsApp chat with personalised text using the official `https://wa.me/<international-digits>?text=<encoded-text>` handoff. The organiser taps Send inside WhatsApp and explicitly confirms that action in Dearo. Dearo cannot observe WhatsApp sending, delivery, read receipts, account identity or recipient registration. App activation is never evidence of sending.

The product promise is reduced copying, searching, mistakes and lost progress, not unlimited sending or guaranteed throughput above forwarding/broadcasts. No automatic/background WhatsApp sending, unofficial API, accessibility auto-clicking, chat scraping or forwarding-limit bypass is included.

## 2. Users and supported scope
- Primary: a client inviting family/friends from their own WhatsApp account.
- Secondary: an organiser preparing an invitation preset for a client.
- MVP: one local event at a time; invitation editing, guest entry/import, native contact selection, queue, confirmation, skip/undo/retry, local backup and restore.
- Deferred: multiple-event manager, accounts/cloud sync, multi-user collaboration, RSVPs, scheduled reminders, Business API delivery and app-store publication.
- This repository is a native React Native app, not a website wrapper. A browser build is not acceptance evidence for iOS or Android.

## 3. Experience and visual system
One guided path: Invitation → Guests → Invite. Supporting tools appear in sheets/dialogs rather than a permanent busy dashboard. White and cool-grey surfaces, near-black text, cobalt actions; no floral decoration, cream/plum or gold styling. A client invitation may contain its own artwork; app chrome remains neutral. Each screen has one dominant action, native-safe padding and large touch areas. Progress always states 'marked sent', never 'delivered'.

### Journey
1. Open app; restore local event safely, or create invitation.
2. Enter event title, valid invitation URL, message template and default phone region. Preview exact personalised text.
3. Add guests via manual fields, paste/file preview or system contact selection. Review malformed and duplicate numbers.
4. Select guests and start. Review guest name, full number and prepared message.
5. Save handoff snapshot durably, then open WhatsApp. Do not launch if persistence fails.
6. On return or relaunch, show the same pending guest with 'Sent, next guest', 'Not yet' and 'Skip'.
7. Only explicit confirmation records 'marked sent'. The same explicit Sent, next guest tap authorizes confirmation followed by opening the next guest; these are separate durable operations, not a background job. If this was the last pending guest, show summary without launching any chat.
8. When all selected guests are reviewed, show confirmed/skipped/pending counts; offer revisit rather than false universal success.

## 4. Functional requirements and acceptance
| ID | Requirement | Acceptance evidence |
| --- | --- | --- |
| INV-01 | Create/edit event title, URL, country/region and message | Required fields validated; previous content preserved after error |
| INV-02 | Personalise `{guest}`, `{event}` and `{link}` safely; fallback for missing names; append configured URL when omitted | Unicode/emoji survive; literal user text is not executed |
| INV-03 | Validate invitation URL | Only HTTP(S), no embedded credentials or dangerous schemes; preview never silently navigates |
| GST-01 | Add/edit/remove guests and select recipients | Stable IDs; editing one guest does not modify another |
| GST-02 | Normalize numbers to E.164 | Region explicit, malformed numbers flagged; no invented WhatsApp eligibility |
| GST-03 | Paste/CSV/VCF import with bounded preview | Invalid rows visible; no silent partial mutation; duplicates reviewed before accepted |
| GST-04 | Handle duplicate numbers explicitly | One canonical phone per event in MVP; conflicts require choosing the retained name/row. Keep-both household records are deferred until number-level resend policy is implemented. |
| GST-05 | Native selected-contact import | Only chosen record read into event; multi-number contact prompts choice; cancellation harmless |
| GST-06 | Permission denial/failure fallback | Manual/paste/file entry still usable; no broad address-book upload |
| QUE-01 | Durable pending handoff before external navigation | Failed save prevents launch; app death after save restores same snapshot |
| QUE-02 | Open one recipient's official wa.me URL | Correct digits and exact URI-encoded message; no simultaneous burst |
| QUE-03 | Honest states | Pending/opened/confirmed/skipped/review; foreground alone never confirms |
| QUE-04 | Explicit confirmed-and-next action | Writes confirmation once before proceeding; double tap guarded |
| QUE-05 | Retry/skip/undo | Retry cannot silently alter old attempt; skip remains revisit-able; undo explicitly does not unsend |
| QUE-06 | Duplicate-send safeguard | Confirmed recipient requires warning before reopening |
| QUE-07 | Message revisions | Future prepared drafts use new template; pending snapshot remains unchanged |
| QUE-08 | Failed launch recovery | Preserve recipient; retry, copy message/number; do not label as delivery failure |
| DAT-01 | Local durable storage | Versioned records; atomic replacement/transaction; corrupt data shown without silent overwrite |
| DAT-02 | Portable backup | Explicit export warning because file contains guest details; schema validation, preview and replacement confirmation |
| DAT-03 | Clear local event | Explicit confirmation; no secret leftovers claimed; platform backup limits documented |
| DAT-04 | No telemetry containing guests | No analytics SDK, server, guest upload, logs of phone numbers/message bodies |
| UX-01 | Accessible native UI | Semantic button/checkbox labels, text scaling, contrast, minimum44pt/48dp targets |
| UX-02 | Reduced motion and haptics | Respect system motion preference; optional subtle feedback; no success before persistence |
| UX-03 | Reliable navigation | Android Back/close cannot discard edits unnoticed; no automatic navigation on resume |
| UX-04 | Lightweight performance | List virtualization; prevent repeated import/launch work; measure representative1000guest list on device |

## 5. State machine and consistency
A guest starts pending. At most one unresolved handoff exists. Confirmations target the persisted attempt ID, not a stale screen or index. Not yet explicitly resolves the attempt as unconfirmed/review while retaining its snapshot; retry requires another tap. Starting a handoff creates an attempt containing recipient ID, phone, message, time and unique attempt ID; persists it before external navigation. Successful OS handoff marks opened, not sent. OS launch error marks review and retains the attempt for retry/copy. A guest becomes confirmed only after explicit organiser confirmation. Skip creates no sending claim. An interrupted/unconfirmed attempt is never erased merely because another screen opens. Undo changes bookkeeping only. An edit to phone/message must not silently rewrite an existing attempt. Counts derive from stored guest state and selection, not transient animation state.

Duplicate identity is keyed by canonical phone, not guest ID. MVP rejects duplicate canonical numbers, including imported rows and edits. Double taps, asynchronous saves and lifecycle events must be serialized. The UI remains disabled during a consequential mutation. Confirmation and launching the next guest are distinct operations: if the next launch fails, the prior confirmation remains durable. App activation merely makes pending confirmation visible.

## 6. Data model
Event: schema version, stable ID, title, invitation URL, template, default region, guests, pending handoff and updated timestamp. Guest: stable ID, display name, canonical number, selection, status, attempt/confirmation history as needed. Do not store entire contact objects, photos, addresses, birthdays or device address-book identifiers unless necessary (not necessary for MVP). Imported source rows remain in preview memory, not analytics. Backup is a versioned JSON document with strict bounded validation; it is not an encrypted vault.

## 7. Platform integration
- React Native + a current compatible Expo SDK, TypeScript.
- Native SQLite persistence; no web localStorage substitution.
- OS contact picker API where supported, no assumption of identical multi-selection on every OS.
- Linking launches HTTPS wa.me. OS may choose regular WhatsApp, WhatsApp Business or a browser. The app cannot guarantee which sender account is active. First-use copy asks organiser to verify WhatsApp account.
- Clipboard writes occur only on user request. Sharing/export invokes OS chooser; cancellation does not imply completed export.
- Local preparation works offline; WhatsApp handoff/delivery still depends on device/network/WhatsApp.
- App-store IDs, signing, universal-link domains and distribution are separate deployment decisions. No claim of published availability.

## 8. Security, privacy and abuse constraints
No authentication secrets, WhatsApp session linking, real guest fixtures or confidential presets enter source control. Only recognised HTTPS wa.me handoffs are constructed; invitation contents are plain text. Imported file sizes, rows and fields are bounded. Prevent malformed backup payloads, incompatible versions, unexpected enums/IDs and prototype keys. Local device storage inherits OS protections; do not claim application-level encryption unless implemented and tested. Android system backup disabled for guest database; iOS backup exclusions must be verified before making strict device-only marketing claims. Export data is deliberately shared only through the user's chooser. No automatic marketing, contact discovery or checking phone registration. No account, tracking or telemetry mandatory for MVP.

## 9. Error and interruption matrix
| Event | Required behaviour |
| --- | --- |
| Contact access unavailable/cancelled | Stay on Guests; offer other entry methods |
| Invalid CSV/VCF/phone | Row-specific preview; no silent import |
| Duplicate number | Review identity; exclude by default |
| Storage load corrupt | Show restore/reset choices; never silently create a fresh empty event |
| Storage write failure | Do not open WhatsApp or announce saved/confirmed |
| WhatsApp open failure | Retain snapshot and offer retry/copy |
| App killed while WhatsApp active | Restore pending confirmation |
| Return without Send | Keep unconfirmed until explicit answer |
| Both WhatsApp variants installed | Disclose OS-controlled selection; test real devices |
| Backup incompatible/corrupt | Reject without changing current event |
| Clear data cancelled | Preserve all records |

## 10. Verification plan and release gates
Automated: domain validation/import/queue/state transitions, mocked persistence and launch sequencing, UI component tests, typecheck, dependency compatibility, platform bundle export. Native build: generate iOS/Android projects, Android Gradle compile if toolchain available, iOS build on macOS/Xcode. Device acceptance: actual app↔WhatsApp loop on iPhone/Android, permissions limited/denied, both WhatsApp variants, app termination/relaunch, text scaling, screen reader, interrupted calls, large list responsiveness and OS backup behaviour. A JS bundle is not a signed installable app; simulator evidence is not real WhatsApp evidence.

Release requires all automated gates plus documented native/device results; unresolved release blockers stay marked blocked, not done. No stores, credentials, paid build services or public hosting are used without separate authorization.

## 11. Delivery sequence
D01 SRS/tracker; D02 scaffold/toolchain; D03 pure domain/import/state-machine; D04 local repository/transaction tests; D05 invitation+guest UI; D06 native contacts/import fallback; D07 handoff queue/recovery; D08 backup/privacy; D09 polish/accessibility; D10 automated/native build verification; D11 independent review/fixes; D12 publish verified main; D13 real-device/signing/store readiness (blocked when hardware/access unavailable). Each task has owner, dependencies, evidence and status in TASKS.md. The requested30minute parent check verifies evidence and assigns the next ready task, not just elapsed time.

## 12. Assumptions and non-goals
India default region is a convenience, always editable. One event avoids early multi-event complexity. English UI first with Unicode multilingual invitation text; full localisation is later unless explicitly added. Mockup artwork is illustrative, not downloaded from arbitrary invitation sites. No guarantee of fewer taps than forwarding five chats. Paid features/pricing, name trademark clearance, full RSVP and public onboarding links are outside MVP implementation.

## 13. Source references (checked 24 October 2026)
- WhatsApp click-to-chat: https://faq.whatsapp.com/5913398998672934
- WhatsApp forwarding limits: https://faq.whatsapp.com/1053543185312573
- Expo current SDK: https://docs.expo.dev/versions/latest/
- Expo Contacts: https://docs.expo.dev/versions/latest/sdk/contacts/
- Expo SQLite: https://docs.expo.dev/versions/latest/sdk/sqlite/
- React Native lifecycle: https://reactnative.dev/docs/appstate

## 14. Acceptance clarifications and measurable bounds
- DAT-02 clear atomically replaces current event, guests and history with an empty event. Failed replacement preserves the old event. Temporary import/export copies are removed after operations; externally exported files, OS snapshots and WhatsApp messages are excluded.
- DAT-03 restore cancellation, validation or write failure preserves current data. Pending recipient/guest consistency is validated. Restore never launches WhatsApp and incomplete drafts reopen in editing.
- GST-06 iOS uses the native selected-contact snapshot without broad address-book access. Limited/denied broad permission must not prevent manual/file entry. Android uses a system single-phone picker with its granted URI; unavailable providers fall back to manual/file entry. No address-book writes or broad READ_CONTACTS. Android 17 device behaviour remains an acceptance gate.
- Bounds: 5,000 guests/import rows; import 1,000,000 UTF-8 bytes; backup 5,000,000 bytes; names 200 characters; templates 10,000 characters; history 20,000 attempts. Boundary and limit-plus-one tests are required.
- Unmeasured performance target: iPhone 13 or equivalent mid-range Android cold load of 1,000 guests within two seconds; responsive interaction and virtualized guest list; 1,000-row import under one second. Record actual device measurements separately.
- Reusable client/organiser preset sharing is deferred. Full-event backup is private guest data, never an invitation/setup link.
- iOS is the first delivery priority. Shared Android implementation remains, without delaying iOS for Android toolchain setup.

## 15. iOS product-completion revision (1.1, 24 October 2026)
The user expanded the deliverable from a source MVP to production-oriented iOS readiness. This section adds product completeness without adding accounts, ads, cloud sync, automatic messaging or unnecessary primary screens. Native compilation, device acceptance and verified publishing metadata still gate a production-ready claim.

### Onboarding and contextual guidance
- ONB-01: A maximum three-step introduction explains the flow, selected-contact privacy and manual WhatsApp confirmation. Skip is available from every step. No permission or review prompt appears here.
- ONB-02: Completion/skip is saved separately from event data. Clear/restore must not re-enable onboarding. A failed preferences write offers an explicit session-only continue, explains that the introduction may return, preserves event data and suppresses rating prompts until preferences recover.
- ONB-03: Introduction is replayable from Settings. Existing unresolved handoffs take priority over a first-run introduction after an upgrade.

### Persistent preferences and review policy
- PRF-01: Settings schema is strict/versioned, migrates only known versions, preserves corrupt data for explicit recovery, and never erases event data. Read-transform-write updates are serialized as one operation.
- PRF-02: Persist haptics, onboarding state, first-use timestamp, bounded opaque engagement IDs and review-request timestamp. No guest names, phone numbers or invitation text are stored in product preferences.
- REV-01: Use the system StoreKit/Expo StoreReview API after a completed queue, never from a custom satisfaction gate, onboarding or a time-sensitive send step. Minimum seven days, two distinct completed event queues and five unique event/guest confirmations; at least 120 days between requests. Undo/reconfirm does not increase unique engagement.
- REV-02: Store the request attempt before calling the OS. Do not infer display, rating, submission or success. Optional review errors never invalidate a saved invitation confirmation.
- REV-03: No prompt while a handoff, modal, error, keyboard or background state is active. Invalidate stale completion milestones on changed event/settings context and recheck the exact current completion before invocation.
- REV-04: An explicit App Store review link is available only after a real numeric listing ID is configured. No fake listing, incentive, sentiment selection or repeated prompt loop.

### Settings, privacy, help and recovery
- SET-01: Group privacy/data, help/support, about, onboarding replay, persistent haptics, export/restore and separately confirmed event/preferences reset in one supporting Settings sheet.
- SET-02: In-app privacy text describes local storage, selected contacts, WhatsApp handoff, personal-data exports, operating-system backups and deletion limits. Public privacy policy and support URLs remain explicit submission blockers until supplied and verified.
- SET-03: Help covers manual send, unsent/retry, offline preparation, sender-account limitations, denied contacts and phone migration. Diagnostic copy contains app/platform information only and is never sent automatically.
- REL-01: Genuine branding icon and launch screen, graceful render-error recovery, loading/empty/error states, permission-free launch, accessibility labels including recipient number, iOS status/error announcements, keyboard-safe sheets and scalable text.
- REL-02: Audit dependencies and privacy manifests. Verify generated native configuration, then repeat on a compiled/archive build and physical device. Do not equate prebuild or JavaScript bundling with native acceptance.

### Evidence and release gates
Automated tests must include onboarding skip/finish/failure escape, separate-preference retention, concurrent preference updates, eligibility boundaries, review cooldown-before-request, first-run/pending/stale review suppression, settings content and absent external destinations. Native VoiceOver, largest accessibility text sizes, physical keyboard/small-screen forms, actual StoreKit no-display behavior, app termination, SQLite and WhatsApp switching remain required device checks.

### Official references reviewed
- Apple onboarding: https://developer.apple.com/design/human-interface-guidelines/onboarding
- Apple ratings/reviews: https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews
- Apple accessibility: https://developer.apple.com/design/human-interface-guidelines/accessibility
- App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Expo StoreReview: https://docs.expo.dev/versions/latest/sdk/storereview/
- Expo privacy manifests: https://docs.expo.dev/guides/apple-privacy/

## 16. Supplemental browser visual QA

A development-only harness may render the existing UI on React Native Web with exclusively synthetic native adapters. It is not a supported web product or iOS emulator. The invitation form must keep its primary continuation outside the scrolling form, within the keyboard-aware layout. Browser validation supplements, never replaces, the native acceptance gates. See `BROWSER_QA.md`.
