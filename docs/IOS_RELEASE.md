# Dearo iOS release readiness

Audit date: 2026-10-24. This is a source/configuration readiness checklist, not an
App Store compliance certification or evidence of an installed iPhone build.
No signing, paid service, App Store Connect creation, upload or publication occurred.

Current security release blocker (13:15 UTC): expanded explicit-registry audits
report 35 high full-tree / 31 high production findings, zero critical. Local
repeated audits return 5/5 on the same lockfile; both sets are retained and the
discrepancy is explained in the reconciliation section. Use the larger counts
for release status, not the earlier five-entry summary.

## Product service contracts

`preferencesRepository.load()` takes no arguments and returns a validated
`ProductPreferences`. It persists first-use defaults and supported schema
migrations before returning. `save(preferences)` validates a serialized snapshot,
then atomically replaces one SQLite row. `clear()` removes only settings. The
separate `dearo-preferences.db` contains onboarding versions, haptics preference,
local review counters, opaque event IDs and review-request timing. It does not
contain guest names, phone numbers, message content or the event snapshot. The
strict parser rejects extra fields. Corrupt settings are preserved and surfaced
as a recovery error instead of silently reset. Failed SQL writes are not announced
as successful. These preferences do not travel in guest/event backup JSON.

`requestNativeReview()` returns `requested` or `unavailable`; it can also reject
on native errors. Neither result indicates that a prompt appeared or a rating was
submitted. Persist `markReviewRequested` before invoking it. Eligibility and
cooldown come from the pure product policy, not foreground/WhatsApp-open events.
Use a calm completion milestone, never a sentiment question, incentive, or custom
rating pre-prompt. Do not wire the native request directly to a Settings button.
An explicit "Write a review" link needs a real App Store listing URL; none has
been invented. Before that URL exists, explain that public reviews are not yet
available rather than open a placeholder.

Installed official package: `expo-store-review ~58.0.2`, selected by Expo SDK 58.
Source inspection confirms StoreKit `AppStore.requestReview(in:)` on iOS 16+ and
an availability check that disables native review requests for TestFlight builds.
A TestFlight run therefore cannot prove that the production review sheet appears.

## Privacy manifest audit

Inspected the existing generated `ios/Dearo/Info.plist`, Podfile, and installed
package manifests. The initial prebuild had no app-level PrivacyInfo.xcprivacy. The supported
app-level aggregate below was then added to app.json. A fresh iOS prebuild
--no-install succeeded, and ios/Dearo/PrivacyInfo.xcprivacy was parsed and verified
to exactly match app.json, with Xcode Resources membership confirmed. CocoaPods
installation and Xcode archive have not run on this Linux host. The generated
Podfile also enables dependency aggregation; the eventual archive still needs
verification. Generated native files remain regeneration output, not hand-edited
source.

Declared required-reason APIs in the installed dependencies:

- expo-file-system: FileTimestamp `0A2A.1`, `3B52.1`; DiskSpace `E174.1`, `85F4.1`.
- React Native core, cxxreact, Folly, glog, boost: FileTimestamp `C617.1`.
- React Native timing and boost: SystemBootTime `35F9.1`.
- React Native core, expo-constants, expo-system-ui: UserDefaults `CA92.1`.
- Those manifests declare no collected-data types and no tracking. This describes
  the inspected manifests, not an automatic declaration for the whole app.
- expo-store-review has no additional bundled PrivacyInfo.xcprivacy in the
  installed package. Its native implementation invokes system StoreKit APIs.

### Implemented app configuration

The following is configured under `expo.ios.privacyManifests`.
These are the exact union of reasons already declared by installed dependencies;
re-audit them after dependency changes and validate applicability for the shipped
app. No permission prompt, tracking authorization or new data access is enabled
by these manifest declarations.

```json
{
  "NSPrivacyTracking": false,
  "NSPrivacyTrackingDomains": [],
  "NSPrivacyCollectedDataTypes": [],
  "NSPrivacyAccessedAPITypes": [
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryFileTimestamp",
      "NSPrivacyAccessedAPITypeReasons": ["0A2A.1", "3B52.1", "C617.1"]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryDiskSpace",
      "NSPrivacyAccessedAPITypeReasons": ["E174.1", "85F4.1"]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategoryUserDefaults",
      "NSPrivacyAccessedAPITypeReasons": ["CA92.1"]
    },
    {
      "NSPrivacyAccessedAPIType": "NSPrivacyAccessedAPICategorySystemBootTime",
      "NSPrivacyAccessedAPITypeReasons": ["35F9.1"]
    }
  ]
}
```

`NSPrivacyCollectedDataTypes: []` and tracking false are supported by the current
local-only implementation and inspected SDK declarations, but must be reassessed
against the final binary, any added telemetry/SDKs, and actual developer/partner
access. App Store privacy answers are separate from the manifest. Apple defines
collection around off-device transmission accessible beyond real-time servicing;
local storage is not by itself proof of collection. Review the explicit wa.me
handoff, selected backup-share destination and any support workflow when making
those answers. Do not copy a blanket "no data ever leaves the device" claim.

Keep the existing truthful contact purpose string. iOS reads only the selected
native picker snapshot, without a full-address-book request. Keep Android
READ_CONTACTS/WRITE_CONTACTS blocked. Do not add contact notes entitlement or ATT
unless the actual product changes to require it.

No StoreReview config plugin or App Store numeric ID is needed for the native
request. Once verified, set `ios.appStoreUrl` to the actual public listing for an
explicit store-review link. Confirm the provisional bundle identifier
`com.invitestory.dearo` belongs to the intended publisher before registering/signing.
Increment `ios.buildNumber` for distribution builds. Recheck the existing
`ITSAppUsesNonExemptEncryption: false` against actual shipped crypto and Apple's
export-compliance questions; do not change it based only on a JavaScript bundle.

## User-facing privacy and support prerequisites

- Provide a real, reachable privacy-policy URL and support URL/contact owned by
  the publisher. They are not supplied or fabricated in this repository.
- Policy must explain local guest/event/settings storage, selected contact import,
  manual WhatsApp handoff, clipboard writes, user-chosen unencrypted backup exports,
  explicit clear/reset boundaries, and any system backups. Clearing Dearo cannot
  delete copies already shared, copied, backed up by the OS, or sent in WhatsApp.
- Inspect actual iOS SQLite directory and system-backup behavior on device before
  making promises about no cloud backup. No app-level SQLCipher encryption is
  configured; rely only on verified OS protection claims.
- Do not present a host's brand identity, support address, App Store account,
  numeric listing ID, or store URL as verified until the owner supplies/verifies it.
- Complete accurate App Store Connect privacy disclosures, age rating, review
  notes, screenshots, accessibility descriptions and publisher/contact metadata.

## Required validation before distribution

1. Run typecheck, lint, pure/mocked service tests, rendered UI tests and iOS bundle
   export. These do not exercise native SQLite or StoreKit.
2. Regenerate native files from config with Expo prebuild. Inspect the app-level
   generated manifest and Info.plist. Never maintain manual edits to generated
   native folders. Confirm StoreReview autolinks into the Apple target.
3. On macOS, install Pods, compile with a currently supported Xcode/iOS SDK, inspect
   the app archive's privacy manifests/aggregated privacy report and SDK signatures,
   and run Xcode validation. Resolve actual warnings before distribution.
4. Sign only after authorized Apple developer/team setup. Verify real iPhone/iPad
   cold start, app restart, SQLite failures, corrupted settings recovery, onboarding
   skip/replay/version upgrade, haptics persistence and dynamic type/VoiceOver.
5. With synthetic guests, exercise selected contact/number, import, export cancel,
   WhatsApp handoff/return/kill, pending-attempt recovery and explicit confirmation.
   No delivery state may come from AppState resume or a successful deep link.
6. Verify review eligibility/cooldown across restart and unavailable/rejected native
   calls. A suppressed prompt must not cause repeated attempts or a "rated" state.
7. Obtain publisher approval for privacy/support/store details, archive and submit
   through the authorized release workflow. Inspect actual App Store/TestFlight
   validation findings. This repository has not completed those steps.

## Official references consulted

- Expo SDK 58 StoreReview: https://docs.expo.dev/versions/v58.0.0/sdk/storereview/
- Expo privacy manifests: https://docs.expo.dev/guides/apple-privacy/
- Apple privacy manifests: https://developer.apple.com/documentation/bundleresources/privacy-manifest-files
- Apple required-reason APIs: https://developer.apple.com/documentation/bundleresources/describing-use-of-required-reason-api
- Apple app privacy details: https://developer.apple.com/app-store/app-privacy-details/
- Apple ratings/reviews guidance: https://developer.apple.com/design/human-interface-guidelines/ratings-and-reviews/

Apple's JS-rendered API/HIG pages were discoverable but their full prose could not
be extracted in this environment. Implementation claims above are grounded in the
readable Expo documentation and installed Swift source, not assumed Apple wording.

## Dependency security and splash checkpoint (2026-10-24, 13:09 UTC)

- Installed official SDK-compatible `expo-splash-screen ~58.0.11` using Expo's
  package resolver. App config uses existing `assets/icon.png` (white Dearo mark
  on cobalt #2458EE), imageWidth 180, contain mode and white background. No forced
  timer or custom startup animation was added. The app is light-only, so a
  redundant dark override was removed after the first prebuild warned about it.
- Final iOS prebuild --no-install succeeded without that warning. Generated
  storyboard references SplashScreenLogo with aspect-fit content mode, and its
  image/color asset sets exist with white background. PrivacyInfo.xcprivacy still
  exactly matches configured declarations. Release-device appearance remains
  untested; Expo warns that development/Expo Go appearances can differ.
- `npx expo install --check` reported dependencies up to date against installed
  SDK58 compatibility metadata (offline metadata mode explicitly warned that
  validation is less reliable). Online `npx expo-doctor` completed **20/20 checks**.
- A fresh iOS Hermes bundle export with source maps succeeded (1,364 bundled
  modules; 1,343 source-map entries). The emitted source list contains no
  node-forge, zod or @expo/code-signing-certificates. One @expo/cli runtime helper
  is included: build/metro-require/require.js. It is the Metro module loader, not
  the affected certificate/schema-validation paths. This supports a tooling-only
  exposure assessment for the identified vulnerable leaves in this particular
  mobile JS bundle, not a clean audit or a substitute for native/archive review.

### Unresolved npm findings, not silently suppressed

Earlier 13:09 ordinary-registry snapshots reported **5 high, 0 critical**
findings (superseded as the release summary by the reconciliation below): node-forge, zod, @expo/code-signing-certificates, @expo/cli,
and expo. The last three are propagated dependency-chain findings, not three
additional distinct advisories. No moderate/low findings were returned.

npm classifies the Expo CLI chain as production dependencies because `expo` is a
production dependency, although these affected paths are build/development tools.
Zod is also used by ESLint's hooks tooling. Both full and omit-dev audits must
remain visible; do not relabel any omit-dev report as zero vulnerabilities.

- node-forge 1.4.0: RSA signature verification advisory
  https://github.com/advisories/GHSA-86w9-cpqp-85rv . The advisory lists no patched
  release, and the ordinary registry reports 1.4.0 as latest. Installed Expo CLI
  and code-signing-certificates require ^1.4.0. No compatible fix was available.
- zod 3.25.76: memory-exhaustion advisory
  https://github.com/advisories/GHSA-mrhx-c7xc-m3w5 . Fix begins at 4.6.6; registry
  latest was 4.6.7. Installed Expo CLI58.1.15 requires ^3.25.76. Forcing Zod4 would
  violate the consuming dependency's major-version range and was not attempted.
- npm suggested downgrading Expo to 44.0.6, an incompatible major downgrade. It
  was deliberately rejected. No blanket audit fix, override, major migration or
  unsupported vendored patch was applied.

These are unresolved tooling/CI security risks, especially when handling hostile
project/configuration/certificate input. Keep development servers private, avoid
untrusted projects/inputs, and do not consider audit output cleared. Before a
public release, obtain a patched compatible upstream toolchain or an explicit,
reviewed risk decision based on actual use. Re-run audits on the final lockfile
and registry advisories; availability and severity can change. No vulnerability
exploit or real signing operation was run during this review.

Splash reference: https://docs.expo.dev/versions/v58.0.0/sdk/splash-screen/

## Device family and configuration
This hardening checkpoint targets iPhone, with supportsTablet=false and initial
build number 1. It does not claim iPad layout acceptance. The bundle identifier
remains provisional until a verified developer account and distribution plan
are supplied. Future-version event/preferences data is preserved and reports
an update-required condition rather than silently migrating downward.

The default npm start script explicitly binds Metro to localhost. For simulator
work, start that server first and use `npx expo run:ios --no-bundler` when suitable.
Do not expose a public tunnel or rely on LAN defaults as a security mitigation.
Physical-device development connectivity needs a separately considered private
setup. No server was opened publicly during this task.

## Detailed security reachability and upstream evidence (13:13 UTC)

Current raw full/production audit outputs and selected public registry metadata
are preserved in [evidence/README.md](evidence/README.md), with capture time and
SHA-256 hashes. These 13:13 local snapshots reported five high findings; the subsequent
reconciliation below records a larger independent result on the identical lock.
This is a release blocker pending compatible upstream remediation or a documented
security owner decision; mobile source-map absence alone does not resolve it.

### Actual dependency chains

- Runtime-declared `expo@58.0.19` -> bundled `@expo/cli@58.1.15` ->
  `node-forge@1.4.0` directly, and through `@expo/code-signing-certificates@0.0.7`.
- The same CLI requires `zod ^3.25.76`, installed as 3.25.76.
- Development-only `eslint-config-expo@58.0.4` ->
  `eslint-plugin-react-hooks@7.1.1` also uses Zod3 (including zod-validation-error).
- The three ancestor entries in the earlier five-entry snapshots propagate the two vulnerable leaf findings; the later expanded reports add more ancestors/peers.
  npm's production classification is retained in the report, despite identifying
  the inspected affected functionality as developer/build-tool code.

### node-forge: reachability is conditional, not demonstrated exploitation

GHSA-86w9-cpqp-85rv / CVE-2026-85393 concerns malformed RSA PKCS#1 v1.5 signature
verification with extra nested DigestAlgorithm elements. The upstream report
identifies low-public-exponent keys, e.g. exponent 3, as an exploitation condition.
An attacker must get a crafted signature/certificate into an affected verification
path with applicable key conditions. Parsing a PEM or merely installing the
library does not alone demonstrate that bypass.

Installed source exposes relevant verification sites in
`@expo/code-signing-certificates/build/main.js`: `validateSelfSignedCertificate`
calls certificate.verify; `signBufferRSASHA256AndVerify` verifies a freshly generated
local signature; `generateDevelopmentCertificateFromCSR` verifies a CSR. These are
not equivalent attack surfaces: a self-check of an honestly locally generated
signature does not establish attacker control, while accepting untrusted CSR or
certificate material requires explicit trust-boundary review.

The CLI's `build/src/utils/codesigning.js` invokes self-signed validation when
loading a project's configured updates.codeSigningCertificate and corresponding
private-key path. That code additionally checks key correspondence, extensions
and validity. Manifest middleware invokes its signing helper when code-signing
information is available. The generic CSR-to-development-certificate helper is
present in the library but no call from Dearo app code was found. CLI iOS
`run/ios/codeSigning/Security.js` parses a certificate returned by the system
security tool; the inspected function does not itself call RSA verify.

Dearo does not configure OTA code-signing certificates/private-key paths or import
these helpers in its mobile source. A future signing workflow, hostile local
project/certificate input or a service using the CSR helper could change exposure.
No exploit was attempted, and this inspection does not prove all CLI/service paths
safe. Do not process untrusted project/signing inputs with this toolchain.

Upstream evidence:
- GHSA affected range <=1.4.0 and no patched release:
  https://github.com/advisories/GHSA-86w9-cpqp-85rv
- Upstream Forge proposed fix #1152 was still open when inspected:
  https://github.com/digitalbazaar/forge/pull/1152
- Registry metadata captured here reports latest node-forge as 1.4.0. Thus an
  official fixed-version claim cannot honestly be made. No unmerged patch was
  installed, and no unsupported fork was substituted.

### Zod: concrete developer-tool collection parsing paths

GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404 reports memory exhaustion during large
collection validation. A hostile actor needs to influence a sufficiently large
collection reaching the vulnerable parser and exhaust the process resources.
This report does not assume every Zod call is remotely exposed.

The installed CLI's `start/server/DevToolsPlugin.schema.js` defines arrays for
plugin commands, command parameters and output lines. `DevToolsPlugin.js` validates
plugin configuration, `DevToolsPluginCliExtensionResults.parseOutputText` parses
plugin JSON output through DevToolsPluginOutputSchema.safeParse, and
`MCPDevToolsPluginCLIExtensions.js` validates executed extension results. These are
concrete collection-parsing entry points in developer-tool/plugin workflows.
The output accumulator has a V8 maximum-string-length cap, but that is not a
small element-count budget and does not establish that hostile output cannot
exhaust memory during parsing. Plugin/extension inputs must remain trusted and
development/MCP services must not be exposed to untrusted callers. This inspection
does not claim an unauthenticated network exploit or that such plugins are enabled
in Dearo's release app.

Dearo's guest CSV/VCF/backup parsers use their own bounded validation, not Zod; the
inspected mobile source map contains no Zod source. That limits the identified
mobile JS path but does not waive the CLI/lint/CI dependency finding.

Fixed-version evidence is stronger than merely querying the latest tag:
- Reviewed advisory declares patched version 4.6.6:
  https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- Maintainer release v4.6.6 explicitly includes fix commit a0ebf97 / PR6652:
  https://github.com/colinhacks/zod/releases/tag/v4.6.6
- Maintainer PR6652 is merged and changes collection size-bound checks before
  element parsing: https://github.com/colinhacks/zod/pull/6652
- Public npm metadata confirms 4.6.6 exists and latest is 4.6.7. Both are outside
  installed Expo CLI's ^3.25.76 constraint. No compatible patched Zod3 version is
  identified by the advisory; no major override was imposed.

The full audit's suggested Expo44 downgrade is incompatible with this SDK58 app.
Retest a supported upstream Expo/CLI release when it adopts patched dependencies;
then rerun both audits, Expo compatibility/doctor, source tests, bundle inspection
and native release validation. Keep these unresolved findings visible until then.

## Current audit reconciliation (2026-10-24, 13:15 UTC)

**Use 35 high findings for the full dependency tree and 31 high for production
(omit-dev), zero critical, as the conservative current release status.** The
retained expanded raw reports were captured at 13:14:21Z and 13:14:34Z respectively
using explicit https://registry.npmjs.org. They are now the canonical
`evidence/npm-audit.json` and `evidence/npm-audit-production.json`.

Do not hide the discrepancy: the local repeated run with the same explicit registry
and npm11.9.0 still reported 5/5, including a new dedicated empty-cache run at
13:15. Both expanded and reduced reports use the identical lockfile SHA-256
`e8955d053b20492d244b391891513c13e405dd9e0de89f69ab7b6c02b8636315`.
The reduced explicit-registry and fresh-cache results are separately retained,
as are the original 13:13 snapshots. No dependencies were changed during this
comparison. An empty cache did not eliminate the discrepancy, so a stale-cache
explanation is **not established**.

The expanded reports add ancestor/peer meta-vulnerability entries across Expo
modules and dev tooling. Machine comparison confirms both sets contain exactly
the same two underlying advisory URLs: GHSA-86w9-cpqp-85rv (Forge) and
GHSA-mrhx-c7xc-m3w5 (Zod). The exact reason npm produced differing propagation
counts is unresolved; it is not evidence of 35 distinct exploit primitives or
of vulnerabilities disappearing. Preserve both methodologies and rerun in the
release CI environment. Audit `fixAvailable` booleans do not prove a proposed
change is compatible or will remove every propagated entry.

The conservative release blocker remains. Neither a five-entry local result,
mobile bundle leaf absence, nor successful Expo Doctor is a waiver of the
expanded 35/31 current security evidence.

The manual GitHub workflow includes a separate high-severity production audit
gate. It is expected to fail with the unresolved advisory tree rather than hide
that risk behind passing software tests. It has not run on GitHub. Android
source configuration also removes unused broad external-storage and overlay
permissions, in addition to READ/WRITE_CONTACTS; document and phone selection
use operating-system-granted URIs instead. Merged release-manifest verification
remains part of native acceptance.
