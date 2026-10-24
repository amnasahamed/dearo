import React from "react";
import { afterEach, expect, jest, test } from "@jest/globals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { Onboarding } from "../src/ui/Onboarding";
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
}));
afterEach(async () => {
  await cleanup();
});
test("introduction advances through three steps, supports back and finishes explicitly", async () => {
  const onFinish = jest.fn();
  const onSkip = jest.fn();
  await render(<Onboarding onFinish={onFinish} onSkip={onSkip} busy={false} />);
  expect(screen.getByText("Every invitation, personal.")).toBeTruthy();
  expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Back" })).toBeNull();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("Your people stay yours.")).toBeTruthy();
  expect(screen.getByText("Step 2 of 3")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByText("Step 1 of 3")).toBeTruthy();
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  expect(screen.getByText("You stay in control.")).toBeTruthy();
  expect(screen.getByText("Step 3 of 3")).toBeTruthy();
  expect(screen.getByText(/Opening a chat never marks it sent/)).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Create my invitation" }),
  );
  expect(onFinish).toHaveBeenCalledTimes(1);
  expect(onSkip).not.toHaveBeenCalled();
});
test("skip callback is explicit and does not count as finishing introduction", async () => {
  const onFinish = jest.fn();
  const onSkip = jest.fn();
  await render(<Onboarding onFinish={onFinish} onSkip={onSkip} busy={false} />);
  await fireEvent.press(
    screen.getByRole("button", { name: "Skip introduction" }),
  );
  expect(onSkip).toHaveBeenCalledTimes(1);
  expect(onFinish).not.toHaveBeenCalled();
});
test("busy introduction prevents skip, navigation and finishing while preserving error", async () => {
  const onFinish = jest.fn();
  const onSkip = jest.fn();
  const view = await render(
    <Onboarding onFinish={onFinish} onSkip={onSkip} busy={false} />,
  );
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await fireEvent.press(screen.getByRole("button", { name: "Continue" }));
  await view.rerender(
    <Onboarding
      onFinish={onFinish}
      onSkip={onSkip}
      busy
      error="Preferences could not be saved."
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Preferences could not be saved.",
  );
  for (const name of ["Create my invitation", "Back", "Skip introduction"]) {
    const button = screen.getByRole("button", { name });
    expect(button).toBeDisabled();
    await fireEvent.press(button);
  }
  expect(screen.getByText("Step 3 of 3")).toBeTruthy();
  expect(onFinish).not.toHaveBeenCalled();
  expect(onSkip).not.toHaveBeenCalled();
});
