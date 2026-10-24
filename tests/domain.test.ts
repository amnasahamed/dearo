import test from "node:test";
import assert from "node:assert/strict";
import {
  LIMITS,
  createInitialState,
  editGuestDetails,
  normalizePhone,
  validateInvitationUrl,
  prepareMessage,
  buildWhatsAppUrl,
  prepareHandoff,
  returnFromHandoff,
  confirmHandoff,
  cancelHandoff,
  undoConfirmation,
  skipGuest,
  revisitGuest,
  nextGuest,
  importContactsPreview,
  applyImportDecisions,
  parseBackup,
  serializeBackup,
  type AppState,
  type Event,
} from "../src/domain/index";
const event: Event = {
  id: "wedding",
  title: "Our wedding",
  invitationUrl: "https://example.com/invite",
  messageTemplate: "Hello {guest}, join {event}! {link}",
  countryCode: "US",
};
const at = "2026-10-24T12:00:00.000Z";
function fixture(): AppState {
  return {
    ...createInitialState(event),
    guests: [
      {
        id: "g1",
        name: "Sam",
        phone: "+14155552671",
        selected: true,
        status: "pending",
      },
      {
        id: "g2",
        name: "Alex",
        phone: "+442079460018",
        selected: true,
        status: "pending",
      },
    ],
  };
}
test("normalizes national and international numbers and rejects invalid numbers/extensions", () => {
  assert.equal(normalizePhone("(415) 555-2671", "US"), "+14155552671");
  assert.equal(normalizePhone("020 7946 0018", "GB"), "+442079460018");
  for (const phone of ["abc", "123", "+14155552671 ext 2", "call +14155552671"])
    assert.throws(() => normalizePhone(phone, "US"));
});
test("URL validation excludes executable schemes, credentials and control characters", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:text/html,hi",
    "https://u:p@example.com",
    "https://example.com\n",
    "/relative",
  ])
    assert.throws(() => validateInvitationUrl(url));
  assert.equal(
    validateInvitationUrl(" https://example.com/invite "),
    event.invitationUrl,
  );
});
test("message replaces all placeholders literally with fallback and appends missing link", () => {
  assert.equal(
    prepareMessage(event, ""),
    "Hello Guest, join Our wedding! https://example.com/invite",
  );
  assert.equal(
    prepareMessage({ ...event, messageTemplate: "{guest}/{guest}" }, "$&"),
    "$&/$&\nhttps://example.com/invite",
  );
  const url = new URL(buildWhatsAppUrl("+14155552671", "Hello & مرحبا 👋"));
  assert.equal(url.pathname, "/14155552671");
  assert.equal(url.searchParams.get("text"), "Hello & مرحبا 👋");
});
test("handoff snapshots recipient/message without changing original and blocks overwrite", () => {
  const original = fixture();
  const prepared = prepareHandoff(original, "g1", "a1", at);
  assert.equal(original.guests[0].status, "pending");
  assert.equal(original.pendingHandoff, null);
  assert.equal(prepared.pendingHandoff?.recipient, "+14155552671");
  const edited = {
    ...prepared,
    event: { ...event, messageTemplate: "Edited" },
    guests: prepared.guests.map((g) => ({ ...g, name: "Changed" })),
  };
  assert.equal(
    edited.pendingHandoff?.preparedMessage,
    "Hello Sam, join Our wedding! https://example.com/invite",
  );
  assert.throws(() => prepareHandoff(prepared, "g2", "a2", at));
  assert.equal(nextGuest(prepared), undefined);
});
test("foreground return never confirms sending, explicit confirmation and undo preserve audit", () => {
  const returned = returnFromHandoff(
    prepareHandoff(fixture(), "g1", "a1", at),
    at,
  );
  assert.equal(returned.guests[0].status, "opened");
  assert.equal(returned.attempts.length, 0);
  const confirmed = confirmHandoff(returned, at, "a1");
  assert.equal(confirmed.guests[0].status, "confirmed");
  assert.equal(confirmed.pendingHandoff, null);
  const undone = undoConfirmation(confirmed, "g1", at);
  assert.equal(undone.guests[0].status, "review");
  assert.equal(undone.attempts[0].outcome, "confirmed");
  assert.equal(undone.attempts[0].undoneAt, at);
  assert.equal(nextGuest(undone)?.id, "g2");
});
test("skip, revisit, and unresolved handoff behavior are explicit", () => {
  const skipped = skipGuest(fixture(), "g1");
  assert.equal(nextGuest(skipped)?.id, "g2");
  assert.equal(nextGuest(revisitGuest(skipped, "g1"))?.id, "g1");
  const prepared = prepareHandoff(fixture(), "g1", "a1", at);
  assert.throws(() => skipGuest(prepared, "g1"));
  const cancelled = cancelHandoff(prepared, "a1");
  assert.equal(cancelled.guests[0].status, "review");
  assert.equal(cancelled.attempts[0].outcome, "unconfirmed");
  assert.equal(cancelled.pendingHandoff, null);
});
test("CSV quotes, international normalization and duplicate conflicts are previewed", () => {
  const preview = importContactsPreview(
    'name,phone\n"Sam, Jr",(415) 555-2671\nDifferent,+14155552671\nBad,123',
    "csv",
    "US",
  );
  assert.equal(preview.rows[0].name, "Sam, Jr");
  assert.equal(preview.rows[1].duplicateOf, "row:1");
  assert.equal(preview.rows[1].conflict, true);
  assert.ok(preview.rows[2].error);
  assert.ok(importContactsPreview('"Broken', "csv", "US").errors.length);
  const state = applyImportDecisions(createInitialState(event), preview, [
    { row: 1, action: "add", id: "g1" },
    { row: 2, action: "skip" },
  ]);
  assert.equal(state.guests.length, 1);
  assert.throws(() =>
    applyImportDecisions(state, preview, [{ row: 2, action: "add", id: "g2" }]),
  );
});
test("paste and unfolded vCard import support multiple numbers with no native contact access", () => {
  assert.equal(
    importContactsPreview(
      "Sam +1 415 555 2671\nAlex\t+44 20 7946 0018",
      "paste",
      "US",
    ).rows.length,
    2,
  );
  const vcf =
    "BEGIN:VCARD\r\nVERSION:3.0\r\nFN:Sam\\, Jr\r\nTEL;TYPE=CELL:+1415\r\n 5552671\r\nTEL:tel:+442079460018\r\nEND:VCARD";
  const preview = importContactsPreview(vcf, "vcf", "US");
  assert.equal(preview.rows.length, 2);
  assert.equal(preview.rows[0].name, "Sam, Jr");
  assert.equal(preview.rows[0].phone, "+14155552671");
});
test("backup round trip preserves pending snapshot and rejects hostile/schema-invalid inputs", () => {
  const state = prepareHandoff(fixture(), "g1", "a1", at);
  assert.deepEqual(parseBackup(serializeBackup(state)), state);
  for (const mutate of [
    (s: any) => {
      s.schemaVersion = 2;
    },
    (s: any) => {
      s.guests[0].selected = "yes";
    },
    (s: any) => {
      s.guests.push(s.guests[0]);
    },
    (s: any) => {
      s.pendingHandoff.guestId = "missing";
    },
    (s: any) => {
      s.event.invitationUrl = "javascript:alert(1)";
    },
  ]) {
    const bad = JSON.parse(JSON.stringify(state));
    mutate(bad);
    assert.throws(() => parseBackup(JSON.stringify(bad)));
  }
  assert.throws(() => parseBackup('{"__proto__":{"polluted":true}}'));
  assert.equal(({} as any).polluted, undefined);
  assert.throws(() => parseBackup("x".repeat(5_000_001)));
});
test("imports are bounded and stable IDs cannot collide", () => {
  assert.ok(
    importContactsPreview("x".repeat(1_000_001), "paste", "US").errors.length,
  );
  const preview = importContactsPreview("Sam,+14155552671", "csv", "US");
  assert.throws(() =>
    applyImportDecisions(fixture(), preview, [
      { row: 1, action: "add", id: "g1" },
    ]),
  );
});
test("existing contacts are identified without replacing their names", () => {
  const state = fixture();
  const preview = importContactsPreview(
    "name,phone\nSomeone Else,+14155552671",
    "csv",
    "US",
    state.guests,
  );
  assert.equal(preview.rows[0].duplicateOf, "g1");
  assert.equal(preview.rows[0].conflict, true);
  assert.deepEqual(
    applyImportDecisions(state, preview, [{ row: 1, action: "skip" }]),
    state,
  );
});
test("header order, escaped quotes, blank names, and bare formatted numbers work", () => {
  const preview = importContactsPreview(
    'phone,name\n+14155552671,"Sam ""S"""',
    "csv",
    "US",
  );
  assert.equal(preview.rows[0].name, 'Sam "S"');
  const bare = importContactsPreview("+1 415 555 2671", "paste", "US");
  assert.equal(bare.rows[0].name, "");
  assert.equal(bare.rows[0].phone, "+14155552671");
  assert.ok(
    importContactsPreview('"Sam"x,+14155552671', "csv", "US").errors.length,
  );
});
test("unselected and confirmed guests cannot start handoffs; IDs cannot be reused", () => {
  const state = fixture();
  state.guests[0].selected = false;
  assert.throws(() => prepareHandoff(state, "g1", "a1", at));
  const confirmed = confirmHandoff(
    prepareHandoff(fixture(), "g1", "a1", at),
    at,
    "a1",
  );
  assert.throws(() => prepareHandoff(confirmed, "g1", "a2", at));
  assert.throws(() => prepareHandoff(confirmed, "g2", "a1", at));
  assert.throws(() => skipGuest(confirmed, "g1"));
  assert.throws(() => revisitGuest(confirmed, "g1"));
});
test("no attempt means no confirmation, and invalid timestamps cannot enter transitions", () => {
  assert.throws(() => confirmHandoff(fixture(), at, "a1"));
  assert.throws(() => prepareHandoff(fixture(), "missing", "a1", at));
  assert.throws(() => prepareHandoff(fixture(), "g1", "a1", "not a date"));
  assert.throws(() => returnFromHandoff(fixture(), "not a date"));
});
test("backup rejects extra keys, mismatched pending state and forged audit IDs", () => {
  const prepared = prepareHandoff(fixture(), "g1", "a1", at);
  for (const mutate of [
    (s: any) => {
      s.guests[0].status = "pending";
    },
    (s: any) => {
      s.event.extra = true;
    },
    (s: any) => {
      s.attempts = [{ ...s.pendingHandoff, outcome: "confirmed" }];
    },
    (s: any) => {
      s.attempts = [
        { ...s.pendingHandoff, outcome: "confirmed", confirmedAt: at },
      ];
    },
    (s: any) => {
      s.guests[0].phone = "(415) 555-2671";
    },
  ]) {
    const invalid = JSON.parse(JSON.stringify(prepared));
    mutate(invalid);
    assert.throws(() => parseBackup(JSON.stringify(invalid)));
  }
});
test("editing phone after handoff cannot confirm the new recipient or restore an inconsistent backup", () => {
  const prepared = prepareHandoff(fixture(), "g1", "a1", at);
  const edited = {
    ...prepared,
    guests: prepared.guests.map((g) =>
      g.id === "g1" ? { ...g, phone: "+14155552672" } : g,
    ),
  };
  assert.equal(edited.pendingHandoff?.recipient, "+14155552671");
  assert.throws(() => confirmHandoff(edited, at, "a1"));
  assert.throws(() => parseBackup(JSON.stringify(edited)));
  const resolved = cancelHandoff(edited, "a1");
  assert.equal(resolved.attempts[0].recipient, "+14155552671");
  assert.equal(resolved.guests[0].status, "review");
});
test("stale confirmation and cancellation cannot resolve a newer handoff", () => {
  const first = prepareHandoff(fixture(), "g1", "a1", at);
  const second = prepareHandoff(cancelHandoff(first, "a1"), "g2", "a2", at);
  assert.throws(() => confirmHandoff(second, at, "a1"));
  assert.throws(() => cancelHandoff(second, "a1"));
  assert.equal(second.pendingHandoff?.id, "a2");
  assert.equal(confirmHandoff(second, at, "a2").guests[1].status, "confirmed");
});
test("initial state rejects invalid country, unsafe URL and excessive template", () => {
  assert.throws(() =>
    createInitialState({ ...event, countryCode: "XX" as any }),
  );
  assert.throws(() =>
    createInitialState({ ...event, invitationUrl: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    createInitialState({ ...event, messageTemplate: "x".repeat(10001) }),
  );
  assert.equal(
    createInitialState({ ...event, invitationUrl: "" }).guests.length,
    0,
  );
});
test("CSV multiline quoted names preserve row and recipient association", () => {
  const preview = importContactsPreview(
    'name,phone\n"Sam\nSmith",+14155552671\nAlex,+442079460018',
    "csv",
    "US",
  );
  assert.equal(preview.rows[0].name, "Sam\nSmith");
  assert.equal(preview.rows[0].phone, "+14155552671");
  assert.equal(preview.rows[1].name, "Alex");
  assert.equal(preview.rows[1].phone, "+442079460018");
});
test("malformed or encoded vCards reject the entire preview rather than swapping contacts", () => {
  for (const vcf of [
    "BEGIN:VCARD\nFN:Sam\nTEL:+14155552671",
    "BEGIN:VCARD\nFN:Sam\nBEGIN:VCARD\nFN:Alex\nTEL:+442079460018\nEND:VCARD\nEND:VCARD",
    "END:VCARD",
    "BEGIN:VCARD\nFN;ENCODING=QUOTED-PRINTABLE:Sam\nTEL:+14155552671\nEND:VCARD",
  ]) {
    const preview = importContactsPreview(vcf, "vcf", "US");
    assert.equal(preview.rows.length, 0);
    assert.ok(preview.errors.length);
  }
});
test("placeholder-like guest names remain literal rather than injecting template values", () => {
  assert.equal(
    prepareMessage(
      { ...event, messageTemplate: "Hello {guest}! {link}" },
      "{event}",
    ),
    "Hello {event}! https://example.com/invite",
  );
});
test("backup enum fields reject arrays and objects rather than coercing to strings", () => {
  const confirmed = confirmHandoff(
    prepareHandoff(fixture(), "g1", "a1", at),
    at,
    "a1",
  );
  for (const invalidStatus of [
    ["pending"],
    ["confirmed"],
    { value: "pending" },
    {},
    null,
    1,
    true,
  ]) {
    const state = JSON.parse(JSON.stringify(confirmed));
    state.guests[0].status = invalidStatus;
    assert.throws(
      () => parseBackup(JSON.stringify(state)),
      /Invalid guest state/,
    );
  }
  for (const invalidOutcome of [
    ["confirmed"],
    ["unconfirmed"],
    { value: "confirmed" },
    {},
    null,
    1,
    true,
  ]) {
    const state = JSON.parse(JSON.stringify(confirmed));
    state.attempts[0].outcome = invalidOutcome;
    assert.throws(
      () => parseBackup(JSON.stringify(state)),
      /Invalid attempt outcome/,
    );
  }
});
test("explicit duplicate choice may keep a later imported row but never replace an existing guest", () => {
  const preview = importContactsPreview(
    "name,phone\nFirst,(415) 555-2671\nPreferred,+14155552671",
    "csv",
    "US",
  );
  assert.equal(preview.rows[1].duplicateOf, "row:1");
  const imported = applyImportDecisions(createInitialState(event), preview, [
    { row: 1, action: "skip" },
    { row: 2, action: "add", id: "chosen" },
  ]);
  assert.deepEqual(
    imported.guests.map((g) => [g.id, g.name, g.phone]),
    [["chosen", "Preferred", "+14155552671"]],
  );
  const reverseOrder = applyImportDecisions(
    createInitialState(event),
    preview,
    [
      { row: 2, action: "add", id: "chosen" },
      { row: 1, action: "skip" },
    ],
  );
  assert.deepEqual(reverseOrder, imported);
  assert.throws(
    () =>
      applyImportDecisions(createInitialState(event), preview, [
        { row: 1, action: "add", id: "first" },
        { row: 2, action: "add", id: "second" },
      ]),
    /Duplicate number/,
  );
  assert.throws(
    () =>
      applyImportDecisions(fixture(), preview, [
        { row: 1, action: "skip" },
        { row: 2, action: "add", id: "chosen" },
      ]),
    /Duplicate number/,
  );
});
test("guest details edit normalizes unique phones, trims names and does not mutate input", () => {
  const original = fixture();
  const edited = editGuestDetails(original, "g1", {
    name: "  Samuel  ",
    phone: "(415) 555-2672",
  });
  assert.equal(edited.guests[0].name, "Samuel");
  assert.equal(edited.guests[0].phone, "+14155552672");
  assert.equal(original.guests[0].name, "Sam");
  assert.equal(original.guests[0].phone, "+14155552671");
  assert.throws(
    () =>
      editGuestDetails(original, "g1", {
        name: "Sam",
        phone: "+44 20 7946 0018",
      }),
    /already uses/,
  );
  assert.throws(() =>
    editGuestDetails(original, "g1", { name: "Sam", phone: "123" }),
  );
  assert.throws(() =>
    editGuestDetails(original, "g1", {
      name: "x".repeat(201),
      phone: "+14155552671",
    }),
  );
  assert.throws(
    () =>
      editGuestDetails(original, "missing", {
        name: "Sam",
        phone: "+14155552671",
      }),
    /not found/,
  );
});
test("all contact edits are blocked during any pending handoff", () => {
  const pending = prepareHandoff(fixture(), "g1", "a1", at);
  assert.throws(
    () =>
      editGuestDetails(pending, "g1", {
        name: "Samuel",
        phone: "+14155552671",
      }),
    /unfinished handoff/,
  );
  assert.throws(
    () =>
      editGuestDetails(pending, "g2", {
        name: "Alexander",
        phone: "+442079460018",
      }),
    /unfinished handoff/,
  );
});
test("undo and revisit cannot permit phone changes that reassign invitation history", () => {
  const confirmed = confirmHandoff(
    prepareHandoff(fixture(), "g1", "a1", at),
    at,
    "a1",
  );
  const undone = undoConfirmation(confirmed, "g1", at);
  const revisited = revisitGuest(undone, "g1");
  for (const state of [confirmed, undone, revisited]) {
    assert.throws(
      () =>
        editGuestDetails(state, "g1", { name: "Sam", phone: "+14155552672" }),
      /invitation history/,
    );
    const renamed = editGuestDetails(state, "g1", {
      name: "Samuel",
      phone: "(415) 555-2671",
    });
    assert.equal(renamed.guests[0].name, "Samuel");
    assert.equal(renamed.guests[0].phone, "+14155552671");
    assert.deepEqual(renamed.attempts, state.attempts);
  }
});
test("unconfirmed attempt history also prevents phone reassignment after revisit", () => {
  const unresolved = cancelHandoff(
    prepareHandoff(fixture(), "g1", "a1", at),
    "a1",
  );
  const state = revisitGuest(unresolved, "g1");
  assert.throws(
    () => editGuestDetails(state, "g1", { name: "Sam", phone: "+14155552672" }),
    /invitation history/,
  );
  const other = editGuestDetails(state, "g2", {
    name: "Alex",
    phone: "+14155552672",
  });
  assert.equal(other.guests[1].phone, "+14155552672");
});
test("guest name limit accepts exactly 200 characters and rejects 201", () => {
  const exact = "N".repeat(LIMITS.name);
  assert.equal(
    editGuestDetails(fixture(), "g1", { name: exact, phone: "+14155552671" })
      .guests[0].name.length,
    200,
  );
  assert.throws(() =>
    editGuestDetails(fixture(), "g1", {
      name: exact + "N",
      phone: "+14155552671",
    }),
  );
  const accepted = importContactsPreview(`${exact},+14155552671`, "csv", "US");
  assert.equal(accepted.rows[0].error, undefined);
  const rejected = importContactsPreview(`${exact}N,+14155552671`, "csv", "US");
  assert.match(rejected.rows[0].error ?? "", /Name is too long/);
  const state = fixture();
  state.guests[0].name = exact;
  assert.equal(parseBackup(JSON.stringify(state)).guests[0].name, exact);
  state.guests[0].name += "N";
  assert.throws(() => parseBackup(JSON.stringify(state)));
});
test("message template limit accepts exactly 10000 characters and rejects 10001", () => {
  const exactEvent = { ...event, messageTemplate: "x".repeat(LIMITS.message) };
  assert.equal(
    createInitialState(exactEvent).event.messageTemplate.length,
    10000,
  );
  assert.ok(
    prepareMessage(exactEvent, "Guest").startsWith(exactEvent.messageTemplate),
  );
  const exceeded = {
    ...exactEvent,
    messageTemplate: exactEvent.messageTemplate + "x",
  };
  assert.throws(() => createInitialState(exceeded));
  assert.throws(() => prepareMessage(exceeded, "Guest"));
});
test("import byte limit accepts exactly 1 MB and rejects one extra byte including UTF-8", () => {
  const exact = " ".repeat(LIMITS.importBytes);
  assert.deepEqual(importContactsPreview(exact, "csv", "US"), {
    rows: [],
    errors: [],
  });
  assert.match(
    importContactsPreview(exact + " ", "csv", "US").errors[0],
    /1 MB/,
  );
  const unicodeExact = "é".repeat(LIMITS.importBytes / 2);
  // One invalid row is expected, but no file-level size error at exactly 1 MB.
  assert.deepEqual(
    importContactsPreview(unicodeExact, "paste", "US").errors,
    [],
  );
  assert.match(
    importContactsPreview(unicodeExact + "x", "paste", "US").errors[0],
    /1 MB/,
  );
});
test("import row limit accepts exactly 5000 data rows and rejects 5001", () => {
  const row = "Synthetic,+14155552671";
  const exact = importContactsPreview(
    Array(LIMITS.guests).fill(row).join("\n"),
    "csv",
    "US",
  );
  assert.equal(exact.rows.length, 5000);
  assert.deepEqual(exact.errors, []);
  const exceeded = importContactsPreview(
    Array(LIMITS.guests + 1)
      .fill(row)
      .join("\n"),
    "csv",
    "US",
  );
  assert.equal(exceeded.rows.length, 0);
  assert.match(exceeded.errors[0], /5000 rows/);
});
test("backup byte limit accepts exactly 5 MB and rejects 5000001 bytes", () => {
  const json = JSON.stringify(fixture());
  const exact =
    json + " ".repeat(LIMITS.backupBytes - Buffer.byteLength(json, "utf8"));
  assert.equal(Buffer.byteLength(exact, "utf8"), 5_000_000);
  assert.deepEqual(parseBackup(exact), fixture());
  assert.throws(() => parseBackup(exact + " "), /5 MB/);
});
test("synthetic 1000-row import measurement records real elapsed time without a speed gate", (context) => {
  const text = [
    "name,phone",
    ...Array.from(
      { length: 1000 },
      (_, i) => `Synthetic Guest ${i},+1415555${String(i).padStart(4, "0")}`,
    ),
  ].join("\n");
  const start = performance.now();
  const preview = importContactsPreview(text, "csv", "US");
  const previewMs = performance.now() - start;
  assert.equal(preview.rows.length, 1000);
  assert.deepEqual(preview.errors, []);
  assert.equal(preview.rows.filter((row) => row.error).length, 0);
  const applyStart = performance.now();
  const state = applyImportDecisions(
    createInitialState(event),
    preview,
    preview.rows.map((row) => ({
      row: row.row,
      action: "add",
      id: `synthetic-${row.row}`,
    })),
  );
  const applyMs = performance.now() - applyStart;
  assert.equal(state.guests.length, 1000);
  assert.equal(new Set(state.guests.map((guest) => guest.phone)).size, 1000);
  context.diagnostic(
    `Synthetic 1,000-row CSV: preview ${previewMs.toFixed(2)} ms; apply ${applyMs.toFixed(2)} ms. Measured on this runtime only, not a mobile performance claim or gate.`,
  );
});
