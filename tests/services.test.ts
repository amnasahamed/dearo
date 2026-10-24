import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertWhatsAppUrl, importExtension, phoneCandidates } from '../src/services/guards';
test('contact candidates preserve number choice and deduplicate exact numbers', () => {
  assert.deepEqual(phoneCandidates('  Ada  ', [{ number: '+15551234567', label: 'mobile' }, { number: '+15551234567' }, { number: ' ' }, { number: '+442079460018', label: 'work' }]), [{ name: 'Ada', phone: '+15551234567', label: 'mobile' }, { name: 'Ada', phone: '+442079460018', label: 'work' }]);
  assert.deepEqual(phoneCandidates(null, []), []);
});
test('import allows only supported extensions case-insensitively', () => {
  for (const ext of ['csv', 'vcf', 'json'] as const) assert.equal(importExtension(`guests.${ext.toUpperCase()}`), ext);
  for (const name of ['guests.exe', 'csv', 'guests.csv.exe']) assert.throws(() => importExtension(name));
});
test('WhatsApp boundary rejects arbitrary endpoints, parameters and fragments', () => {
  assert.doesNotThrow(() => assertWhatsAppUrl('https://wa.me/15551234567?text=Hello%20Ada'));
  for (const url of ['http://wa.me/15551234567?text=a', 'https://wa.me.evil/15551234567?text=a', 'https://wa.me/15551234567?text=', 'https://wa.me/15551234567?text=a&other=b', 'https://wa.me/15551234567?text=a#x', 'whatsapp://send']) assert.throws(() => assertWhatsAppUrl(url));
});

test('Android adapter reads only picker-granted URI and uses local autolink config', async () => {
  const { readFile } = await import('node:fs/promises');
  const source = await readFile(new URL('../modules/dearo-contact-picker/android/src/main/java/expo/modules/dearocontactpicker/DearoContactPickerModule.kt', import.meta.url), 'utf8');
  assert.match(source, /setDataAndType\(Phone.CONTENT_URI, Phone.CONTENT_TYPE\)/);
  assert.match(source, /contentResolver.query\(uri, projection, null, null, null\)/);
  assert.doesNotMatch(source, /contentResolver.query\(Phone.CONTENT_URI|requestPermissions\(|takePersistableUriPermission\(/);
  assert.match(source, /if \(pending != null\)/);
  assert.match(source, /payload.resultCode != Activity.RESULT_OK/);
  const manifest = await readFile(new URL('../modules/dearo-contact-picker/android/src/main/AndroidManifest.xml', import.meta.url), 'utf8');
  assert.doesNotMatch(manifest, /<uses-permission/);
  const config = JSON.parse(await readFile(new URL('../modules/dearo-contact-picker/expo-module.config.json', import.meta.url), 'utf8'));
  assert.deepEqual(config.android.modules, ['expo.modules.dearocontactpicker.DearoContactPickerModule']);
});
