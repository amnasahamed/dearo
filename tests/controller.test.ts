import test from "node:test";
import assert from "node:assert/strict";
import { EventController, type Repository } from "../src/storage/controller";
import { createInitialState, type AppState } from "../src/domain";
const event = {
  id: "event",
  title: "Wedding",
  invitationUrl: "https://example.invalid/invite",
  messageTemplate: "Dear {guest}, join us {link}",
  countryCode: "IN" as const,
};
function fixture() {
  let saved: AppState | null = {
    ...createInitialState(event),
    guests: [
      {
        id: "a",
        name: "A",
        phone: "+919876543210",
        selected: true,
        status: "pending",
      },
      {
        id: "b",
        name: "B",
        phone: "+919876543211",
        selected: true,
        status: "pending",
      },
    ],
  };
  let failSave = false,
    failOpen = false,
    count = 0;
  const trace: string[] = [];
  const repo: Repository = {
    async load() {
      return saved;
    },
    async save(s) {
      trace.push("save");
      if (failSave) throw Error("disk full");
      saved = structuredClone(s);
    },
    async clear() {
      saved = null;
    },
  };
  const controller = new EventController(repo, {
    id: () => `attempt-${++count}`,
    now: () => "2026-10-24T09:00:00Z",
    async open(url) {
      trace.push("open");
      assert.match(url, /^https:\/\/wa.me\//);
      if (failOpen) throw Error("launch unavailable");
    },
  });
  return {
    controller,
    trace,
    get saved() {
      return saved;
    },
    set failSave(v: boolean) {
      failSave = v;
    },
    set failOpen(v: boolean) {
      failOpen = v;
    },
  };
}
test("save completes before external handoff and resume does not confirm", async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.openGuest("a");
  assert.deepEqual(f.trace, ["save", "open"]);
  assert.equal(f.saved!.guests[0].status, "opened");
  await f.controller.load();
  assert.equal(f.controller.state!.pendingHandoff!.guestId, "a");
});
test("save failure prevents navigation and preserves old state", async () => {
  const f = fixture();
  await f.controller.load();
  f.failSave = true;
  await assert.rejects(f.controller.openGuest("a"), /disk full/);
  assert.deepEqual(f.trace, ["save"]);
  assert.equal(f.controller.state!.pendingHandoff, null);
});
test("launch failure preserves unresolved snapshot for exact retry", async () => {
  const f = fixture();
  await f.controller.load();
  f.failOpen = true;
  await assert.rejects(f.controller.openGuest("a"));
  const id = f.saved!.pendingHandoff!.id;
  f.failOpen = false;
  await f.controller.retry(id);
  assert.equal(f.saved!.pendingHandoff!.id, id);
  assert.equal(f.saved!.guests[0].status, "opened");
});
test("confirm-next commits previous guest before opening next and last stops", async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.openGuest("a");
  await f.controller.confirmAndNext(f.saved!.pendingHandoff!.id);
  assert.equal(f.saved!.guests[0].status, "confirmed");
  assert.equal(f.saved!.pendingHandoff!.guestId, "b");
  await f.controller.confirmAndNext(f.saved!.pendingHandoff!.id);
  assert.equal(f.saved!.pendingHandoff, null);
  assert.equal(f.trace.filter((x) => x === "open").length, 2);
});
test("next-launch failure never rolls back prior explicit confirmation", async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.openGuest("a");
  f.failOpen = true;
  await assert.rejects(
    f.controller.confirmAndNext(f.saved!.pendingHandoff!.id),
  );
  assert.equal(f.saved!.guests[0].status, "confirmed");
  assert.equal(f.saved!.pendingHandoff!.guestId, "b");
});
test("stale confirmation does not confirm another guest", async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.openGuest("a");
  const old = f.saved!.pendingHandoff!.id;
  await f.controller.confirmAndNext(old);
  await assert.rejects(f.controller.confirmAndNext(old), /changed/);
  assert.equal(f.saved!.guests[1].status, "opened");
});
test("double open is locked synchronously", async () => {
  const f = fixture();
  await f.controller.load();
  const one = f.controller.openGuest("a");
  await assert.rejects(f.controller.openGuest("b"), /wait/);
  await one;
  assert.equal(f.trace.filter((x) => x === "open").length, 1);
});

test("atomic event reset failure preserves old event and never emits an empty state", async () => {
  const f = fixture();
  await f.controller.load();
  const before = f.controller.state;
  f.failSave = true;
  await assert.rejects(
    f.controller.update(() => createInitialState({ ...event, id: "fresh" })),
    /disk full/,
  );
  assert.equal(f.controller.state, before);
  assert.equal(f.saved?.guests.length, 2);
});
test("atomic reset removes all saved guests and attempts only on successful commit", async () => {
  const f = fixture();
  await f.controller.load();
  await f.controller.openGuest("a");
  await f.controller.update(() =>
    createInitialState({ ...event, id: "fresh" }),
  );
  assert.equal(f.saved?.guests.length, 0);
  assert.equal(f.saved?.pendingHandoff, null);
  assert.equal(f.saved?.attempts.length, 0);
});
