import React, { useState } from "react";
import { afterEach, expect, jest, test } from "@jest/globals";
import {
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react-native";
import { ImportReview } from "../src/ui/ImportReview";
import { GuestReview } from "../src/ui/GuestReview";
import type { Guest, ImportPreview } from "../src/domain";
afterEach(async () => {
  await cleanup();
});
const guests: Guest[] = [
  {
    id: "g1",
    name: "Alex",
    phone: "+14155552671",
    selected: true,
    status: "pending",
  },
  {
    id: "g2",
    name: "Alex",
    phone: "+442079460018",
    selected: false,
    status: "skipped",
  },
];
const preview: ImportPreview = {
  errors: [],
  rows: [
    { row: 1, name: "First", rawPhone: "+14155552672", phone: "+14155552672" },
    {
      row: 2,
      name: "Preferred",
      rawPhone: "+14155552672",
      phone: "+14155552672",
      duplicateOf: "row:1",
      conflict: true,
    },
    {
      row: 3,
      name: "Existing",
      rawPhone: "+14155552671",
      phone: "+14155552671",
      duplicateOf: "g1",
    },
    { row: 4, name: "Invalid", rawPhone: "123", error: "Invalid phone number" },
  ],
};
test("import selection switches canonical duplicate choice without automatically merging names", async () => {
  const onChange = jest.fn();
  const onApply = jest.fn();
  function Harness() {
    const [selectedRows, setSelected] = useState([1]);
    return (
      <ImportReview
        preview={preview}
        existingGuests={guests}
        selectedRows={selectedRows}
        onSelectedRows={(rows) => {
          onChange(rows);
          setSelected(rows);
        }}
        onApply={onApply}
        busy={false}
      />
    );
  }
  await render(<Harness />);
  const preferred = screen.getByRole("checkbox", {
    name: "Select Preferred, +14155552672, row 2",
  });
  await fireEvent.press(preferred);
  expect(onChange).toHaveBeenLastCalledWith([2]);
  expect(
    screen.getByRole("checkbox", { name: "Select First, +14155552672, row 1" }),
  ).not.toBeChecked();
  expect(preferred).toBeChecked();
  await fireEvent.press(screen.getByRole("button", { name: "Add 1 guests" }));
  expect(onApply).toHaveBeenCalledTimes(1);
  await fireEvent.press(preferred);
  expect(onChange).toHaveBeenLastCalledWith([]);
  expect(screen.getByRole("button", { name: "Add 0 guests" })).toBeDisabled();
});
test("import disables existing numbers, invalid rows and all selection while busy", async () => {
  const onSelectedRows = jest.fn();
  const p = {
    preview,
    existingGuests: guests,
    selectedRows: [1],
    onSelectedRows,
    onApply: jest.fn(),
    busy: false,
  };
  const view = await render(<ImportReview {...p} />);
  for (const name of [
    "Select Existing, +14155552671, row 3",
    "Select Invalid, 123, row 4",
  ]) {
    const row = screen.getByRole("checkbox", { name });
    expect(row).toBeDisabled();
    await fireEvent.press(row);
  }
  expect(onSelectedRows).not.toHaveBeenCalled();
  await view.rerender(<ImportReview {...p} busy />);
  for (const row of screen.getAllByRole("checkbox")) expect(row).toBeDisabled();
  expect(screen.getByRole("button", { name: "Add 1 guests" })).toBeDisabled();
});
test("import error and empty state remain visible without any selectable row", async () => {
  await render(
    <ImportReview
      preview={{ rows: [], errors: ["Unclosed CSV quote"] }}
      existingGuests={[]}
      selectedRows={[]}
      onSelectedRows={jest.fn()}
      onApply={jest.fn()}
      busy={false}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent("Unclosed CSV quote");
  expect(screen.getByText(/No guests can be added/)).toBeTruthy();
  expect(screen.getByRole("button", { name: "Add 0 guests" })).toBeDisabled();
});
test("large import initially renders a bounded subset, not every row", async () => {
  const rows = Array.from({ length: 5000 }, (_, i) => ({
    row: i + 1,
    name: `Synthetic ${i}`,
    rawPhone: `+1415555${String(i).padStart(4, "0")}`,
    phone: `+1415555${String(i).padStart(4, "0")}`,
  }));
  await render(
    <ImportReview
      preview={{ rows, errors: [] }}
      existingGuests={[]}
      selectedRows={[]}
      onSelectedRows={jest.fn()}
      onApply={jest.fn()}
      busy={false}
    />,
  );
  expect(screen.getAllByRole("checkbox").length).toBeLessThanOrEqual(20);
  expect(screen.queryByText("Synthetic 4999")).toBeNull();
});
test("guest review actions identify same-name guests by number and respect selection/pending", async () => {
  const onRevisit = jest.fn();
  const onManage = jest.fn();
  const view = await render(
    <GuestReview
      guests={guests}
      pending={false}
      busy={false}
      onRevisit={onRevisit}
      onManage={onManage}
    />,
  );
  await fireEvent.press(
    screen.getByRole("button", {
      name: "Invite this guest: Alex, +14155552671",
    }),
  );
  expect(onRevisit).toHaveBeenCalledWith(guests[0]);
  expect(
    screen.getByRole("button", {
      name: "Invite this guest: Alex, +442079460018",
    }),
  ).toBeDisabled();
  await fireEvent.press(
    screen.getByRole("button", { name: "Manage guest list" }),
  );
  expect(onManage).toHaveBeenCalledTimes(1);
  await view.rerender(
    <GuestReview
      guests={guests}
      pending
      busy={false}
      onRevisit={onRevisit}
      onManage={onManage}
    />,
  );
  expect(screen.getByRole("alert")).toHaveTextContent(
    /Resolve the current invitation/,
  );
  for (const button of screen.getAllByRole("button"))
    expect(button).toBeDisabled();
});
test("confirmed review and empty guest list have clear actions and status text", async () => {
  const onRevisit = jest.fn();
  const view = await render(
    <GuestReview
      guests={[{ ...guests[0], status: "confirmed" }]}
      pending={false}
      busy={false}
      onRevisit={onRevisit}
      onManage={jest.fn()}
    />,
  );
  expect(screen.getByText("You confirmed sent")).toBeTruthy();
  await fireEvent.press(
    screen.getByRole("button", {
      name: "Review confirmation: Alex, +14155552671",
    }),
  );
  expect(onRevisit).toHaveBeenCalledTimes(1);
  await view.rerender(
    <GuestReview
      guests={[]}
      pending={false}
      busy={false}
      onRevisit={onRevisit}
      onManage={jest.fn()}
    />,
  );
  expect(screen.getByText("No guests yet.")).toBeTruthy();
});
test("large guest review initially renders only twenty rows with dynamic-height text", async () => {
  const list = Array.from({ length: 5000 }, (_, index): Guest => ({
    id: `synthetic-${index}`,
    name: `Synthetic guest ${index}`,
    phone: `+1415555${String(index).padStart(4, "0")}`,
    selected: true,
    status: "pending",
  }));
  await render(
    <GuestReview
      guests={list}
      pending={false}
      busy={false}
      onRevisit={jest.fn()}
      onManage={jest.fn()}
    />,
  );
  expect(
    screen.getAllByRole("button", { name: /Invite this guest:/ }).length,
  ).toBeLessThanOrEqual(20);
  expect(screen.queryByText("Synthetic guest 4999")).toBeNull();
  expect(
    screen.getByText("Synthetic guest 0").props.numberOfLines,
  ).toBeUndefined();
});
