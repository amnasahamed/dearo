import React, { useState } from "react";
import { Text, View, Pressable, Switch } from "react-native";
import { Button, colors, s } from "./components";
import {
  appReviewUrl,
  privacyNotice,
  releaseConfig,
  verifiedHttpsUrl,
} from "../product/release";
function SettingsRow({
  title,
  onPress,
  disabled = false,
  danger = false,
  disclosure = false,
}: {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  disclosure?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 54,
        paddingHorizontal: 16,
        paddingVertical: 14,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        borderBottomWidth: 1,
        borderColor: colors.line,
        opacity: disabled ? 0.45 : pressed ? 0.65 : 1,
      })}
    >
      <Text
        style={[s.body, { flex: 1, color: danger ? colors.red : colors.ink }]}
      >
        {title}
      </Text>
      {disclosure ? (
        <Text
          accessibilityElementsHidden
          importantForAccessibility="no"
          style={s.muted}
        >
          ›
        </Text>
      ) : null}
    </Pressable>
  );
}
const groupStyle = {
  backgroundColor: colors.surface,
  borderRadius: 16,
  overflow: "hidden" as const,
};
type Props = {
  busy: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  onHaptics: () => void;
  onExport: () => void;
  onRestore: () => void;
  onClear: () => void;
  onOnboarding: () => void;
  onOpen: (url: string) => void;
  onCopyDiagnostics: () => void;
  onRetryPreferences: () => void;
  preferencesError: string;
  onResetPreferences?: () => void;
};
export function SettingsPanel(p: Props) {
  const [section, setSection] = useState<"main" | "privacy" | "help" | "about">(
    "main",
  );
  const privacyUrl = verifiedHttpsUrl(releaseConfig.privacyPolicyUrl),
    supportUrl = verifiedHttpsUrl(releaseConfig.supportUrl),
    reviewUrl = appReviewUrl(releaseConfig.appStoreId);
  if (section === "privacy")
    return (
      <>
        <Button
          title="Back to settings"
          secondary
          onPress={() => setSection("main")}
        />
        <Text accessibilityRole="header" style={s.h2}>
          Your privacy
        </Text>
        {privacyNotice.map((t) => (
          <Text key={t} style={s.body}>
            {t}
          </Text>
        ))}
        <Button
          title="Published privacy policy"
          secondary
          disabled={!privacyUrl || p.busy}
          onPress={() => privacyUrl && p.onOpen(privacyUrl)}
        />
        {!privacyUrl ? (
          <Text style={s.muted}>
            The public privacy-policy address must be configured before this
            development build is released.
          </Text>
        ) : null}
      </>
    );
  if (section === "help")
    return (
      <>
        <Button
          title="Back to settings"
          secondary
          onPress={() => setSection("main")}
        />
        <Text accessibilityRole="header" style={s.h2}>
          A little help
        </Text>
        {[
          [
            "How do I invite someone?",
            "Save your invitation, add or select guests, then open WhatsApp. Tap Send there and return to confirm.",
          ],
          [
            "What if I did not send?",
            "Choose Not yet. The guest stays unconfirmed for review. While an invitation is awaiting confirmation, retry opens its saved message. After Not yet, revisiting prepares a fresh message. Check WhatsApp to avoid sending twice.",
          ],
          [
            "Can I work offline?",
            "Prepare and organise your list offline. Opening WhatsApp and delivering messages depend on WhatsApp and your connection.",
          ],
          [
            "Which WhatsApp account sends?",
            "Your device chooses the app. Check the account inside WhatsApp, especially if WhatsApp Business is also installed. Dearo cannot select an account.",
          ],
          [
            "Contacts unavailable?",
            "Use Add one guest, paste a list or import CSV/VCF. Dearo does not need access to your whole address book.",
          ],
          [
            "Changing phones or reinstalling?",
            "Export a private backup first. Restore it on the other device. The current event is replaced only after confirmation.",
          ],
        ].map(([q, a]) => (
          <View key={q} style={{ gap: 7 }}>
            <Text accessibilityRole="header" style={s.label}>
              {q}
            </Text>
            <Text style={s.body}>{a}</Text>
          </View>
        ))}
        <Button
          title="Contact support"
          secondary
          disabled={!supportUrl || p.busy}
          onPress={() => supportUrl && p.onOpen(supportUrl)}
        />
        {!supportUrl ? (
          <Text style={s.muted}>
            A verified support destination is not configured in this development
            build.
          </Text>
        ) : null}
        <Button
          title="Copy app diagnostics"
          secondary
          onPress={p.onCopyDiagnostics}
          disabled={p.busy}
        />
        <Text style={s.muted}>
          Copies app/platform details only, never your invitation, guest list or
          phone numbers. You choose whether to share it.
        </Text>
      </>
    );
  if (section === "about")
    return (
      <>
        <Button
          title="Back to settings"
          secondary
          onPress={() => setSection("main")}
        />
        <Text accessibilityRole="header" style={s.h1}>
          dearo
        </Text>
        <Text style={s.body}>Version 0.1.0 · Development build</Text>
        <Text style={s.body}>
          A personal invitation companion. Not affiliated with WhatsApp or Meta.
        </Text>
        <Text style={s.muted}>
          This build has not completed App Store or physical-device acceptance.
        </Text>
        <Button
          title="Write an App Store review"
          secondary
          disabled={!reviewUrl || p.busy}
          onPress={() => reviewUrl && p.onOpen(reviewUrl)}
        />
        {!reviewUrl ? (
          <Text style={s.muted}>
            Reviews become available when a verified App Store listing is
            configured.
          </Text>
        ) : null}
      </>
    );
  return (
    <>
      <Text accessibilityRole="header" style={s.h2}>
        Make Dearo yours.
      </Text>
      <View style={groupStyle}>
        <SettingsRow
          title="Privacy & data"
          disclosure
          onPress={() => setSection("privacy")}
        />
        <SettingsRow
          title="Help & support"
          disclosure
          onPress={() => setSection("help")}
        />
        <SettingsRow
          title="About Dearo"
          disclosure
          onPress={() => setSection("about")}
        />
        <SettingsRow
          title="Show introduction"
          disclosure
          onPress={p.onOnboarding}
          disabled={p.busy}
        />
      </View>
      <Text accessibilityRole="header" style={s.label}>
        PREFERENCES
      </Text>
      <View style={groupStyle}>
        <View
          style={{
            minHeight: 54,
            padding: 16,
            flexDirection: "row",
            flexWrap: "wrap",
            gap: 12,
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Text style={s.body}>Haptic feedback</Text>
          <Switch
            accessibilityLabel="Haptic feedback"
            accessibilityState={{ disabled: p.busy, checked: p.haptics }}
            value={p.haptics}
            onValueChange={() => {
              if (!p.busy) p.onHaptics();
            }}
            disabled={p.busy}
            trackColor={{ false: colors.line, true: colors.blue }}
          />
        </View>
        {p.onResetPreferences ? (
          <SettingsRow
            title="Reset app preferences"
            onPress={p.onResetPreferences}
            disabled={p.busy}
          />
        ) : null}
      </View>
      <Text style={s.muted}>
        Haptics are saved on this device.{" "}
        {p.reducedMotion
          ? "Reduce Motion is on."
          : "Motion follows your device settings."}
      </Text>
      {p.preferencesError ? (
        <>
          <Text accessibilityRole="alert" style={s.body}>
            {p.preferencesError}
          </Text>
          <Button
            title="Retry loading preferences"
            secondary
            onPress={p.onRetryPreferences}
            disabled={p.busy}
          />
        </>
      ) : null}
      <Text accessibilityRole="header" style={s.h2}>
        Your event
      </Text>
      <View style={groupStyle}>
        <SettingsRow
          title="Export backup"
          onPress={p.onExport}
          disabled={p.busy}
        />
        <SettingsRow
          title="Restore backup"
          onPress={p.onRestore}
          disabled={p.busy}
        />
      </View>
      <View style={groupStyle}>
        <SettingsRow
          title="Clear this event"
          danger
          onPress={p.onClear}
          disabled={p.busy}
        />
      </View>
      <Text style={s.muted}>
        Clearing an event does not delete external backups or WhatsApp messages.
      </Text>
    </>
  );
}
