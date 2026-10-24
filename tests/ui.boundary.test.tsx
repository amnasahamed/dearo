import React from "react";
import { Text } from "react-native";
import { afterEach, expect, jest, test } from "@jest/globals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { AppErrorBoundary } from "../src/ui/AppErrorBoundary";
jest.mock("react-native-safe-area-context", () => ({
  SafeAreaView:
    jest.requireActual<typeof import("react-native")>("react-native").View,
}));
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});
test("render failure offers a recoverable screen and reopens without a data-reset action", async () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  let shouldFail = true;
  function Child() {
    if (shouldFail) throw new Error("synthetic render failure");
    return <Text>Recovered invitation screen</Text>;
  }
  await render(
    <AppErrorBoundary>
      <Child />
    </AppErrorBoundary>,
  );
  expect(screen.getByText("Let’s try that again.")).toBeTruthy();
  expect(
    screen.getByText(/Your saved event has not been cleared/),
  ).toBeTruthy();
  expect(screen.queryByRole("button", { name: /clear|reset/i })).toBeNull();
  shouldFail = false;
  await fireEvent.press(screen.getByRole("button", { name: "Reopen Dearo" }));
  expect(screen.getByText("Recovered invitation screen")).toBeTruthy();
  expect(screen.queryByText("Let’s try that again.")).toBeNull();
});
