import React from "react";
import {
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
export const colors = {
  ink: "#12151D",
  muted: "#697180",
  blue: "#2458EE",
  surface: "#F4F6F9",
  line: "#E1E5EC",
  white: "#FFFFFF",
  red: "#A2263D",
};
export function Button({
  title,
  onPress,
  secondary = false,
  disabled = false,
  destructive = false,
}: {
  title: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        destructive && { backgroundColor: colors.red },
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.ink }]}>
        {title}
      </Text>
    </Pressable>
  );
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={{ gap: 7 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[
          s.field,
          props.multiline && { minHeight: 130, textAlignVertical: "top" },
        ]}
        {...props}
      />
    </View>
  );
}
export function Sheet({
  title,
  visible,
  onClose,
  children,
  scroll = true,
}: {
  title: string;
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  scroll?: boolean;
}) {
  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={s.safe}>
        <View style={s.sheetHeader}>
          <Text accessibilityRole="header" style={s.h2}>
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Close"
            style={s.close}
          >
            <Text style={s.link}>Close</Text>
          </Pressable>
        </View>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {scroll ? (
            <ScrollView
              keyboardDismissMode="interactive"
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.sheetContent}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={{ flex: 1 }}>{children}</View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
export const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.white },
  page: { flex: 1, paddingHorizontal: 24 },
  header: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
  },
  brand: {
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: -0.8,
    color: colors.ink,
  },
  link: { fontSize: 15, fontWeight: "600", color: colors.blue },
  eyebrow: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1.1,
    color: colors.muted,
  },
  h1: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: "700",
    letterSpacing: -1.0,
    color: colors.ink,
  },
  h2: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: "700",
    letterSpacing: -0.5,
    color: colors.ink,
  },
  body: { fontSize: 16, lineHeight: 24, color: colors.ink },
  muted: { fontSize: 14, lineHeight: 21, color: colors.muted },
  label: { fontSize: 13, fontWeight: "600", color: colors.ink },
  field: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    padding: 15,
    fontSize: 16,
    color: colors.ink,
    minHeight: 52,
  },
  button: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: colors.blue,
    paddingHorizontal: 18,
    paddingVertical: 15,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "700",
    color: colors.white,
    textAlign: "center",
  },
  secondary: { backgroundColor: colors.surface },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  footer: {
    paddingVertical: 14,
    gap: 10,
    borderTopWidth: 1,
    borderColor: colors.line,
  },
  row: {
    flexDirection: "row",
    gap: 13,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  avatar: {
    height: 44,
    width: 44,
    borderRadius: 22,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: colors.ink, fontWeight: "600", fontSize: 17 },
  check: {
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.muted,
    alignItems: "center",
    justifyContent: "center",
  },
  checked: { backgroundColor: colors.blue, borderColor: colors.blue },
  sheetHeader: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  sheetContent: { padding: 24, gap: 18, paddingBottom: 48 },
  close: { padding: 12, minHeight: 44 },
  error: { padding: 16, borderRadius: 14, backgroundColor: "#FFF0F1" },
  progress: {
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.line,
    overflow: "hidden",
    marginBottom: 20,
  },
});
