import React, { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button, colors, s } from "./components";
const pages = [
  {
    title: "Every invitation, personal.",
    body: "Prepare your invitation once. Choose your people. Open a personalised WhatsApp message for each guest.",
    number: "01",
  },
  {
    title: "Your people stay yours.",
    body: "Pick only the contacts you need, paste a list or add a number. No account. No address-book upload. No permissions to get started.",
    number: "02",
  },
  {
    title: "You stay in control.",
    body: "Tap Send inside WhatsApp, then return and confirm in Dearo. Opening a chat never marks it sent. Your progress is saved before you leave.",
    number: "03",
  },
];
export function Onboarding({
  onFinish,
  onSkip,
  busy,
  error,
  onContinueWithoutSaving,
}: {
  onFinish: () => void;
  onSkip: () => void;
  busy: boolean;
  error?: string;
  onContinueWithoutSaving?: () => void;
}) {
  const [step, setStep] = useState(0);
  const page = pages[step];
  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: 24, gap: 24 }}>
        <View
          style={{
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={s.brand}>dearo</Text>
          <Button
            title="Skip introduction"
            secondary
            onPress={onSkip}
            disabled={busy}
          />
        </View>
        <View
          style={{
            flex: 1,
            justifyContent: "center",
            gap: 24,
            paddingVertical: 28,
          }}
        >
          <Text
            style={[s.h1, { fontSize: 64, lineHeight: 76, color: colors.blue }]}
            accessibilityElementsHidden
            importantForAccessibility="no"
          >
            {page.number}
          </Text>
          <Text accessibilityRole="header" style={s.h1}>
            {page.title}
          </Text>
          <Text style={s.body}>{page.body}</Text>
          <Text accessibilityLiveRegion="polite" style={s.muted}>
            Step {step + 1} of {pages.length}
          </Text>
        </View>
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.red }}>
            {error}
          </Text>
        ) : null}
        {error && onContinueWithoutSaving ? (
          <>
            <Button
              title="Continue without saving preference"
              secondary
              onPress={onContinueWithoutSaving}
              disabled={busy}
            />
            <Text style={s.muted}>
              The introduction may appear again next time. Your event is not
              changed.
            </Text>
          </>
        ) : null}
        <Button
          title={
            step === pages.length - 1 ? "Create my invitation" : "Continue"
          }
          onPress={() =>
            step === pages.length - 1 ? onFinish() : setStep(step + 1)
          }
          disabled={busy}
        />
        {step > 0 ? (
          <Button
            title="Back"
            secondary
            onPress={() => setStep(step - 1)}
            disabled={busy}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
