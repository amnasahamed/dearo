import React from "react";
import { afterEach, expect, jest, test } from "@jest/globals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { CountryPicker, countryLabel } from "../src/ui/CountryPicker";
afterEach(async () => {
  await cleanup();
  jest.restoreAllMocks();
});
test("country labels include readable names and calling codes, with a bounded initial list", async () => {
  await render(
    <CountryPicker selected="US" onSelect={jest.fn()} busy={false} />,
  );
  expect(countryLabel("US")).toBe("United States (+1)");
  expect(screen.getByText("Selected: United States (+1)")).toBeTruthy();
  expect(screen.getByText(/Showing the first 30 matches/)).toBeTruthy();
  expect(screen.getAllByRole("button")).toHaveLength(30);
});
test("search by country name, ISO code and calling code selects the supported ISO country", async () => {
  const onSelect = jest.fn();
  await render(
    <CountryPicker selected="US" onSelect={onSelect} busy={false} />,
  );
  const search = screen.getByLabelText("Search country or calling code");
  await fireEvent.changeText(search, "India");
  await fireEvent.press(screen.getByRole("button", { name: "India (+91)" }));
  expect(onSelect).toHaveBeenLastCalledWith("IN");
  await fireEvent.changeText(search, "GB");
  await fireEvent.press(
    screen.getByRole("button", { name: "United Kingdom (+44)" }),
  );
  expect(onSelect).toHaveBeenLastCalledWith("GB");
  await fireEvent.changeText(search, "+971");
  await fireEvent.press(
    screen.getByRole("button", { name: "United Arab Emirates (+971)" }),
  );
  expect(onSelect).toHaveBeenLastCalledWith("AE");
});
test("unknown country search reports recovery and busy picker cannot change selection", async () => {
  const onSelect = jest.fn();
  const view = await render(
    <CountryPicker selected="US" onSelect={onSelect} busy={false} />,
  );
  await fireEvent.changeText(
    screen.getByLabelText("Search country or calling code"),
    "not-a-real-country",
  );
  expect(screen.getByRole("alert")).toHaveTextContent(/No matching country/);
  expect(screen.queryAllByRole("button")).toHaveLength(0);
  await fireEvent.changeText(
    screen.getByLabelText("Search country or calling code"),
    "India",
  );
  await view.rerender(<CountryPicker selected="US" onSelect={onSelect} busy />);
  const india = screen.getByRole("button", { name: "India (+91)" });
  expect(india).toBeDisabled();
  await fireEvent.press(india);
  expect(onSelect).not.toHaveBeenCalled();
});
