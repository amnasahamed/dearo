import React from "react";
import { afterEach, beforeEach, expect, jest, test } from "@jest/globals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { SettingsPanel } from "../src/ui/SettingsPanel";
import { releaseConfig } from "../src/product/release";
const original = { ...releaseConfig };
function props() {
  return {
    busy: false,
    haptics: true,
    reducedMotion: false,
    onHaptics: jest.fn(),
    onExport: jest.fn(),
    onRestore: jest.fn(),
    onClear: jest.fn(),
    onOnboarding: jest.fn(),
    onOpen: jest.fn<(url: string) => void>(),
    onCopyDiagnostics: jest.fn(),
    onRetryPreferences: jest.fn(),
    preferencesError: "",
  };
}
beforeEach(() => {
  Object.assign(releaseConfig, {
    privacyPolicyUrl: null,
    supportUrl: null,
    appStoreId: null,
  });
});
afterEach(async () => {
  await cleanup();
  Object.assign(releaseConfig, original);
});
test("local privacy notice is available without network or a fake published URL", async () => {
  const p = props();
  await render(<SettingsPanel {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "Privacy & data" }));
  expect(screen.getByText("Your privacy")).toBeTruthy();
  expect(screen.getByText(/does not upload your address book/)).toBeTruthy();
  expect(
    screen.getByText(/Backups you export contain personal details/),
  ).toBeTruthy();
  expect(screen.getByText(/never knows your rating/)).toBeTruthy();
  const policy = screen.getByRole("button", {
    name: "Published privacy policy",
  });
  expect(policy).toBeDisabled();
  await fireEvent.press(policy);
  expect(p.onOpen).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to settings" }),
  );
  expect(screen.getByText("Make Dearo yours.")).toBeTruthy();
});
test("help remains local, explains WhatsApp limitations and disables unconfigured support", async () => {
  const p = props();
  await render(<SettingsPanel {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "Help & support" }));
  expect(screen.getByText("A little help")).toBeTruthy();
  expect(screen.getByText(/Dearo cannot select an account/)).toBeTruthy();
  expect(
    screen.getByText(/Check WhatsApp to avoid sending twice/),
  ).toBeTruthy();
  const support = screen.getByRole("button", { name: "Contact support" });
  expect(support).toBeDisabled();
  await fireEvent.press(support);
  expect(p.onOpen).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Copy app diagnostics" }),
  );
  expect(p.onCopyDiagnostics).toHaveBeenCalledTimes(1);
  expect(
    screen.getByText(/never your invitation, guest list or phone numbers/),
  ).toBeTruthy();
});
test("about does not pretend an App Store listing or acceptance exists", async () => {
  const p = props();
  await render(<SettingsPanel {...p} />);
  await fireEvent.press(screen.getByRole("button", { name: "About Dearo" }));
  expect(screen.getByText(/Development build/)).toBeTruthy();
  expect(
    screen.getByText(
      /has not completed App Store or physical-device acceptance/,
    ),
  ).toBeTruthy();
  const review = screen.getByRole("button", {
    name: "Write an App Store review",
  });
  expect(review).toBeDisabled();
  await fireEvent.press(review);
  expect(p.onOpen).not.toHaveBeenCalled();
});
test("haptics setting delegates persistence and honors reduced motion text", async () => {
  const p = props();
  const view = await render(<SettingsPanel {...p} reducedMotion />);
  expect(screen.getByText(/Reduce Motion is on/)).toBeTruthy();
  const hapticSwitch = screen.getByRole("switch", { name: "Haptic feedback" });
  expect(hapticSwitch.props.value).toBe(true);
  expect(hapticSwitch).toBeChecked();
  await fireEvent(hapticSwitch, "valueChange", false);
  expect(p.onHaptics).toHaveBeenCalledTimes(1);
  await view.rerender(<SettingsPanel {...p} haptics={false} />);
  expect(
    screen.getByRole("switch", { name: "Haptic feedback" }).props.value,
  ).toBe(false);
  expect(screen.getByRole("switch", { name: "Haptic feedback" })).not.toBeChecked();
  expect(screen.getByText(/Motion follows your device settings/)).toBeTruthy();
});
test("busy settings block mutations and exposes preference recovery error", async () => {
  const p = props();
  await render(
    <SettingsPanel
      {...p}
      busy
      preferencesError="Preferences database unavailable"
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Preferences database unavailable",
  );
  const hapticSwitch = screen.getByRole("switch", { name: "Haptic feedback" });
  expect(hapticSwitch.props.disabled).toBe(true);
  expect(hapticSwitch).toBeDisabled();
  await fireEvent(hapticSwitch, "valueChange", false);
  for (const name of [
    "Show introduction",
    "Export backup",
    "Restore backup",
    "Clear this event",
    "Retry loading preferences",
  ]) {
    const button = screen.getByRole("button", { name });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
  }
  for (const callback of [
    p.onHaptics,
    p.onOnboarding,
    p.onExport,
    p.onRestore,
    p.onClear,
    p.onRetryPreferences,
  ])
    expect(callback).not.toHaveBeenCalled();
});
test("configured release destinations open only after an explicit press", async () => {
  Object.assign(releaseConfig, {
    privacyPolicyUrl: "https://dearo.example/privacy",
    supportUrl: "https://dearo.example/support",
    appStoreId: "123456789",
  });
  const p = props();
  await render(<SettingsPanel {...p} />);
  expect(p.onOpen).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Privacy & data" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Published privacy policy" }),
  );
  expect(p.onOpen).toHaveBeenLastCalledWith("https://dearo.example/privacy");
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to settings" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Help & support" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Contact support" }),
  );
  expect(p.onOpen).toHaveBeenLastCalledWith("https://dearo.example/support");
  await fireEvent.press(
    screen.getByRole("button", { name: "Back to settings" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "About Dearo" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Write an App Store review" }),
  );
  expect(p.onOpen).toHaveBeenLastCalledWith(
    "https://apps.apple.com/app/id123456789?action=write-review",
  );
});
