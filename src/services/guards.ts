/** Helpers are platform-free so safety boundaries can be tested without a device. */
export interface PhoneCandidate { name: string; phone: string; label?: string }
export function phoneCandidates(name: string | null | undefined, phones: readonly { number?: string | null; label?: string | null }[]): PhoneCandidate[] {
  const seen = new Set<string>();
  return phones.flatMap(item => {
    const phone = item.number?.trim();
    if (!phone || seen.has(phone)) return [];
    seen.add(phone);
    return [{ name: name?.trim() || 'Unnamed contact', phone, ...(item.label ? { label: item.label } : {}) }];
  });
}
export function importExtension(name: string): 'csv' | 'vcf' | 'json' {
  const ext = /\.([^.]+)$/.exec(name)?.[1]?.toLowerCase();
  if (ext !== 'csv' && ext !== 'vcf' && ext !== 'json') throw new Error('Choose a CSV, VCF, or JSON file.');
  return ext;
}
export function assertWhatsAppUrl(url: string): void {
  // Only URLs produced by the domain's buildWhatsAppUrl may cross the app boundary.
  if (!/^https:\/\/wa\.me\/[1-9]\d{6,14}\?text=/.test(url)) throw new Error('Invalid WhatsApp handoff URL.');
  const parsed = new URL(url);
  if (parsed.host !== 'wa.me' || parsed.username || parsed.password || parsed.hash || parsed.searchParams.size !== 1 || !parsed.searchParams.get('text')) throw new Error('Invalid WhatsApp handoff URL.');
}
