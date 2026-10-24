/** Supply verified production destinations before store submission. Never invent these. */
export const releaseConfig: {
  privacyPolicyUrl: string | null;
  supportUrl: string | null;
  appStoreId: string | null;
} = {
  privacyPolicyUrl: null,
  supportUrl: null,
  appStoreId: null,
};
export function verifiedHttpsUrl(value: string | null): string | null {
  if (!value || /[\u0000-\u001f\u007f]/.test(value)) return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && !u.username && !u.password
      ? u.toString()
      : null;
  } catch {
    return null;
  }
}
export function appReviewUrl(id: string | null): string | null {
  return id && /^[1-9]\d+$/.test(id)
    ? `https://apps.apple.com/app/id${id}?action=write-review`
    : null;
}
export const privacyNotice = [
  "Dearo keeps your invitation, selected guest names, phone numbers and confirmation history in local app storage. It does not upload your address book, read WhatsApp chats or ask for your WhatsApp password.",
  "Choosing a contact opens the system picker. Only the contact or number you select is used. You can enter details manually or import a file instead. No contacts permission is requested at launch.",
  "Opening WhatsApp shares the selected phone number and prepared invitation text with WhatsApp through its official link. You choose whether to send there. Dearo cannot observe delivery or read receipts.",
  "Backups you export contain personal details and are not encrypted by Dearo. Only export to a destination you trust. Operating-system backups may include local app data on iOS; Android app backup is disabled.",
  "Clear this event removes the local invitation, guests, attempts and unsaved guest drafts. It cannot remove WhatsApp messages, externally saved backups or operating-system snapshots. App preferences and review cooldown are kept separately.",
  "Dearo has no account, advertising, tracking or app analytics. Local usage counters and opaque attempt IDs support a limited system review request. The operating system decides whether to show it; Dearo never knows your rating.",
];
