import type {
  AppState,
  CountryCode,
  Guest,
  ImportDecision,
  ImportPreview,
  ImportRow,
} from "./types";
import { LIMITS } from "./types";
import { utf8ByteLength } from "./limits";
import { normalizePhone } from "./messaging";
function csvRecords(text: string): string[][] {
  const records: string[][] = [];
  let record: string[] = [],
    field = "",
    quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (!quoted && field.length)
        throw new Error("Unexpected CSV quote");
      else {
        if (
          quoted &&
          i + 1 < text.length &&
          ![",", "\r", "\n"].includes(text[i + 1])
        )
          throw new Error("Unexpected text after CSV quote");
        quoted = !quoted;
      }
    } else if (!quoted && (c === "," || c === "\n")) {
      record.push(field);
      field = "";
      if (c === "\n") {
        records.push(record);
        record = [];
      }
    } else if (c !== "\r" || quoted) field += c;
  }
  if (quoted) throw new Error("Unclosed CSV quote");
  if (field || record.length) {
    record.push(field);
    records.push(record);
  }
  return records;
}
function decodeVcf(value: string): string {
  return value.replace(/\\n/gi, " ").replace(/\\([,;\\])/g, "$1");
}
export function importContactsPreview(
  text: string,
  format: "csv" | "paste" | "vcf",
  countryCode: CountryCode,
  existing: Guest[] = [],
): ImportPreview {
  if (typeof text !== "string" || utf8ByteLength(text) > LIMITS.importBytes)
    return { rows: [], errors: ["Import exceeds the 1 MB limit"] };
  let records: [string, string][] = [];
  try {
    if (format === "csv") {
      const parsed = csvRecords(text.replace(/^\uFEFF/, "")).filter((r) =>
        r.some((s) => s.trim()),
      );
      const header = parsed[0]?.map((s) => s.trim().toLowerCase()) ?? [];
      const nameIndex = header.findIndex((s) =>
        ["name", "full name", "guest"].includes(s),
      );
      const phoneIndex = header.findIndex((s) =>
        ["phone", "number", "mobile", "telephone"].includes(s),
      );
      if (nameIndex >= 0 && phoneIndex >= 0) parsed.shift();
      records = parsed.map((r) => [
        r[nameIndex >= 0 && phoneIndex >= 0 ? nameIndex : 0] ?? "",
        r[nameIndex >= 0 && phoneIndex >= 0 ? phoneIndex : 1] ?? "",
      ]);
    } else if (format === "paste") {
      records = text
        .split(/\r?\n/)
        .filter((l) => l.trim())
        .map((line) => {
          try {
            normalizePhone(line.trim(), countryCode);
            return ["", line.trim()];
          } catch {
            /* A named row is parsed below. */
          }
          const separated = line.split(/\t|,/);
          if (separated.length > 1)
            return [separated[0].trim(), separated.slice(1).join(" ").trim()];
          const match = line.match(/^(.*?)\s+(\+?[\d(][\d\s().-]{6,})$/);
          if (match) return [match[1].trim(), match[2].trim()];
          return ["", line.trim()];
        });
    } else if (format === "vcf") {
      const unfolded = text.replace(/\r?\n[ \t]/g, "");
      const cards: string[] = [];
      let current: string[] | null = null;
      for (const line of unfolded.replace(/^\uFEFF/, "").split(/\r?\n/)) {
        if (line.trim().toUpperCase() === "BEGIN:VCARD") {
          if (current) throw new Error("Nested vCard is malformed");
          current = [];
        } else if (line.trim().toUpperCase() === "END:VCARD") {
          if (!current) throw new Error("Unexpected vCard end");
          cards.push(current.join("\n"));
          current = null;
        } else if (current) current.push(line);
        else if (line.trim()) throw new Error("Unexpected text outside vCard");
      }
      if (current) throw new Error("Incomplete vCard");
      if (!cards.length) throw new Error("No complete vCards found");
      for (const card of cards) {
        let name = "";
        const numbers: string[] = [];
        for (const line of card.split(/\r?\n/)) {
          const colon = line.indexOf(":");
          if (colon < 0) continue;
          const key = line.slice(0, colon).toUpperCase();
          const value = line.slice(colon + 1);
          if (key.includes("ENCODING="))
            throw new Error(
              "Encoded vCard fields are unsupported; use plain-text vCard or CSV",
            );
          if (/^FN(?:;|$)/.test(key)) name = decodeVcf(value);
          if (/^(?:ITEM\d+\.)?TEL(?:;|$)/.test(key))
            numbers.push(value.replace(/^tel:/i, ""));
        }
        if (!numbers.length) records.push([name, ""]);
        for (const number of numbers) records.push([name, number]);
      }
    } else throw new Error("Unsupported import format");
  } catch (error) {
    return { rows: [], errors: [(error as Error).message] };
  }
  if (records.length > LIMITS.guests)
    return { rows: [], errors: [`Import exceeds ${LIMITS.guests} rows`] };
  const seen = new Map(
    existing.map((g) => [g.phone, { id: g.id, name: g.name }]),
  );
  const rows = records.map(([rawName, rawPhone], index): ImportRow => {
    const name = rawName.trim();
    const row: ImportRow = { row: index + 1, name, rawPhone };
    if (name.length > LIMITS.name) {
      row.error = "Name is too long";
      return row;
    }
    try {
      row.phone = normalizePhone(rawPhone, countryCode);
    } catch (error) {
      row.error = (error as Error).message;
      return row;
    }
    const duplicate = seen.get(row.phone);
    if (duplicate) {
      row.duplicateOf = duplicate.id;
      row.conflict = duplicate.name.trim().toLowerCase() !== name.toLowerCase();
    } else seen.set(row.phone, { id: `row:${row.row}`, name });
    return row;
  });
  return { rows, errors: [] };
}
/** Every added row needs an explicit decision and stable generated ID. Duplicate numbers never silently merge. */
export function applyImportDecisions(
  state: AppState,
  preview: ImportPreview,
  decisions: ImportDecision[],
): AppState {
  if (preview.errors.length) throw new Error("Resolve import errors first");
  const guests = [...state.guests];
  const decided = new Set<number>();
  for (const decision of decisions) {
    if (decided.has(decision.row)) throw new Error("Repeated import decision");
    decided.add(decision.row);
    const row = preview.rows.find((r) => r.row === decision.row);
    if (!row) throw new Error("Import row not found");
    if (decision.action === "skip") continue;
    if (
      row.error ||
      !row.phone ||
      !decision.id ||
      decision.id.length > 200 ||
      row.name.length > LIMITS.name
    )
      throw new Error("Valid phone and stable ID required");
    if (normalizePhone(row.phone, state.event.countryCode) !== row.phone)
      throw new Error("Phone must be normalized");
    if (guests.some((g) => g.id === decision.id))
      throw new Error("Guest ID already exists");
    if (guests.some((g) => g.phone === row.phone))
      throw new Error("Duplicate number: keep one contact or skip this row");
    guests.push({
      id: decision.id,
      name: row.name,
      phone: row.phone,
      selected: true,
      status: "pending",
    });
  }
  if (guests.length > LIMITS.guests) throw new Error("Guest limit exceeded");
  return { ...state, guests };
}
