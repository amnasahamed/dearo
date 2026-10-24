import test from "node:test";
import assert from "node:assert/strict";
import { PreferencesController } from "../src/product/controller";
import {
  createProductPreferences,
  setHapticsEnabled,
  recordExplicitConfirmation,
} from "../src/product/preferences";
test("concurrent preference transformations preserve both updates", async () => {
  let saved = createProductPreferences("2026-01-01T00:00:00.000Z");
  const c = new PreferencesController({
    load: async () => saved,
    save: async (p) => {
      await new Promise((r) => setTimeout(r, 2));
      saved = p;
    },
  });
  await c.load();
  await Promise.all([
    c.update((p) => recordExplicitConfirmation(p, "one")),
    c.update((p) => setHapticsEnabled(p, false)),
  ]);
  assert.equal(saved.review.explicitConfirmationCount, 1);
  assert.equal(saved.hapticsEnabled, false);
});
test("failed preferences write preserves state and does not poison later writes", async () => {
  const original = createProductPreferences("2026-01-01T00:00:00.000Z");
  let fail = true;
  const c = new PreferencesController({
    load: async () => original,
    save: async () => {
      if (fail) throw Error("disk full");
    },
  });
  await c.load();
  await assert.rejects(
    c.update((p) => setHapticsEnabled(p, false)),
    /disk full/,
  );
  assert.equal(c.current, original);
  fail = false;
  await c.update((p) => setHapticsEnabled(p, false));
  assert.equal(c.current?.hapticsEnabled, false);
});
