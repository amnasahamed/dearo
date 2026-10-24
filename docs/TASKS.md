# Dearo work tracker

Updated: 2026-10-24 13:27 UTC. States: pending, in_progress, review, done, blocked. Software completion is distinct from device acceptance. Parent owns the authorized 30-minute review and repository creation.

| ID | Task | Owner | Depends | State | Evidence / next action |
| --- | --- | --- | --- | --- | --- |
| D01 | SRS and acceptance baseline | build lead | — | done | SRS §14 reviewed; scoped precision issues resolved |
| D02 | Native scaffold/toolchain | build lead | D01 | done | Expo 58.0.19, Doctor 20/20, both native bundles and prebuild |
| D03 | Domain, queue and imports | domain worker | D01 | done | 33 domain tests including boundary and history-lock cases |
| D04 | Durable local repository | build lead | D02,D03 | done | SQLite adapter; nine mocked controller sequencing/failure tests; native I/O in D13 |
| D05 | Invitation and guest screens | build lead | D02,D03 | done | Guided native UI; rendered interaction tests pass |
| D06 | Native contact/file selection | services worker | D02,D03 | done | Selected-only adapters, 4 service checks; native acceptance D13 |
| D07 | Handoff and recovery UI | build lead | D04,D05 | done | Attempt-scoped confirmation; rendered lifecycle-neutrality and double-tap tests pass |
| D08 | Backup, restore and privacy | build lead | D04 | done | Strict validation, atomic replacement, transient cleanup; device share acceptance D13 |
| D09 | Accessibility and polish | build lead | D05,D07 | done | Implemented labels, 54-point targets, reduced-motion awareness; real audit D13 |
| D10 | Automated and native build checks | build lead | D03-D09 | done | 54 core + 7 rendered tests pass, typecheck/lint, Doctor, bundles/prebuild; binary/device gates D13 |
| D11 | Independent review and fixes | reviewers | D10 | done | Seven findings fixed/reverified, regressions pass; no remaining P0/P1 in reviewed scope |
| D12 | Publish verified main | parent/lead | D11 | blocked | Repository creation/login pending; await verified destination |
| D13 | Real-device acceptance and distribution | parent/lead | D10 | blocked | No macOS/Xcode/iPhone signing or Android SDK; not a signed IPA |

## Checkpoint protocol
1. Read this tracker, SRS and VERIFICATION.md, and compare actual source/tests.
2. Do not mark a task done without evidence. Distinguish bundle/build/device verification.
3. Continue the next unblocked dependent task. Parallelize only independent file ownership.
4. Report a user-visible update only for a useful milestone, blocker or decision.
5. Stop before store publication, paid services, persistent credential setup or real guest messaging without appropriate approval.

## iOS production-oriented hardening (new user scope)
The original D01-D11 checkpoint is superseded by these active gates. Do not call the expanded phase complete while any H task remains in progress/review.

| ID | Task | State | Evidence / next action |
| --- | --- | --- | --- |
| H01 | Optional persisted onboarding | done | Skip/finish, persistence, failure escape and suppression regressions pass |
| H02 | Serialized preferences and native reviews | done | Positive/stale/concurrent/cooldown tests pass; actual StoreKit remains H08 |
| H03 | Settings, privacy, support, recovery | done | Grouped rows, native switch, local help/privacy and explicit recovery tested; public destinations H08 |
| H04 | iPhone accessibility and input UX | done | Dirty dismissal, country picker, labels/announcements, virtualized lists and reference-driven hierarchy tested; native audit H08 |
| H05 | Branding, manifests, dependencies | blocked | Icon/splash/manifest verified; security assessment complete but unresolved dependency risk remains H08 |
| H06 | Full regression and independent HIG review | done | 79 core + 44 rendered tests, clean types/lint, Doctor20/20, bundles/prebuild; scoped reviews closed |
| H07 | Refresh source archive and documentation | done | New dearo-ios-hardening-source.zip; prior MVP archive preserved; release blockers remain explicit |
| H08 | Production distribution acceptance | blocked | Toolchain security risk, verified privacy/support/store identity, macOS signing/native compile and physical-device acceptance |

## Browser visual QA follow-up

| ID | Task | State | Evidence / next action |
| --- | --- | --- | --- |
| V01 | Isolated actual-UI browser harness | done | `preview/` uses the real UI with synthetic in-memory native adapters; no production web target |
| V02 | Inspect screenshots and exercise compact flow | done | `docs/BROWSER_QA.md`; 390/320px frames, manual handoff/confirmation and invalid phone recovery |
| V03 | Keep invitation continuation visible | done | Separate action footer; 45 rendered tests pass, including save regression |
| V04 | Prepare optional macOS simulator workflow | done | Manual-only approval-guarded source workflow; static syntax validated, never run |
| V05 | Refresh source and verification evidence | done | dearo-ios-visual-qa-source.zip; 79 core + 45 rendered tests, preview checks and new iOS bundle pass; native release gates unchanged |
