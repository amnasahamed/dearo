import React from "react";
import { Alert, AppState as NativeAppState } from "react-native";
import { beforeEach, afterEach, expect, jest, test } from "@jest/globals";
import { randomUUID, digestStringAsync } from "expo-crypto";
import { createHash } from "node:crypto";
import { preferencesRepository } from "../src/product/storage";
import { requestNativeReview } from "../src/product/review";
import {
  createProductPreferences,
  completeOnboarding,
  recordCompletedQueue,
  recordExplicitConfirmation,
  type ProductPreferences,
} from "../src/product/preferences";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react-native";
import DearoApp from "../src/ui/DearoApp";
import {
  createInitialState,
  serializeBackup,
  prepareHandoff,
  type AppState,
} from "../src/domain";
import { repository } from "../src/storage/sqlite";
import { openWhatsApp, pickImportFile, optionalHaptic } from "../src/services";

jest.mock("../src/storage/sqlite", () => ({
  repository: { load: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));
jest.mock("../src/services", () => ({
  openWhatsApp: jest.fn(),
  optionalHaptic: jest.fn(),
  copyText: jest.fn(),
  pickContactPhones: jest.fn(),
  pickImportFile: jest.fn(),
  shareBackup: jest.fn(),
}));
jest.mock("expo-crypto", () => ({
  randomUUID: jest.fn(),
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
}));
jest.mock("../src/product/storage", () => ({
  preferencesRepository: { load: jest.fn(), save: jest.fn(), clear: jest.fn() },
}));
jest.mock("../src/product/review", () => ({ requestNativeReview: jest.fn() }));
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
}));

const originalAppStateDescriptor = Object.getOwnPropertyDescriptor(
  NativeAppState,
  "currentState",
);
let saved: AppState;
let savedPreferences: ProductPreferences;
let sequence = 0;
const event = {
  id: "event",
  title: "Celebration",
  invitationUrl: "https://example.com/invite",
  messageTemplate: "Dear {guest}, {link}",
  countryCode: "US" as const,
};
function initial(): AppState {
  return {
    ...createInitialState(event),
    guests: [
      {
        id: "a",
        name: "Alex",
        phone: "+14155552671",
        selected: true,
        status: "pending",
      },
    ],
  };
}
beforeEach(() => {
  Object.defineProperty(NativeAppState, "currentState", {
    configurable: true,
    writable: true,
    value: "active",
  });
  saved = initial();
  savedPreferences = completeOnboarding(
    createProductPreferences(new Date().toISOString()),
  );
  jest
    .mocked(preferencesRepository.load)
    .mockImplementation(async () => savedPreferences);
  jest.mocked(preferencesRepository.save).mockImplementation(async (p) => {
    savedPreferences = JSON.parse(JSON.stringify(p));
  });
  jest.mocked(requestNativeReview).mockResolvedValue("requested");
  jest
    .mocked(digestStringAsync)
    .mockImplementation(async (_algorithm, text) =>
      createHash("sha256").update(text).digest("hex"),
    );
  sequence = 0;
  jest.mocked(randomUUID).mockImplementation(() => `generated-${++sequence}`);
  jest.mocked(repository.load).mockImplementation(async () => saved);
  jest.mocked(repository.save).mockImplementation(async (state) => {
    saved = JSON.parse(JSON.stringify(state));
  });
  jest.mocked(openWhatsApp).mockResolvedValue(undefined);
  jest.mocked(pickImportFile).mockResolvedValue(null);
  jest.spyOn(Alert, "alert").mockImplementation(() => {});
});
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
  if (originalAppStateDescriptor)
    Object.defineProperty(
      NativeAppState,
      "currentState",
      originalAppStateDescriptor,
    );
});
async function start() {
  await render(<DearoApp />);
  await screen.findByRole("button", { name: "Open WhatsApp" });
}
async function approve(label: string) {
  const calls = jest.mocked(Alert.alert).mock.calls;
  const button = calls[calls.length - 1]?.[2]?.find((b) => b.text === label);
  expect(button).toBeDefined();
  await act(async () => {
    button?.onPress?.();
  });
}
async function launch() {
  await fireEvent.press(screen.getByRole("button", { name: "Open WhatsApp" }));
  await approve("Continue");
}

test("opening WhatsApp never marks sent; only explicit confirmation does", async () => {
  await start();
  await launch();
  await screen.findByText("Did you send it?");
  expect(openWhatsApp).toHaveBeenCalledTimes(1);
  expect(saved.guests[0].status).toBe("opened");
  expect(saved.attempts).toHaveLength(0);
  await fireEvent.press(screen.getByRole("button", { name: "Sent, finish" }));
  await waitFor(() => expect(saved.guests[0].status).toBe("confirmed"));
  expect(saved.attempts).toHaveLength(1);
  expect(openWhatsApp).toHaveBeenCalledTimes(1);
});
test("failed persistence reports an error and prevents external launch", async () => {
  await start();
  jest.mocked(repository.save).mockRejectedValueOnce(new Error("disk full"));
  await launch();
  await screen.findByText("disk full");
  expect(openWhatsApp).not.toHaveBeenCalled();
  expect(saved.guests[0].status).toBe("pending");
});
test("two immediate launch confirmations create only one handoff", async () => {
  await start();
  await fireEvent.press(screen.getByRole("button", { name: "Open WhatsApp" }));
  const button = jest
    .mocked(Alert.alert)
    .mock.calls.at(-1)?.[2]
    ?.find((b) => b.text === "Continue");
  await act(async () => {
    button?.onPress?.();
    button?.onPress?.();
  });
  await screen.findByText("Did you send it?");
  expect(openWhatsApp).toHaveBeenCalledTimes(1);
  expect(repository.save).toHaveBeenCalledTimes(1);
});
test("failed atomic clear preserves current data and visible recovery", async () => {
  await start();
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Clear this event" }),
  );
  jest.mocked(repository.save).mockRejectedValueOnce(new Error("disk full"));
  await approve("Clear event");
  await waitFor(() =>
    expect(screen.getAllByText("disk full").length).toBeGreaterThan(0),
  );
  expect(saved.guests[0].name).toBe("Alex");
  expect(repository.clear).not.toHaveBeenCalled();
});
test("restore requires replacement confirmation and never launches WhatsApp", async () => {
  await start();
  const incoming = createInitialState({
    ...event,
    title: "Restored",
    invitationUrl: "",
  });
  jest.mocked(pickImportFile).mockResolvedValueOnce({
    name: "backup.json",
    extension: "json",
    text: serializeBackup(incoming),
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Restore backup" }));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenLastCalledWith(
      "Replace this event?",
      expect.any(String),
      expect.any(Array),
    ),
  );
  expect(saved.event.title).toBe("Celebration");
  await approve("Replace");
  await screen.findByText("Backup restored. Nothing was sent.");
  expect(saved.event.title).toBe("Restored");
  expect(screen.getByDisplayValue("Restored")).toBeTruthy();
  expect(openWhatsApp).not.toHaveBeenCalled();
});

async function enterPrivatePaste() {
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Add guests" }));
  await fireEvent.press(screen.getByRole("button", { name: "Paste a list" }));
  await fireEvent.changeText(
    screen.getByLabelText("Guest list"),
    "Private Person, +14155552672",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  await approve("Discard draft");
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
}
async function expectEmptyPaste() {
  await fireEvent.press(screen.getByRole("button", { name: "Add guests" }));
  await fireEvent.press(screen.getByRole("button", { name: "Paste a list" }));
  expect(screen.getByLabelText("Guest list").props.value).toBe("");
  expect(screen.queryByDisplayValue("Private Person, +14155552672")).toBeNull();
}
test("successful clear does not resurrect a discarded private paste draft", async () => {
  await start();
  await enterPrivatePaste();
  await fireEvent.press(
    screen.getByRole("button", { name: "Clear this event" }),
  );
  await approve("Clear event");
  await screen.findByText("Local event cleared.");
  expect(saved.guests).toHaveLength(0);
  await fireEvent.changeText(screen.getByLabelText("Event name"), "New event");
  await fireEvent.changeText(
    screen.getByLabelText("Invitation link"),
    "https://example.com/new",
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Save & choose guests" }),
  );
  await expectEmptyPaste();
});
test("successful restore does not resurrect a discarded private paste draft", async () => {
  await start();
  await enterPrivatePaste();
  const incoming = initial();
  incoming.event.title = "Another event";
  jest.mocked(pickImportFile).mockResolvedValueOnce({
    name: "backup.json",
    extension: "json",
    text: serializeBackup(incoming),
  });
  await fireEvent.press(screen.getByRole("button", { name: "Restore backup" }));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenLastCalledWith(
      "Replace this event?",
      expect.any(String),
      expect.any(Array),
    ),
  );
  await approve("Replace");
  await screen.findByText("Backup restored. Nothing was sent.");
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await expectEmptyPaste();
});
test("first-run skip is saved before dismissal and stays skipped after relaunch", async () => {
  savedPreferences = createProductPreferences(new Date().toISOString());
  const view = await render(<DearoApp />);
  await screen.findByText("Every invitation, personal.");
  expect(requestNativeReview).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  await screen.findByRole("button", { name: "Open WhatsApp" });
  expect(savedPreferences.onboarding.skippedVersion).toBe(1);
  expect(savedPreferences.onboarding.completedVersion).toBeNull();
  await view.unmount();
  await start();
  expect(screen.queryByText("Every invitation, personal.")).toBeNull();
  expect(requestNativeReview).not.toHaveBeenCalled();
});
test("failed first-run preference save keeps introduction visible instead of pretending success", async () => {
  savedPreferences = createProductPreferences(new Date().toISOString());
  jest
    .mocked(preferencesRepository.save)
    .mockRejectedValueOnce(new Error("settings disk full"));
  await render(<DearoApp />);
  await screen.findByText("Every invitation, personal.");
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  await screen.findByText("settings disk full");
  expect(screen.getByText("Every invitation, personal.")).toBeTruthy();
  expect(savedPreferences.onboarding.skippedVersion).toBeNull();
  expect(saved.guests[0].name).toBe("Alex");
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue without saving preference" }),
  );
  await screen.findByRole("button", { name: "Open WhatsApp" });
  expect(savedPreferences.onboarding.skippedVersion).toBeNull();
  expect(saved.guests[0].name).toBe("Alex");
  expect(requestNativeReview).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  await screen.findByText(
    "Introduction preference was not saved. Retry preferences in Settings.",
  );
});
test("corrupt preferences do not erase the event or silently overwrite settings", async () => {
  jest
    .mocked(preferencesRepository.load)
    .mockRejectedValueOnce(new Error("Settings corrupt; not overwritten"));
  await start();
  expect(saved.guests[0].name).toBe("Alex");
  expect(repository.save).not.toHaveBeenCalled();
  expect(preferencesRepository.save).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  await screen.findByText("Settings corrupt; not overwritten");
  await fireEvent.press(
    screen.getByRole("button", { name: "Retry loading preferences" }),
  );
  await waitFor(() =>
    expect(screen.queryByText("Settings corrupt; not overwritten")).toBeNull(),
  );
  expect(saved.guests[0].name).toBe("Alex");
});
test("clear and restore leave onboarding, haptics and review history intact", async () => {
  savedPreferences = { ...savedPreferences, hapticsEnabled: false };
  savedPreferences = recordCompletedQueue(
    recordExplicitConfirmation(savedPreferences, "historical-attempt"),
    "historical-queue",
  );
  const original = JSON.parse(JSON.stringify(savedPreferences));
  await start();
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  await fireEvent.press(
    screen.getByRole("button", { name: "Clear this event" }),
  );
  await approve("Clear event");
  await screen.findByText("Local event cleared.");
  expect(savedPreferences).toEqual(original);
  expect(preferencesRepository.clear).not.toHaveBeenCalled();
  jest.mocked(pickImportFile).mockResolvedValueOnce({
    name: "backup.json",
    extension: "json",
    text: serializeBackup(initial()),
  });
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  await fireEvent.press(screen.getByRole("button", { name: "Restore backup" }));
  await waitFor(() =>
    expect(Alert.alert).toHaveBeenLastCalledWith(
      "Replace this event?",
      expect.any(String),
      expect.any(Array),
    ),
  );
  await approve("Replace");
  await screen.findByText("Backup restored. Nothing was sent.");
  expect(savedPreferences).toEqual(original);
  expect(preferencesRepository.clear).not.toHaveBeenCalled();
});
test("invalid manual number is reported inside the still-open guest sheet", async () => {
  await start();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Add guests" }));
  await fireEvent.press(screen.getByRole("button", { name: "Add one guest" }));
  await fireEvent.changeText(
    screen.getByLabelText("Guest name"),
    "Invalid Guest",
  );
  await fireEvent.changeText(
    screen.getByLabelText("Phone number · default US"),
    "123",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Save guest" }));
  const sheet = within(
    screen.getByRole("button", { name: "Close" }).parent!.parent!,
  );
  await sheet.findByRole("alert");
  expect(sheet.getByRole("alert")).toHaveTextContent("Invalid phone number");
  expect(screen.getByLabelText("Guest name").props.value).toBe("Invalid Guest");
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  expect(saved.guests).toHaveLength(1);
});
test("malformed import displays a recoverable preview error without adding guests", async () => {
  jest.mocked(pickImportFile).mockResolvedValueOnce({
    name: "broken.csv",
    extension: "csv",
    text: 'name,phone\n"unclosed,+14155552672',
  });
  await start();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Add guests" }));
  await fireEvent.press(
    screen.getByRole("button", { name: "Import CSV or contact file" }),
  );
  await screen.findByText("Unclosed CSV quote");
  expect(screen.getByRole("button", { name: "Close" })).toBeTruthy();
  expect(saved.guests).toHaveLength(1);
  expect(repository.save).not.toHaveBeenCalled();
});
test("haptics preference persists across relaunch and disables optional feedback", async () => {
  const view = await render(<DearoApp />);
  await screen.findByRole("button", { name: "Open WhatsApp" });
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  const hapticSwitch = screen.getByRole("switch", { name: "Haptic feedback" });
  expect(hapticSwitch.props.value).toBe(true);
  await fireEvent(hapticSwitch, "valueChange", false);
  await waitFor(() =>
    expect(
      screen.getByRole("switch", { name: "Haptic feedback" }).props.value,
    ).toBe(false),
  );
  expect(savedPreferences.hapticsEnabled).toBe(false);
  await view.unmount();
  await start();
  await fireEvent.press(
    screen.getByRole("button", { name: "Privacy and backup" }),
  );
  expect(
    screen.getByRole("switch", { name: "Haptic feedback" }).props.value,
  ).toBe(false);
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  await launch();
  await screen.findByText("Did you send it?");
  await fireEvent.press(screen.getByRole("button", { name: "Sent, finish" }));
  await waitFor(() => expect(saved.guests[0].status).toBe("confirmed"));
  expect(optionalHaptic).not.toHaveBeenCalledWith(true);
});
test("first-day queue completion never requests review even with activity thresholds met", async () => {
  savedPreferences = recordCompletedQueue(
    recordCompletedQueue(savedPreferences, "q-old-one"),
    "q-old-two",
  );
  for (let i = 0; i < 5; i++)
    savedPreferences = recordExplicitConfirmation(savedPreferences, `old-${i}`);
  await start();
  await launch();
  await screen.findByText("Did you send it?");
  await fireEvent.press(screen.getByRole("button", { name: "Sent, finish" }));
  await waitFor(() => expect(saved.guests[0].status).toBe("confirmed"));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1600));
  });
  expect(requestNativeReview).not.toHaveBeenCalled();
  expect(savedPreferences.review.lastRequestedAt).toBeNull();
});
test("restored pending handoff suppresses onboarding and review even with old eligible preferences", async () => {
  savedPreferences = createProductPreferences("2026-01-01T00:00:00.000Z");
  for (let i = 0; i < 5; i++)
    savedPreferences = recordExplicitConfirmation(savedPreferences, `old-${i}`);
  savedPreferences = recordCompletedQueue(
    recordCompletedQueue(savedPreferences, "q1"),
    "q2",
  );
  saved = prepareHandoff(
    saved,
    "a",
    "pending-attempt",
    new Date().toISOString(),
  );
  await render(<DearoApp />);
  await screen.findByText("Did you send it?");
  expect(screen.queryByText("Every invitation, personal.")).toBeNull();
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1600));
  });
  expect(requestNativeReview).not.toHaveBeenCalled();
  expect(saved.pendingHandoff?.id).toBe("pending-attempt");
  expect(saved.guests[0].status).toBe("opened");
});
test("eligible completed queue persists review cooldown before native request", async () => {
  savedPreferences = completeOnboarding(
    createProductPreferences(
      new Date(Date.now() - 30 * 86400000).toISOString(),
    ),
  );
  savedPreferences = recordCompletedQueue(savedPreferences, "earlier-event");
  for (let i = 0; i < 4; i++)
    savedPreferences = recordExplicitConfirmation(
      savedPreferences,
      `earlier-${i}`,
    );
  jest.mocked(requestNativeReview).mockImplementation(async () => {
    expect(savedPreferences.review.lastRequestedAt).not.toBeNull();
    expect(saved.pendingHandoff).toBeNull();
    return "requested";
  });
  await start();
  await launch();
  await screen.findByText("Did you send it?");
  expect(requestNativeReview).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Sent, finish" }));
  await waitFor(() =>
    expect(savedPreferences.review.explicitConfirmationCount).toBe(5),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1600));
  });
  expect(savedPreferences.review.completedQueueCount).toBe(2);
  expect(requestNativeReview).toHaveBeenCalledTimes(1);
  expect(saved.guests[0].status).toBe("confirmed");
});
test.each(["clear", "restore"] as const)(
  "a completed queue followed immediately by %s cannot prompt from the stale milestone",
  async (action) => {
    savedPreferences = completeOnboarding(
      createProductPreferences(
        new Date(Date.now() - 30 * 86400000).toISOString(),
      ),
    );
    savedPreferences = recordCompletedQueue(savedPreferences, "earlier-event");
    for (let i = 0; i < 4; i++)
      savedPreferences = recordExplicitConfirmation(
        savedPreferences,
        `earlier-${i}`,
      );
    await start();
    await launch();
    await screen.findByText("Did you send it?");
    await fireEvent.press(screen.getByRole("button", { name: "Sent, finish" }));
    await waitFor(() =>
      expect(savedPreferences.review.explicitConfirmationCount).toBe(5),
    );
    await fireEvent.press(
      screen.getByRole("button", { name: "Privacy and backup" }),
    );
    if (action === "clear") {
      await fireEvent.press(
        screen.getByRole("button", { name: "Clear this event" }),
      );
      await approve("Clear event");
      await screen.findByText("Local event cleared.");
    } else {
      const incoming = initial();
      incoming.event = {
        ...incoming.event,
        id: "different-event",
        title: "Different event",
      };
      jest.mocked(pickImportFile).mockResolvedValueOnce({
        name: "backup.json",
        extension: "json",
        text: serializeBackup(incoming),
      });
      await fireEvent.press(
        screen.getByRole("button", { name: "Restore backup" }),
      );
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenLastCalledWith(
          "Replace this event?",
          expect.any(String),
          expect.any(Array),
        ),
      );
      await approve("Replace");
      await screen.findByText("Backup restored. Nothing was sent.");
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    });
    expect(requestNativeReview).not.toHaveBeenCalled();
    expect(savedPreferences.review.lastRequestedAt).toBeNull();
    expect(saved.event.id).not.toBe("event");
  },
);
test("continuing after failed onboarding save suppresses eligible reviews until explicit preference recovery", async () => {
  savedPreferences = createProductPreferences(
    new Date(Date.now() - 30 * 86400000).toISOString(),
  );
  savedPreferences = recordCompletedQueue(
    recordCompletedQueue(savedPreferences, "old-one"),
    "old-two",
  );
  for (let i = 0; i < 5; i++)
    savedPreferences = recordExplicitConfirmation(
      savedPreferences,
      `older-${i}`,
    );
  jest
    .mocked(preferencesRepository.save)
    .mockRejectedValueOnce(new Error("settings disk full"));
  await render(<DearoApp />);
  await screen.findByText("Every invitation, personal.");
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  await screen.findByText("settings disk full");
  await fireEvent.press(
    screen.getByRole("button", { name: "Continue without saving preference" }),
  );
  await screen.findByRole("button", { name: "Open WhatsApp" });
  await launch();
  await screen.findByText("Did you send it?");
  await fireEvent.press(screen.getByRole("button", { name: "Sent, finish" }));
  await waitFor(() => expect(saved.guests[0].status).toBe("confirmed"));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1600));
  });
  expect(requestNativeReview).not.toHaveBeenCalled();
  expect(savedPreferences.review.lastRequestedAt).toBeNull();
});
test("dirty paste Keep editing preserves draft while Discard leaves saved event untouched", async () => {
  const original = JSON.parse(JSON.stringify(saved));
  await start();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.press(screen.getByRole("button", { name: "Add guests" }));
  await fireEvent.press(screen.getByRole("button", { name: "Paste a list" }));
  await fireEvent.changeText(
    screen.getByLabelText("Guest list"),
    "Unsaved Person, +14155552672",
  );
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  expect(Alert.alert).toHaveBeenLastCalledWith(
    "Discard unsaved changes?",
    expect.any(String),
    expect.any(Array),
  );
  await approve("Keep editing");
  expect(screen.getByLabelText("Guest list").props.value).toBe(
    "Unsaved Person, +14155552672",
  );
  expect(saved).toEqual(original);
  await fireEvent.press(screen.getByRole("button", { name: "Close" }));
  await approve("Discard draft");
  expect(screen.queryByLabelText("Guest list")).toBeNull();
  expect(saved).toEqual(original);
  expect(repository.save).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole("button", { name: "Add guests" }));
  await fireEvent.press(screen.getByRole("button", { name: "Paste a list" }));
  expect(screen.getByLabelText("Guest list").props.value).toBe("");
});
test("first invitation screen shows static brand rather than a nonfunctional Back control", async () => {
  saved = createInitialState({ ...event, title: "", invitationUrl: "" });
  await render(<DearoApp />);
  await screen.findByLabelText("Event name");
  expect(screen.getByText("dearo")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
});
test("pending invitation disables Back and cannot navigate away from explicit confirmation", async () => {
  await start();
  await launch();
  await screen.findByText("Did you send it?");
  const back = screen.getByRole("button", { name: "Back" });
  expect(back).toBeDisabled();
  await fireEvent.press(back);
  expect(screen.getByText("Did you send it?")).toBeTruthy();
  expect(saved.pendingHandoff).not.toBeNull();
  expect(saved.guests[0].status).toBe("opened");
  expect(screen.queryByLabelText("Search guests")).toBeNull();
});
test("search with no matching guests differs from an empty guest list and never deletes data", async () => {
  await start();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  await fireEvent.changeText(
    screen.getByLabelText("Search guests"),
    "no such person",
  );
  expect(screen.getByText("No matching guests.")).toBeTruthy();
  expect(
    screen.getByText("Try another name or number in search."),
  ).toBeTruthy();
  expect(screen.queryByText("Start with your first guest.")).toBeNull();
  expect(saved.guests).toHaveLength(1);
  await fireEvent.changeText(screen.getByLabelText("Search guests"), "Alex");
  expect(screen.queryByText("No matching guests.")).toBeNull();
  expect(
    screen.getByRole("button", { name: "Edit Alex, +14155552671" }),
  ).toBeTruthy();
  expect(repository.save).not.toHaveBeenCalled();
});

test("invitation continuation stays in a separate action footer and saves the form", async () => {
  saved = createInitialState(event);
  await render(<DearoApp />);
  await screen.findByText("Make it personal.");
  const footer = screen.getByTestId("invitation-actions");
  expect(
    within(footer).getByRole("button", { name: "Save & choose guests" }),
  ).toBeTruthy();
  await fireEvent.changeText(
    screen.getByLabelText("Event name"),
    "Updated celebration",
  );
  await fireEvent.press(
    within(footer).getByRole("button", { name: "Save & choose guests" }),
  );
  await screen.findByText("Your people.");
  expect(saved.event.title).toBe("Updated celebration");
});
