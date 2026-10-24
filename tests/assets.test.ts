import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
test("iOS icon is a full-size opaque PNG, not a template asset", () => {
  const icon = readFileSync(new URL("../assets/icon.png", import.meta.url));
  assert.equal(icon.subarray(1, 4).toString(), "PNG");
  assert.equal(icon.readUInt32BE(16), 1024);
  assert.equal(icon.readUInt32BE(20), 1024);
  assert.equal(icon[25], 2);
  const source = readFileSync(
    new URL("../assets/dearo-mark.svg", import.meta.url),
    "utf8",
  );
  assert.match(source, /#2458EE/);
});
test("iPhone config has explicit privacy manifest, splash, no broad contacts permission", () => {
  const { expo } = JSON.parse(
    readFileSync(new URL("../app.json", import.meta.url), "utf8"),
  );
  assert.equal(expo.ios.supportsTablet, false);
  assert.equal(expo.ios.privacyManifests.NSPrivacyTracking, false);
  assert.ok(
    expo.plugins.some(
      (p: unknown) => Array.isArray(p) && p[0] === "expo-splash-screen",
    ),
  );
  assert.ok(
    expo.android.blockedPermissions.includes(
      "android.permission.READ_CONTACTS",
    ),
  );
});
