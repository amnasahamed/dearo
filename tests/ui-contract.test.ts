import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ui = readFileSync(
  new URL("../src/ui/DearoApp.tsx", import.meta.url),
  "utf8",
);
// Source-contract checks complement pure state tests; these are NOT native UI tests.
test("clear and restore both erase transient guest drafts after a saved replacement", () => {
  const reset = ui.slice(
    ui.indexOf("const resetGuestDrafts"),
    ui.indexOf("const restore ="),
  );
  for (const setter of [
    "setPaste",
    "setPreview",
    "setImportRows",
    "setContactChoices",
    "setName",
    "setPhone",
    "setEditing",
    "setSearch",
  ])
    assert.ok(reset.includes(setter), setter);
  for (const section of [
    ui.slice(ui.indexOf("const restore ="), ui.indexOf("const exportBackup")),
    ui.slice(ui.indexOf("const clear ="), ui.indexOf("const editGuest =")),
  ]) {
    assert.ok(
      section.indexOf("await controller.update") <
        section.indexOf("resetGuestDrafts()"),
    );
    assert.ok(section.includes("resetGuestDrafts()"));
  }
});
test("contact edit routes through history-aware domain mutation", () =>
  assert.ok(ui.includes("editGuestDetails(current, editing.id")));
