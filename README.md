# Dearo

A private, native iOS-first invitation companion, with a shared Android implementation. Prepare an invitation, choose guests, then open one personalised WhatsApp conversation at a time.

**Dearo never sends automatically.** The user taps Send inside WhatsApp and confirms back in Dearo. Opening a link is not a delivery receipt.

## Status
Source MVP with automated domain/controller checks. Native device acceptance and signed distribution remain pending. See docs/VERIFICATION.md, docs/SRS.md and docs/TASKS.md. This is not an App Store release or installable IPA.

## Development
Node 24 and npm 11 tested. Install: npm ci.

- npm run check: TypeScript, ESLint and automated tests.
- npm run export:native: iOS/Android JavaScript bundles, not binaries.
- npx expo prebuild --no-install: generate native projects.
- macOS/Xcode: npx expo run:ios for simulator development build.
- Android SDK: npx expo run:android.

Physical iPhone installation requires appropriate Apple signing. No credentials, paid build service or store submission is configured. Use development/release builds rather than Expo Go because Android has a local native selected-phone picker.

## Architecture
- src/domain: pure validation, international phones, import previews, strict backups and queue transitions.
- src/storage: SQLite snapshots and serialized controller. Save succeeds before external handoff.
- src/services: native selected contacts/files, clipboard, share sheet, haptics and guarded wa.me links.
- modules/dearo-contact-picker: permission-free Android system phone picker.
- src/ui: three guided areas, explicit pending confirmation and local data controls.
- src/app: Expo Router entry.

One unresolved handoff has an immutable recipient/message snapshot. Confirmation is scoped to that attempt. Final guest never loops back. Duplicate canonical numbers never silently merge.

## Privacy and scope
No account, server, analytics, WhatsApp login or address-book upload. Android backup disabled; iOS system backup must be checked before device-only claims. Exported backups contain personal details and are not encrypted by Dearo. Clear cannot remove exports, OS snapshots or WhatsApp messages.

One local event, English UI, Unicode invitations. No RSVP server, public preset hosting, guaranteed sender-account selection or bulk-send bypass. All fixtures synthetic; never commit real guests, credentials or signing files.

The bundle identifier com.invitestory.dearo is a development placeholder, not an assertion of domain ownership or App Store registration. Confirm the final identifier before signing/distribution.

## iOS product-completion checkpoint
The app now includes optional persisted onboarding, contextual help, Settings,
local privacy information, persistent haptics, a searchable country picker,
dirty-draft confirmation and render-error recovery. Review requests use the
native system API only after meaningful completed usage, with persisted
cooldown and no satisfaction gate. Native prompts may not appear.

App preferences are separate from event data. Clear/restore retains onboarding
and review cooldown; explicit preferences reset does not erase the event.
Public privacy-policy/support URLs and a real App Store listing are intentionally
unconfigured. See src/product/release.ts and docs/IOS_RELEASE.md before release.

Development server: npm start binds localhost. Do not use a public tunnel or
untrusted Expo plugins/projects with the current toolchain. High dependency
findings remain in build/development paths; see the checked-in audit evidence.
Current independent audits report 35 full-tree / 31 production affected package entries, with two underlying advisories; reduced local runs differ and are documented. These findings are not dismissed merely because their leaf modules were absent from the
inspected mobile bundle. Native/device acceptance and security risk resolution
still prevent a production-ready claim.
