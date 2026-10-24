import { pickAndroidContactPhone } from '../../modules/dearo-contact-picker';
import { presentContactPickerAsync } from 'expo-contacts/legacy';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Linking, Platform } from 'react-native';
import { LIMITS } from '../domain/types';
import { utf8ByteLength } from '../domain/limits';
import { assertWhatsAppUrl, importExtension, phoneCandidates } from './guards';
import type { PhoneCandidate } from './guards';
export type { PhoneCandidate } from './guards';

function requireNative(): void {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') throw new Error('This action needs the Dearo iOS or Android app.');
}

/** User-initiated single-record picker. Never requests broad address-book permission. */
export async function pickContactPhones(): Promise<PhoneCandidate[] | null> {
  requireNative();
  // SDK 58's iOS new picker retains only an ID, which loses the selected snapshot.
  // The supported /legacy entry point still returns the native picker snapshot.
  // Never import the same-named deprecated throw stub from expo-contacts itself.
  if (Platform.OS === 'ios') {
    const selected = await presentContactPickerAsync();
    if (!selected) return null;
    return phoneCandidates(selected.name, selected.phoneNumbers ?? []);
  }
  const selected = await pickAndroidContactPhone();
  return selected ? [selected] : null;
}

export interface PickedImportFile { name: string; text: string; extension: 'csv' | 'vcf' | 'json' }
/** Reads only the chosen file; caller must preview and confirm before applying it. */
export async function pickImportFile(): Promise<PickedImportFile | null> {
  requireNative();
  // Some providers mislabel VCF/CSV MIME types. Validate the extension after picking.
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: false, copyToCacheDirectory: true });
  if (result.canceled) return null;
  const asset = result.assets[0];
  if (!asset) return null;
  const file = new File(asset.uri);
  try {
    const extension = importExtension(asset.name);
    const max = extension === 'json' ? LIMITS.backupBytes : LIMITS.importBytes;
    if ((asset.size ?? file.size) > max || file.size > max) throw new Error(`File is too large. Maximum ${max / 1_000_000} MB.`);
    const text = await file.text();
    if (utf8ByteLength(text) > max) throw new Error('File is too large.');
    return { name: asset.name, text, extension };
  } finally {
    // Delete only DocumentPicker's app-cache copy, never the provider's source file.
    if (file.uri.startsWith(Paths.cache.uri) && file.exists) file.delete();
  }
}

/** Explicit clipboard write only. Does not monitor or read the clipboard. */
export async function copyText(text: string): Promise<void> {
  await Clipboard.setStringAsync(text);
}

/** Invoke only after the UI explains that the unencrypted backup includes guest data. */
export async function shareBackup(json: string): Promise<{ status: 'share-sheet-closed' }> {
  requireNative();
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is not available on this device.');
  if (utf8ByteLength(json) > LIMITS.backupBytes) throw new Error('Backup is too large.');
  const file = new File(Paths.cache, `dearo-backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`);
  try {
    file.create({ overwrite: false });
    file.write(json);
    await Sharing.shareAsync(file.uri, { mimeType: 'application/json', UTI: 'public.json', dialogTitle: 'Export Dearo backup' });
    // A closed share sheet is NOT evidence of a saved or delivered backup.
    return { status: 'share-sheet-closed' };
  } finally {
    if (file.exists) file.delete();
  }
}

/** Resolves when the OS accepts the handoff, not when WhatsApp sends a message. */
export async function openWhatsApp(url: string): Promise<void> {
  requireNative();
  assertWhatsAppUrl(url);
  await Linking.openURL(url);
}

/** Best-effort optional feedback. Never blocks core actions on unsupported hardware. */
export async function optionalHaptic(enabled: boolean, kind: 'selection' | 'success' = 'selection'): Promise<void> {
  if (!enabled) return;
  try {
    if (kind === 'success') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else await Haptics.selectionAsync();
  } catch { /* Feedback is optional; UI still announces the result. */ }
}
