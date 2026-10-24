# Dearo Android contact phone picker

Local Expo SDK 58 Android module, auto-linked from `modules/`.

`pickAndroidContactPhone()` opens the system phone-number picker and returns one
`{name, phone, label}` or `null` on cancellation. Android performs the phone choice
inside its native picker. The JavaScript service wraps the result in an array to
match the iOS candidate contract.

The native module uses ACTION_PICK with CommonDataKinds.Phone.CONTENT_URI and
CONTENT_TYPE. It queries **only the returned URI**, using the temporary grant
provided by the picker. It never asks for READ_CONTACTS or WRITE_CONTACTS, persists
URI permissions, scans all contacts, writes contacts, or sends messages. A
nonconforming provider is an actionable error, not an escalation to broad access.

This module is not included in Expo Go. Build Dearo with Expo prebuild/EAS or the
local Android development toolchain. Source/API inspection, autolinking,
TypeScript and JavaScript tests are not substitutes for compiling the Kotlin and
testing it on target Android devices.

Device checklist (synthetic contacts only):
- Pick a number from a contact with several numbers; verify chosen number/label.
- Cancel with back; reopen successfully.
- Rapidly tap twice; exactly one picker and a handled busy error.
- Background/resume and rotate while picker is open; no duplicate commits.
- Missing provider or denied URI access: show fallback, never request broad access.
- Fresh install: no full contacts permission dialog; app has no READ/WRITE_CONTACTS.

Reference: https://developer.android.com/guide/components/intents-common#PickContactDat
