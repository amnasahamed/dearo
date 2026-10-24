import { requireOptionalNativeModule } from 'expo';
export interface PickedPhone { name: string; phone: string; label?: string }
interface NativePicker { pickPhone(): Promise<PickedPhone | null> }
/** This module is intentionally Android-only and requires a development/release build. */
export async function pickAndroidContactPhone(): Promise<PickedPhone | null> {
  const picker = requireOptionalNativeModule<NativePicker>('DearoContactPicker');
  if (!picker) throw new Error('Contact picking needs a Dearo development or release build, not Expo Go. You can still add guests manually or import a CSV or VCF file.');
  return picker.pickPhone();
}
