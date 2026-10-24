# Dearo iOS hardening verification

Updated 24 October 2026, 13:27 UTC. This is a production-oriented source checkpoint,
not a production-ready signed release. The earlier MVP checkpoint is preserved
separately; this report describes the expanded onboarding, settings and iOS UX scope.

## Passing software gates
- Strict TypeScript and Expo ESLint: clean.
- 79 pure/domain/controller/service/presentation/configuration tests pass.
- 44 rendered interaction tests across six suites pass under jest-expo and React
  Native Testing Library. Native services and storage are mocked.
- Expo Doctor: 20/20 checks passed on the installed dependency set.
- iOS and Android Hermes bundles export successfully after the visual refinement
  pass.
- Expo prebuild generates both native projects. No Xcode/CocoaPods or Android
  native compilation is claimed.
- Opaque 1024px RGB PNG icon validated; branded splash assets generated.
- iPhone-only TARGETED_DEVICE_FAMILY=1 verified. Generated PrivacyInfo.xcprivacy
  equals app.json declarations and belongs to Xcode Resources.
- Android app backup is disabled. Broad contact, external-storage and overlay
  permissions are explicitly removed; only selected picker URI access is used.
- Import/review lists are virtualized. Synthetic 5,000-row rendered tests verify
  no more than 20 initial actions and that the final row is not eagerly rendered.
- Independent source reviews closed the discovered P1 product defects. Reference-
  informed visual choices are documented in DESIGN_REFERENCES.md, not copied assets.

## Representative regression coverage
- Persist-before-handoff, no automatic sent status, stale-attempt rejection,
  immediate double tap, exact retry, final guest stop, failed save/no launch.
- Strict backups, duplicate number/name resolution, history-protected phone
  editing, incomplete restored event, atomic event reset and transient cleanup.
- Onboarding skip/finish, saved skip across relaunch, failure escape without event
  mutation, review suppression until explicit preferences recovery.
- Serial read-transform-save preferences, known migration, corrupt-state
  preservation, event clear/restore retaining independent app preferences.
- Seven-day/two-queue/five-unique-confirmation eligibility, 120-day cooldown,
  persisted request timestamp before native API, no first-day/pending prompt,
  and stale completion invalidation after clear/restore.
- Native haptics switch checked/disabled state and busy guard, local privacy/help,
  disabled unconfigured support/review links, country search, dirty-sheet discard,
  render-error recovery, honest Back semantics and empty-search distinction.

## Security gate: unresolved
The conservative independent explicit-registry outputs report **35 high full-tree
and 31 high production affected package entries, zero critical**, from two leaf
advisories. Repeated local npm 11.9 runs on the same lockfile report 5/5; all outputs,
timestamps, hashes and the unresolved propagation discrepancy are retained in
docs/evidence. These are not 35 distinct vulnerabilities.

No compatible published fix was verified for the complete installed toolchain.
No unsupported Zod major override or Expo downgrade was forced. The affected
leaf modules were absent from the inspected iOS JS source map, but that does not
prove build/CI safety. IOS_RELEASE.md documents call paths, attacker prerequisites,
maintainer evidence and mitigations. Patched upstream dependencies or a reviewed
security decision remain a release gate. npm start defaults to localhost; no
public tunnel or real signing operation was performed.

## Not run / release blockers
- macOS/Xcode native compile, simulator runtime, code signing, IPA creation and
  physical iPhone installation. This execution host is Linux.
- Actual native SQLite I/O, selected contacts, file/share sheet delivery,
  StoreKit behavior and WhatsApp switching/termination recovery on a device.
- VoiceOver focus, largest Dynamic Type sizes, small-screen keyboard layouts,
  native press feedback, actual 5,000-row responsiveness and iOS backup behavior.
- Android Kotlin/Gradle compilation and physical-device acceptance; no SDK here.
- Real public privacy-policy/support URLs, verified App Store listing/developer
  identity, final bundle identifier and App Store privacy-label review.
- GitHub publication and GitHub-hosted CI: repository authentication/destination
  remain pending. The workflow is manual-trigger only and has not run there. Its separate high-severity audit gate is expected to fail until the recorded dependency risk is resolved.

No store submission, paid build service, credential creation, real guest import,
real message send or public deployment occurred.

## Reproduction and acceptance
npm ci; npm run check; npm run export:native; npx expo-doctor;
npx expo prebuild --no-install. Generated ios/android and dist are not versioned.
Review IOS_RELEASE.md and SRS.md before any distribution step. On macOS, start a
private local Metro server and build with the appropriate verified signing setup.

Device checks must record device/OS/build and cover: fresh launch/skip; denied
contacts/manual fallback; valid/invalid import; no-send return; explicit confirm;
app termination during handoff; first/last guest; duplicate retries; storage and
backup failure; corrupt/future data; accessibility and keyboard; review no-display;
clear/restore; configured legal/support links. A bundle or rendered test is not
substitute evidence for any of these native gates.

## Browser QA follow-up — 2026-10-24 13:52 UTC

- Latest `npm run check`: typecheck/lint clean, **79 core + 45 rendered interaction tests passed**.
- New production fix: invitation continuation stays outside the scrollable form, with save regression.
- Isolated preview builds and passes its separate TypeScript/lint checks; root production checks do not require preview dependencies.
- Actual UI browser screenshots and exercised flows documented in `BROWSER_QA.md`. All native service boundaries mocked; no iOS validation claim.
- iOS Hermes export rerun successfully after the footer change. This is not native compilation.
- Main dependency lockfile unchanged; existing advisory/release gates remain.
