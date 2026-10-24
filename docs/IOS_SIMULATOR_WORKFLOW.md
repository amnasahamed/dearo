# Manual iOS simulator build and screenshots

Status: **prepared but not run**. The native compilation/launch gate is still
unverified. No workflow was pushed, dispatched or executed as part of preparing
these files. No screenshots from this workflow exist yet.

`.github/workflows/ios-simulator.yml` has only `workflow_dispatch`, no push, pull
request, schedule or automatic trigger. Its job requires the explicit CI-minutes
approval checkbox. Obtain owner approval before dispatching: private-repository
macOS Actions time and artifact storage may consume included allowances or incur
charges. Source preparation does not authorize execution. The checkbox records an
operator decision, not proof that billing approval has otherwise been obtained.

After authorized publication to the repository's default branch and approval,
open Actions → iOS simulator build and startup screenshots → Run workflow,
choose the reviewed revision and confirm the approval checkbox. It is intentionally
not dispatched by the assistant. The workflow uses read-only repository permission
and does not persist checkout credentials, log in to Apple, access signing
secrets, sign an archive, call EAS, publish an app or send messages.

## What a future run will do

- Use the official macos-15 runner and inspect installed stable Xcode applications;
  select the newest, verify tools/SDK/CocoaPods and record versions. Minimum 16.1
  matches the current installed RN helper; a future SDK may require updating it.
- Select an available installed iPhone from simctl device/runtime JSON. No hardcoded
  device UDID, assumed phone model, simulator download or Apple account is used.
- npm ci from the committed lockfile; Expo iOS prebuild; pod install; unsigned
  Release simulator build of Dearo. Release embeds JS, avoiding a background Metro
  server dependency. Only clean runner/generated native files are modified.
- Boot/install/launch, then capture the screen approximately 5 and 15 seconds after
  launch. Save build results, selected-device details, screenshots and diagnostics
  as a seven-day GitHub artifact. Failed steps still attempt artifact upload.
- Limit job duration to 60 minutes and shut down the selected simulator afterward.

## What it does not prove

A successful command or PNG does not establish that the app rendered correctly.
Inspect screenshots for onboarding/UI versus launch screen or error screen, and
inspect logs for crashes. The workflow does not tap through screens, seed private
contacts, run WhatsApp, validate sending, exercise SQLite corruption/recovery,
check StoreKit prompts, conduct VoiceOver review, or test a physical iPhone.
It does not create a signed device-installable IPA or satisfy App Store review.
The documented dependency-security release blocker remains unchanged.

Runner images, Xcode compatibility, available runtimes, native dependency download
availability and CocoaPods can fail or change. Missing tools/runtime fail clearly;
no fallback silently converts the native gate into a JS-only pass. GitHub must
permit Actions on the repository, the workflow must be present on the default
branch for manual dispatch, and its operator must have the needed repository
permission. No fixed success time or cost is promised.

Source-only validation here: YAML parsed locally, manual-only trigger/read-only
permissions/approval guard checked, embedded Python compiled for syntax and shell
blocks parsed with bash -n. These are not a macOS build or GitHub workflow run.

Official references checked on 2026-10-24:
- Runner tool inventory: https://github.com/actions/runner-images/blob/main/images/macos/macos-15-Readme.md
- Manual dispatch: https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_dispatch
- Expo native generation: https://docs.expo.dev/workflow/continuous-native-generation/

Use the selected runner's `xcrun simctl help` and `xcodebuild -help` if its installed
Apple tooling changes. Do not guess identifiers or introduce credentials to make
the simulator-only workflow pass.
