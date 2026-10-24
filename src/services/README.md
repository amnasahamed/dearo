# Native adapters (Expo SDK 58)

All effects are user-triggered. No address-book scans, background clipboard reads,
contact writes, direct messaging, networking SDK, or message-delivery claims.

## UI contract

- `pickContactPhones()` returns `null` on cancel, `[]` for no phone numbers, or
  `{name, phone, label?}[]`. Show a phone choice when there are multiple numbers;
  pass the chosen raw number through domain validation before saving.
- `pickImportFile()` returns `{name, text, extension}` or `null`. It reads only the
  selected CSV/VCF/JSON file and deletes only its copied app-cache file. The UI
  must distinguish guest imports from backups and preview before changing data.
- `copyText(text)` explicitly writes text. Do not claim a copy until it resolves.
- `shareBackup(json)` writes a temporary JSON file, opens the system share sheet,
  and deletes the temporary file after the sharing API resolves or rejects. It
  returns `share-sheet-closed`, not saved/exported/delivered. The UI must first
  explain that backups are unencrypted and contain guest names/numbers/history.
- `openWhatsApp(url)` accepts only generated HTTPS wa.me URLs. Resolution only
  means OS handoff; sending and outcome confirmation remain manual.
- `optionalHaptic(enabled, kind)` is best effort. Honor the stored preference;
  visual reduced-motion handling belongs to the UI.

## Contact privacy limitation and configuration

Installed expo-contacts 58.0.9 source was inspected. The new iOS
`Contact.presentPicker()` discards the selected CNContact snapshot and returns an
ID. Subsequent `getDetails` queries CNContactStore and can fail without permission.
The supported `expo-contacts/legacy` picker returns the selected snapshot directly,
so iOS uses that real implementation (NOT the deprecated root-module throw stub).

Android uses the local `modules/dearo-contact-picker` Expo module instead of
Expo's full-contact re-query. Android's native phone-number picker performs number
selection, then Dearo queries only the exact returned content URI for the chosen
name, number and label using its temporary read grant. It never reconstructs a
contact URI or queries the address-book collection. Cancellations return null;
unavailable pickers, missing activity, duplicate opens, interruption and rejected
provider access produce actionable errors. The app does not request broad access.

The custom Android module requires a development or release build. It is not
included in Expo Go. The missing-module error explains this and offers manual or
file import. Local Expo autolinking detects the module from the default modules
folder without package.json or app.json changes. TypeScript, pure tests, lint and
autolinking can be validated here; native Kotlin compilation and physical-device
checks remain pending because no Android SDK/Gradle build environment is present.

The Expo Contacts config plugin adds READ_CONTACTS and WRITE_CONTACTS to Android.
For strict least privilege block both with `android.blockedPermissions`; no code
here requests either permission. Use a truthful iOS contacts usage description if
the plugin is configured, but do not add a broad-access permission prompt. Do not
add contact notes entitlement. Clipboard and cache file access need no broad
storage permission. Haptics' Android vibration permission is module-managed.

No native runtime, simulator, physical device, real contacts, or real WhatsApp
messages were used during this implementation. Pure guards are covered by
`tests/services.test.ts`.

References consulted:
- https://docs.expo.dev/versions/v58.0.0/sdk/contacts/
- https://docs.expo.dev/versions/v58.0.0/sdk/filesystem/
- https://docs.expo.dev/versions/v58.0.0/sdk/document-picker/
- https://docs.expo.dev/versions/v58.0.0/sdk/sharing/
- https://docs.expo.dev/versions/v58.0.0/sdk/clipboard/
- https://docs.expo.dev/versions/v58.0.0/sdk/haptics/
- https://reactnative.dev/docs/linking

- https://developer.android.com/guide/components/intents-common#PickContactDat
- https://docs.expo.dev/modules/module-api/#onactivityresult
- https://docs.expo.dev/modules/autolinking/
