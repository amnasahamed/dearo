import React from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import type { Guest, GuestStatus } from "../domain";
import { Button, colors, s } from "./components";
const statusLabels: Record<GuestStatus, string> = {
  pending: "Not started",
  opened: "Opened, not confirmed",
  confirmed: "You confirmed sent",
  skipped: "Skipped",
  review: "Needs review",
};
export type GuestReviewProps = {
  guests: Guest[];
  pending: boolean;
  busy: boolean;
  onRevisit: (guest: Guest) => void;
  onManage: () => void;
};
export function GuestReview({
  guests,
  pending,
  busy,
  onRevisit,
  onManage,
}: GuestReviewProps) {
  return (
    <FlatList
      testID="guest-review-list"
      data={guests}
      keyExtractor={(guest) => guest.id}
      initialNumToRender={20}
      maxToRenderPerBatch={20}
      windowSize={5}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={{ padding: 24, gap: 16, paddingBottom: 40 }}
      ListHeaderComponent={
        <View style={{ gap: 10 }}>
          <Text style={s.body}>
            Review your guests and the progress you recorded.
          </Text>
          {pending ? (
            <Text accessibilityRole="alert" style={s.muted}>
              Resolve the current invitation before revisiting another guest.
            </Text>
          ) : null}
        </View>
      }
      ListEmptyComponent={<Text style={s.muted}>No guests yet.</Text>}
      renderItem={({ item: guest }) => {
        const disabled = busy || pending || !guest.selected;
        const action =
          guest.status === "confirmed"
            ? "Review confirmation"
            : "Invite this guest";
        return (
          <View
            style={{
              gap: 8,
              paddingVertical: 12,
              borderBottomWidth: 1,
              borderColor: colors.line,
            }}
          >
            <Text style={s.h2}>{guest.name.trim() || "Guest"}</Text>
            <Text style={s.body}>{guest.phone}</Text>
            <Text style={s.muted}>
              {statusLabels[guest.status]}
              {!guest.selected ? " · Not selected" : ""}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${action}: ${guest.name.trim() || "Guest"}, ${guest.phone}`}
              accessibilityState={{ disabled }}
              disabled={disabled}
              onPress={() => onRevisit(guest)}
              style={({ pressed }) => [
                s.button,
                s.secondary,
                (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
              ]}
            >
              <Text style={[s.buttonText, { color: colors.ink }]}>
                {action}
              </Text>
            </Pressable>
          </View>
        );
      }}
      ListFooterComponent={
        <Button
          title="Manage guest list"
          disabled={busy || pending}
          onPress={onManage}
        />
      }
    />
  );
}
