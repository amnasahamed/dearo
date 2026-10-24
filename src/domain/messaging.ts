import {
  parsePhoneNumberFromString,
  isSupportedCountry,
} from "libphonenumber-js";
import type { CountryCode, Event } from "./types";
import { LIMITS } from "./types";
export function normalizePhone(
  input: string,
  countryCode: CountryCode,
): string {
  if (
    typeof input !== "string" ||
    input.length > 100 ||
    !isSupportedCountry(countryCode)
  )
    throw new Error("Invalid phone number or country");
  const clean = input.trim();
  if (!/^[+\d\s().-]+$/.test(clean))
    throw new Error("Use a phone number without extensions or letters");
  const parsed = parsePhoneNumberFromString(clean, countryCode);
  if (!parsed?.isValid()) throw new Error("Invalid phone number");
  return parsed.number;
}
export function validateInvitationUrl(input: string): string {
  if (
    typeof input !== "string" ||
    input.length > 4096 ||
    /[\u0000-\u001f\u007f]/.test(input)
  )
    throw new Error("Invalid invitation URL");
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error("Enter a complete https:// or http:// invitation URL");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password
  )
    throw new Error(
      "Invitation URL must use HTTP or HTTPS without credentials",
    );
  return url.href;
}
export function prepareMessage(event: Event, guestName: string): string {
  const url = validateInvitationUrl(event.invitationUrl);
  if (
    !event.messageTemplate.trim() ||
    event.messageTemplate.length > LIMITS.message
  )
    throw new Error("Message template is empty or too long");
  const name = guestName.trim() || "Guest";
  const values: Record<string, string> = {
    guest: name,
    link: url,
    event: event.title,
  };
  const rendered = event.messageTemplate.replace(
    /\{(guest|link|event)\}/g,
    (_, key: string) => values[key],
  );
  return event.messageTemplate.includes("{link}")
    ? rendered
    : `${rendered}\n${url}`;
}
export function buildWhatsAppUrl(phone: string, message: string): string {
  if (!/^\+[1-9]\d{6,14}$/.test(phone))
    throw new Error("Recipient must be an E.164 number");
  if (!message || message.length > LIMITS.message + 5000)
    throw new Error("Invalid message");
  return `https://wa.me/${phone.slice(1)}?text=${encodeURIComponent(message)}`;
}
