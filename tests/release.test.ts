import test from "node:test";
import assert from "node:assert/strict";
import {
  appReviewUrl,
  verifiedHttpsUrl,
  releaseConfig,
  privacyNotice,
} from "../src/product/release";
test("production destinations remain absent until deliberately configured", () => {
  assert.deepEqual(releaseConfig, {
    privacyPolicyUrl: null,
    supportUrl: null,
    appStoreId: null,
  });
  assert.equal(verifiedHttpsUrl(null), null);
  assert.equal(appReviewUrl(null), null);
});
test("release URL validator allows HTTPS but rejects executable, plain HTTP and credentialed URLs", () => {
  assert.equal(
    verifiedHttpsUrl("https://example.com/privacy"),
    "https://example.com/privacy",
  );
  for (const value of [
    "",
    "http://example.com",
    "javascript:alert(1)",
    "data:text/html,test",
    "https://username:password@example.com",
    "https://username@example.com",
    "/relative",
    "not a URL",
  ])
    assert.equal(verifiedHttpsUrl(value), null);
});
test("review deep link accepts only an App Store numeric identifier", () => {
  assert.equal(
    appReviewUrl("123456789"),
    "https://apps.apple.com/app/id123456789?action=write-review",
  );
  for (const value of [
    "",
    "0",
    "0123",
    "-123",
    "123?x=1",
    "https://example.com",
    "123/456",
    "123 ",
  ])
    assert.equal(appReviewUrl(value), null);
});
test("privacy notice discloses local data, third-party handoff, backup exposure and review uncertainty", () => {
  const notice = privacyNotice.join("\n");
  for (const phrase of [
    "local app storage",
    "WhatsApp",
    "not encrypted",
    "operating system decides",
    "never knows your rating",
  ])
    assert.ok(notice.includes(phrase));
});
