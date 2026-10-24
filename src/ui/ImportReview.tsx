import React, { useMemo } from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import type { Guest, ImportPreview } from "../domain";
import { Button, colors, s } from "./components";
export type ImportReviewProps = {
  preview: ImportPreview;
  existingGuests: Guest[];
  selectedRows: number[];
  onSelectedRows: (rows: number[]) => void;
  onApply: () => void;
  busy: boolean;
};
export function ImportReview({
  preview,
  existingGuests,
  selectedRows,
  onSelectedRows,
  onApply,
  busy,
}: ImportReviewProps) {
  const existingPhones = useMemo(
    () => new Set(existingGuests.map((g) => g.phone)),
    [existingGuests],
  );
  const rowsById = useMemo(
    () => new Map(preview.rows.map((row) => [row.row, row])),
    [preview.rows],
  );
  const selected = useMemo(() => new Set(selectedRows), [selectedRows]);
  return (
    <FlatList
      testID="import-review-list"
      data={preview.rows}
      keyExtractor={(row) => String(row.row)}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={5}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, gap: 12, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <Text style={s.muted}>
            Review before adding. Invalid rows and existing numbers cannot be
            selected. For repeated numbers, select one name only.
          </Text>
          {preview.errors.map((error, index) => (
            <Text
              key={index}
              accessibilityRole="alert"
              style={{ ...s.body, color: colors.red }}
            >
              {error}
            </Text>
          ))}
        </View>
      }
      ListEmptyComponent={
        <Text style={s.body}>
          {preview.errors.length
            ? "No guests can be added until the import error is resolved."
            : "No guest rows found. Add a name and number, or choose another file."}
        </Text>
      }
      renderItem={({ item: row }) => {
        const existing = !!row.phone && existingPhones.has(row.phone);
        const disabled =
          busy ||
          !!row.error ||
          !row.phone ||
          existing ||
          preview.errors.length > 0;
        const checked = selected.has(row.row);
        const label = `${row.name.trim() || "Guest"}, ${row.phone || row.rawPhone || "Missing number"}`;
        return (
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel={`Select ${label}, row ${row.row}`}
            accessibilityState={{ checked, disabled }}
            disabled={disabled}
            onPress={() => {
              if (disabled) return;
              onSelectedRows(
                checked
                  ? selectedRows.filter((id) => id !== row.row)
                  : [
                      ...selectedRows.filter(
                        (id) => rowsById.get(id)?.phone !== row.phone,
                      ),
                      row.row,
                    ],
              );
            }}
            style={({ pressed }) => ({
              paddingVertical: 14,
              paddingHorizontal: 14,
              gap: 7,
              borderWidth: 1,
              borderColor: checked ? colors.blue : colors.line,
              borderRadius: 14,
              opacity: disabled ? 0.55 : pressed ? 0.75 : 1,
              backgroundColor: checked ? colors.surface : colors.white,
            })}
          >
            <Text style={s.label}>
              {checked ? "✓ " : ""}
              {row.name.trim() || "Guest"}
            </Text>
            <Text style={s.body}>
              {row.phone || row.rawPhone || "Missing number"}
            </Text>
            <Text style={s.muted}>
              {row.error ||
                (existing
                  ? "Already in your guest list"
                  : row.duplicateOf
                    ? row.conflict
                      ? "Same number, different name. Choose one row."
                      : "Repeated number. Choose one row."
                    : "Ready to add")}
            </Text>
          </Pressable>
        );
      }}
      ListFooterComponent={
        <View style={{ paddingTop: 12, gap: 12 }}>
          <Button
            title={`Add ${selectedRows.length} guests`}
            disabled={busy || !selectedRows.length || !!preview.errors.length}
            onPress={onApply}
          />
          <Text style={s.muted}>
            Adding guests only saves your list. It does not send invitations.
          </Text>
        </View>
      }
    />
  );
}
