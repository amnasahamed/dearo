import { ImportReview } from "./ImportReview";
import { GuestReview } from "./GuestReview";
import { CountryPicker, countryLabel } from "./CountryPicker";
import { PreferencesController } from "../product/controller";
import { Onboarding } from "./Onboarding";
import { SettingsPanel } from "./SettingsPanel";
import { preferencesRepository } from "../product/storage";
import { requestNativeReview } from "../product/review";
import {
  completeOnboarding,
  createProductPreferences,
  skipOnboarding,
  shouldShowOnboarding,
  setHapticsEnabled,
  recordExplicitConfirmation,
  recordCompletedQueue,
  isReviewEligible,
  markReviewRequested,
  type ProductPreferences,
} from "../product/preferences";
import { safeMessage, resumeScreen, type Screen } from "./presentation";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  AppState as NativeAppState,
  BackHandler,
  FlatList,
  KeyboardAvoidingView,
  Keyboard,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Crypto from "expo-crypto";
import { isSupportedCountry } from "libphonenumber-js";
import {
  applyImportDecisions,
  editGuestDetails,
  cancelHandoff,
  createInitialState,
  importContactsPreview,
  nextGuest,
  normalizePhone,
  parseBackup,
  prepareMessage,
  revisitGuest,
  serializeBackup,
  skipGuest,
  undoConfirmation,
  validateInvitationUrl,
  type AppState,
  type Event,
  type Guest,
  type ImportPreview,
} from "../domain";
import { EventController } from "../storage/controller";
import { repository } from "../storage/sqlite";
import {
  copyText,
  openWhatsApp,
  optionalHaptic,
  pickContactPhones,
  pickImportFile,
  shareBackup,
  type PhoneCandidate,
} from "../services";
import { Button, colors, Field, Sheet, s } from "./components";
const id = () => Crypto.randomUUID();
const now = () => new Date().toISOString();
const initialEvent = (): Event => ({
  id: id(),
  title: "",
  invitationUrl: "",
  messageTemplate:
    "Dear {guest}, we would love to celebrate with you.\n\n{link}",
  countryCode: "IN",
});
const stateLabel = {
  pending: "Not started",
  opened: "Awaiting confirmation",
  confirmed: "Marked sent by you",
  skipped: "Skipped",
  review: "Needs review",
};

type Panel =
  | null
  | "message"
  | "add"
  | "manual"
  | "paste"
  | "import"
  | "privacy"
  | "review"
  | "edit"
  | "contact"
  | "country";
function ErrorNotice({ error }: { error: string }) {
  return error ? (
    <View style={s.error}>
      <Text accessibilityRole="alert" style={[s.body, { color: colors.red }]}>
        {error}
      </Text>
    </View>
  ) : null;
}
export default function DearoApp() {
  const [data, setData] = useState<AppState | null>(null),
    [loading, setLoading] = useState(true),
    [loadError, setLoadError] = useState(""),
    [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("invitation"),
    [panel, setPanel] = useState<Panel>(null),
    [notice, setNotice] = useState(""),
    [error, setError] = useState("");
  const [draft, setDraft] = useState<Event>(initialEvent),
    [name, setName] = useState(""),
    [phone, setPhone] = useState(""),
    [search, setSearch] = useState(""),
    [paste, setPaste] = useState(""),
    [editing, setEditing] = useState<Guest | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null),
    [importRows, setImportRows] = useState<number[]>([]),
    [reducedMotion, setReducedMotion] = useState(false),
    [senderChecked, setSenderChecked] = useState(false);
  const [preferences, setPreferences] = useState<ProductPreferences | null>(
    null,
  );

  const [preferencesError, setPreferencesError] = useState("");
  const [reviewSuppressed, setReviewSuppressed] = useState(false);
  const [onboardingVisible, setOnboardingVisible] = useState(false);
  const [reviewReady, setReviewReady] = useState<string | null>(null);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const haptics = preferences?.hapticsEnabled ?? false;
  const [preferencesController] = useState(
    () => new PreferencesController(preferencesRepository, setPreferences),
  );
  const savePreferences = useCallback(
    async (transform: (p: ProductPreferences) => ProductPreferences) => {
      const next = await preferencesController.update(transform);
      setPreferencesError("");
      return next;
    },
    [preferencesController],
  );
  const loadPreferences = useCallback(async () => {
    try {
      const loaded = await preferencesController.load();
      setReviewSuppressed(false);
      setPreferencesError("");
      return loaded;
    } catch (e) {
      setPreferencesError(
        e instanceof Error ? e.message : "Preferences could not be loaded.",
      );
      return null;
    }
  }, [preferencesController]);
  const [contactChoices, setContactChoices] = useState<PhoneCandidate[]>([]);
  const [controller] = useState(
    () =>
      new EventController(repository, { open: openWhatsApp, id, now }, setData),
  );
  const actionBusy = useRef(false);
  const run = useCallback(
    async (operation: () => Promise<void>) => {
      if (controller.busy || actionBusy.current) return;
      actionBusy.current = true;
      setBusy(true);
      setError("");
      try {
        await operation();
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Something went wrong. Your previous saved progress is unchanged.",
        );
      } finally {
        actionBusy.current = false;
        setBusy(false);
      }
    },
    [controller],
  );
  useEffect(() => {
    let live = true;
    (async () => {
      const productPromise = loadPreferences();
      try {
        let saved = await controller.load();
        if (!saved) {
          saved = createInitialState(initialEvent());
          await controller.update(() => saved!);
        }
        if (live) {
          const product = await productPromise;
          if (product)
            setOnboardingVisible(
              shouldShowOnboarding(product) && !saved.pendingHandoff,
            );
          setDraft(saved.event);
          setScreen(resumeScreen(saved));
        }
      } catch (e) {
        if (live)
          setLoadError(
            e instanceof Error ? e.message : "Saved data could not be read.",
          );
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [controller, loadPreferences]);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReducedMotion)
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReducedMotion,
    );
    return () => sub.remove();
  }, []);
  // Foreground restores the pending card. It never changes any sending status.
  useEffect(() => {
    const sub = NativeAppState.addEventListener("change", (value) => {
      if (value === "active" && controller.state?.pendingHandoff) {
        setScreen("send");
        const pending = controller.state.pendingHandoff;
        const person = controller.state.guests.find(
          (g) => g.id === pending.guestId,
        );
        AccessibilityInfo.announceForAccessibility(
          `Invitation for ${person?.name || "guest"}, ${pending.recipient}. Awaiting your confirmation.`,
        );
      }
    });
    return () => sub.remove();
  }, [controller]);
  const update = async (transform: (state: AppState) => AppState) =>
    controller.update((current) => {
      if (!current) throw Error("No event loaded");
      return transform(current);
    });
  const feedback = () => {
    void optionalHaptic(haptics && !reducedMotion);
  };
  const showPanel = (value: Panel) => {
    setReviewReady(null);
    setError("");
    setPanel(value);
  };
  const copy = async (text: string) => {
    await copyText(text);
    setNotice("Copied");
    feedback();
  };
  const saveInvitation = () =>
    run(async () => {
      if (!draft.title.trim()) throw Error("Add a name for this event.");
      if (!isSupportedCountry(draft.countryCode))
        throw Error("Use a two-letter country code, such as IN, AE, GB or US.");
      const event = {
        ...draft,
        title: draft.title.trim(),
        invitationUrl: validateInvitationUrl(draft.invitationUrl),
      };
      prepareMessage(event, "Anjali & family");
      await update((current) => ({ ...current, event }));
      setDraft(event);
      setPanel(null);
      setScreen("guests");
      setNotice("Invitation saved on this device.");
    });
  const acceptPreview = (text: string, format: "csv" | "paste" | "vcf") => {
    const p = importContactsPreview(
      text,
      format,
      data!.event.countryCode,
      data!.guests,
    );
    setPreview(p);
    setImportRows(
      p.rows.filter((r) => !r.error && !r.duplicateOf).map((r) => r.row),
    );
    showPanel("import");
  };
  const importFile = () =>
    run(async () => {
      const file = await pickImportFile();
      if (!file) return;
      acceptPreview(file.text, /\.vcf$/i.test(file.name) ? "vcf" : "csv");
    });
  const addManual = () =>
    run(async () => {
      if (!data) return;
      const canonical = normalizePhone(phone, data.event.countryCode);
      if (!name.trim())
        throw Error("Add the name you want to use in the invitation.");
      if (name.length > 200) throw Error("Guest name is too long.");
      if (
        data.guests.some((g) => g.phone === canonical && g.id !== editing?.id)
      )
        throw Error(
          "That number is already in this event. Edit the existing guest instead.",
        );
      if (data.pendingHandoff)
        throw Error("Resolve the current invitation before editing guests.");
      await update((current) =>
        editing
          ? editGuestDetails(current, editing.id, { name, phone: canonical })
          : {
              ...current,
              guests: [
                ...current.guests,
                {
                  id: id(),
                  name: name.trim(),
                  phone: canonical,
                  selected: true,
                  status: "pending",
                },
              ],
            },
      );
      setName("");
      setPhone("");
      setEditing(null);
      setPanel(null);
      setNotice("Guest saved.");
      feedback();
    });
  const chooseContact = () =>
    run(async () => {
      const candidates = await pickContactPhones();
      if (candidates === null) return;
      if (!candidates.length)
        throw Error(
          "This contact has no phone number. You can add one manually.",
        );
      const choose = (c: (typeof candidates)[number]) => {
        setName(c.name);
        setPhone(c.phone);
        setEditing(null);
        showPanel("manual");
      };
      if (candidates.length === 1) choose(candidates[0]);
      else {
        setContactChoices(candidates);
        showPanel("contact");
      }
    });
  const begin = () => {
    setReviewReady(null);
    if (!data?.guests.some((g) => g.selected))
      return setError("Choose at least one guest.");
    try {
      prepareMessage(data.event, "Guest");
    } catch (e) {
      return setError((e as Error).message);
    }
    setScreen("send");
    setNotice("");
  };
  const openGuest = (guest: Guest) => {
    setReviewReady(null);
    const launch = () =>
      run(async () => {
        await controller.openGuest(guest.id);
        feedback();
      });
    if (!senderChecked)
      Alert.alert(
        "Check your WhatsApp account",
        "Your device chooses which WhatsApp app opens. Make sure it is using the number you want to send from. You will still tap Send in WhatsApp.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Continue",
            onPress: () => {
              setSenderChecked(true);
              void launch();
            },
          },
        ],
      );
    else void launch();
  };
  useEffect(() => {
    if (notice) AccessibilityInfo.announceForAccessibility(notice);
  }, [notice]);
  const confirmNext = () => {
    const attempt = data?.pendingHandoff;
    if (!attempt) return;
    void run(async () => {
      try {
        await controller.confirmAndNext(attempt.id);
      } finally {
        const current = controller.state;
        if (
          current?.attempts.some(
            (a) => a.id === attempt.id && a.outcome === "confirmed",
          ) &&
          preferencesController.current
        ) {
          try {
            const completed =
              !current.pendingHandoff &&
              current.guests.some((g) => g.selected) &&
              current.guests
                .filter((g) => g.selected)
                .every((g) => g.status === "confirmed");
            const confirmationKey = await Crypto.digestStringAsync(
              Crypto.CryptoDigestAlgorithm.SHA256,
              current.event.id + ":" + attempt.guestId,
            );
            await savePreferences((p) => {
              const counted = recordExplicitConfirmation(p, confirmationKey);
              return completed
                ? recordCompletedQueue(counted, current.event.id)
                : counted;
            });
            if (completed) {
              Keyboard.dismiss();
              setReviewReady(current.event.id);
            }
          } catch {
            setPreferencesError(
              "Your invitation confirmation is saved, but app preferences could not be updated. Retry in Settings.",
            );
          }
        }
      }
      feedback();
      setNotice("Your confirmation was saved.");
    });
  };
  useEffect(() => {
    const shown = Keyboard.addListener("keyboardDidShow", () => {
      setKeyboardVisible(true);
      setReviewReady(null);
    });
    const hidden = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardVisible(false),
    );
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  useEffect(() => {
    if (error) AccessibilityInfo.announceForAccessibility(error);
  }, [error]);
  useEffect(() => {
    if (
      !reviewReady ||
      busy ||
      panel ||
      screen !== "send" ||
      onboardingVisible ||
      keyboardVisible ||
      error ||
      preferencesError ||
      reviewSuppressed
    )
      return;
    const stillCompleted = () => {
      const current = controller.state;
      return (
        current?.event.id === reviewReady &&
        !current.pendingHandoff &&
        current.guests.some((g) => g.selected) &&
        current.guests
          .filter((g) => g.selected)
          .every((g) => g.status === "confirmed")
      );
    };
    let cancelled = false;
    const timer = setTimeout(() => {
      const p = preferencesController.current;
      if (
        !p ||
        !isReviewEligible(p, now()) ||
        !stillCompleted() ||
        controller.state?.pendingHandoff ||
        NativeAppState.currentState !== "active"
      ) {
        setReviewReady(null);
        return;
      }
      void (async () => {
        try {
          await savePreferences((current) =>
            markReviewRequested(current, now()),
          );
          if (
            !cancelled &&
            stillCompleted() &&
            NativeAppState.currentState === "active" &&
            !controller.state?.pendingHandoff
          )
            await requestNativeReview();
        } catch {
          /* Optional review cannot disrupt the completed invitation. */
        } finally {
          if (!cancelled) setReviewReady(null);
        }
      })();
    }, 1500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    reviewReady,
    busy,
    panel,
    screen,
    onboardingVisible,
    keyboardVisible,
    error,
    preferencesError,
    reviewSuppressed,
    controller,
    preferencesController,
    savePreferences,
  ]);
  const notYet = () =>
    run(async () => {
      const attempt = data?.pendingHandoff;
      if (!attempt) return;
      await update((current) => cancelHandoff(current, attempt.id));
      setNotice("Not marked sent. Review this guest when ready.");
    });
  const skipPending = () =>
    run(async () => {
      const attempt = data?.pendingHandoff;
      if (!attempt) return;
      await update((current) =>
        skipGuest(cancelHandoff(current, attempt.id), attempt.guestId),
      );
      setNotice("Saved for later.");
    });
  const resetGuestDrafts = () => {
    setReviewReady(null);
    setPaste("");
    setPreview(null);
    setImportRows([]);
    setContactChoices([]);
    setName("");
    setPhone("");
    setEditing(null);
    setSearch("");
    setError("");
  };
  const closePanel = useCallback(() => {
    if (busy) return;
    const dirty =
      (panel === "paste" && !!paste.trim()) ||
      ((panel === "manual" || panel === "edit") &&
        (name !== (editing?.name ?? "") || phone !== (editing?.phone ?? ""))) ||
      (panel === "import" && !!preview?.rows.length);
    if (dirty)
      Alert.alert(
        "Discard unsaved changes?",
        "These guest edits are not saved. Your existing invitation and guests will stay unchanged.",
        [
          { text: "Keep editing", style: "cancel" },
          {
            text: "Discard draft",
            style: "destructive",
            onPress: () => {
              setPaste("");
              setName("");
              setPhone("");
              setEditing(null);
              setPreview(null);
              setImportRows([]);
              setContactChoices([]);
              setError("");
              setPanel(null);
            },
          },
        ],
      );
    else {
      setError("");
      setPanel(null);
    }
  }, [busy, panel, paste, name, phone, editing, preview]);
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      if (panel) {
        closePanel();
        return true;
      }
      if (screen !== "invitation") {
        setReviewReady(null);
        setScreen(data?.pendingHandoff ? "send" : "invitation");
        return !data?.pendingHandoff;
      }
      return false;
    });
    return () => sub.remove();
  }, [closePanel, panel, screen, data?.pendingHandoff]);
  const restore = () =>
    run(async () => {
      const file = await pickImportFile();
      if (!file) return;
      const incoming = parseBackup(file.text);
      Alert.alert(
        "Replace this event?",
        `Backup: ${incoming.event.title || "Untitled"}\n${incoming.guests.length} guests. Current local progress will be replaced. Nothing will be sent.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Replace",
            style: "destructive",
            onPress: () =>
              void run(async () => {
                await controller.update(() => incoming);
                resetGuestDrafts();
                setDraft(incoming.event);
                setPanel(null);
                setScreen(resumeScreen(incoming));
                setLoadError("");
                setNotice("Backup restored. Nothing was sent.");
              }),
          },
        ],
      );
    });
  const exportBackup = () =>
    Alert.alert(
      "Export guest details?",
      "This backup contains names, phone numbers and invitation text. Store it somewhere private. Exported copies are not removed when you clear Dearo.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Export",
          onPress: () =>
            void run(async () => {
              await shareBackup(serializeBackup(controller.state!));
              setNotice(
                "Sharing closed. Check your chosen destination for the backup.",
              );
            }),
        },
      ],
    );
  const resetPreferences = () =>
    Alert.alert(
      "Reset app preferences?",
      "This resets the introduction, haptics and local review counters. Your invitation, guests and backups are unchanged.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset preferences",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              await preferencesController.replace(
                createProductPreferences(now()),
              );
              setPreferencesError("");
              setReviewReady(null);
              setNotice("App preferences reset. Your event is unchanged.");
            }),
        },
      ],
    );
  const clear = () =>
    Alert.alert(
      "Clear this event?",
      "This removes the event and progress from Dearo. It does not delete WhatsApp messages, exported backups or operating-system backups.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear event",
          style: "destructive",
          onPress: () =>
            void run(async () => {
              const fresh = createInitialState(initialEvent());
              await controller.update(() => fresh);
              resetGuestDrafts();
              setDraft(fresh.event);
              setScreen("invitation");
              setPanel(null);
              setLoadError("");
              setNotice("Local event cleared.");
            }),
        },
      ],
    );
  const editGuest = (guest: Guest) => {
    if (data?.pendingHandoff)
      return setError("Resolve the current invitation before editing guests.");
    setEditing(guest);
    setName(guest.name);
    setPhone(guest.phone);
    showPanel("edit");
  };
  const revisit = (guest: Guest) => {
    if (data?.pendingHandoff)
      return setError("Resolve the current invitation first.");
    if (guest.status === "confirmed")
      Alert.alert(
        "Already marked sent",
        "Reopening may send a duplicate. Undo only changes Dearo’s tracking, not WhatsApp.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Undo confirmation",
            onPress: () =>
              void run(async () => {
                await update((c) => undoConfirmation(c, guest.id, now()));
                setNotice(
                  "Confirmation undone. No WhatsApp message was removed.",
                );
              }),
          },
        ],
      );
    else
      void run(async () => {
        await update((c) => revisitGuest(c, guest.id));
        setPanel(null);
        setScreen("send");
      });
  };
  if (loading)
    return (
      <SafeAreaView
        style={[s.safe, { alignItems: "center", justifyContent: "center" }]}
      >
        <ActivityIndicator color={colors.blue} />
        <Text style={s.muted}>Opening your invitation…</Text>
      </SafeAreaView>
    );
  if (loadError)
    return (
      <SafeAreaView
        style={[s.safe, { padding: 24, justifyContent: "center", gap: 18 }]}
      >
        <Text accessibilityRole="header" style={s.h1}>
          Your data needs attention.
        </Text>
        <Text style={s.body}>{loadError}</Text>
        <Button title="Restore a backup" onPress={restore} disabled={busy} />
        <Button
          title="Clear local event"
          onPress={clear}
          secondary
          disabled={busy}
        />
        {error ? (
          <Text accessibilityRole="alert" style={{ color: colors.red }}>
            {error}
          </Text>
        ) : null}
      </SafeAreaView>
    );
  if (!data) return null;
  if (onboardingVisible)
    return (
      <Onboarding
        busy={busy}
        error={error}
        onContinueWithoutSaving={() => {
          setOnboardingVisible(false);
          setReviewSuppressed(true);
          setPreferencesError(
            "Introduction preference was not saved. Retry preferences in Settings.",
          );
          setError("");
          setReviewReady(null);
        }}
        onSkip={() =>
          void run(async () => {
            await savePreferences((p) => skipOnboarding(p));
            setOnboardingVisible(false);
          })
        }
        onFinish={() =>
          void run(async () => {
            await savePreferences((p) => completeOnboarding(p));
            setOnboardingVisible(false);
          })
        }
      />
    );

  const selected = data.guests.filter((g) => g.selected),
    confirmed = selected.filter((g) => g.status === "confirmed").length,
    remaining = selected.filter((g) => g.status !== "confirmed");
  const pending = data.pendingHandoff,
    guest = pending
      ? data.guests.find((g) => g.id === pending.guestId)
      : nextGuest(data);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={s.page}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={s.header}>
          {screen === "invitation" ? (
            <Text style={s.brand}>dearo</Text>
          ) : (
            <Pressable
              disabled={busy || !!pending}
              accessibilityState={{ disabled: busy || !!pending }}
              onPress={() => {
                setReviewReady(null);
                setScreen(screen === "send" ? "guests" : "invitation");
              }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={{
                minHeight: 44,
                paddingVertical: 10,
                paddingRight: 16,
                opacity: pending ? 0.4 : 1,
              }}
            >
              <Text style={s.link}>‹ Back</Text>
            </Pressable>
          )}
          <Text style={s.eyebrow}>
            {screen === "invitation"
              ? "YOUR INVITATION"
              : screen === "guests"
                ? "YOUR PEOPLE"
                : "INVITING"}
          </Text>
          <Pressable
            onPress={() => showPanel("privacy")}
            accessibilityRole="button"
            accessibilityLabel="Privacy and backup"
            disabled={busy}
            accessibilityState={{ disabled: busy }}
            style={{
              minHeight: 44,
              minWidth: 44,
              paddingVertical: 10,
              paddingLeft: 16,
            }}
          >
            <Text style={s.link}>•••</Text>
          </Pressable>
        </View>
        {notice ? (
          <Text
            accessibilityLiveRegion="polite"
            style={[s.muted, { paddingBottom: 10 }]}
          >
            {notice}
          </Text>
        ) : null}
        <ErrorNotice error={error} />
        {preferencesError ? (
          <Text accessibilityRole="alert" style={s.muted}>
            App preferences need attention. Open Settings to retry. Your event
            is unchanged.
          </Text>
        ) : null}
        {screen === "invitation" ? (
          <>
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 20, paddingBottom: 32 }}
            >
              <View>
                <Text accessibilityRole="header" style={s.h1}>
                  Make it personal.
                </Text>
                <Text style={[s.muted, { marginTop: 8 }]}>
                  A thoughtful invitation. Every guest.
                </Text>
              </View>
              <View style={[s.card, { padding: 16, gap: 6, borderRadius: 16 }]}>
                <Text style={s.eyebrow}>LOCAL EVENT SUMMARY</Text>
                <Text style={[s.h2, { fontSize: 22, lineHeight: 28 }]}>
                  {draft.title || "Your celebration"}
                </Text>
              </View>
              <Field
                label="Event name"
                value={draft.title}
                onChangeText={(title) => setDraft({ ...draft, title })}
                placeholder="Aisha & Farhan"
                maxLength={200}
              />
              <Field
                label="Invitation link"
                value={draft.invitationUrl}
                onChangeText={(invitationUrl) =>
                  setDraft({ ...draft, invitationUrl })
                }
                placeholder="https://…"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                maxLength={4096}
              />
              <Button
                title={"Phone country · " + countryLabel(draft.countryCode)}
                secondary
                onPress={() => showPanel("country")}
                disabled={busy}
              />
              <Field
                label="Your message · use {guest}, {event}, {link}"
                value={draft.messageTemplate}
                onChangeText={(messageTemplate) =>
                  setDraft({ ...draft, messageTemplate })
                }
                multiline
                maxLength={10000}
              />
              <Text style={s.muted}>
                The invitation link is always included. Your edits save when you
                continue.
              </Text>
            </ScrollView>
            <View
              testID="invitation-actions"
              style={{ paddingTop: 14, paddingBottom: 4 }}
            >
              <Button
                title="Save & choose guests"
                onPress={saveInvitation}
                disabled={busy}
              />
            </View>
          </>
        ) : null}
        {screen === "guests" ? (
          <>
            <View style={{ gap: 12, paddingVertical: 12 }}>
              <Text accessibilityRole="header" style={s.h1}>
                Your people.
              </Text>
              <Text style={s.muted}>Choose who you want to invite.</Text>
              <Field
                label="Search guests"
                value={search}
                onChangeText={setSearch}
                placeholder="Name or number"
              />
              <Button
                title="Add guests"
                secondary
                onPress={() => showPanel("add")}
                disabled={busy || !!pending}
              />
            </View>
            <FlatList
              data={data.guests.filter((g) =>
                (g.name + " " + g.phone)
                  .toLowerCase()
                  .includes(search.toLowerCase()),
              )}
              keyExtractor={(g) => g.id}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <View style={[s.card, { marginTop: 20 }]}>
                  <Text style={s.h2}>
                    {data.guests.length
                      ? "No matching guests."
                      : "Start with your first guest."}
                  </Text>
                  <Text style={s.muted}>
                    {data.guests.length
                      ? "Try another name or number in search."
                      : "Choose a contact or enter a name and number."}
                  </Text>
                </View>
              }
              renderItem={({ item: g }) => (
                <View style={s.row}>
                  <Pressable
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      gap: 12,
                      alignItems: "center",
                    }}
                    onPress={() => editGuest(g)}
                    accessibilityRole="button"
                    accessibilityLabel={`Edit ${g.name}, ${g.phone}`}
                  >
                    <View style={s.avatar}>
                      <Text style={s.avatarText}>
                        {g.name.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.body, { fontWeight: "600" }]}>
                        {g.name}
                      </Text>
                      <Text style={s.muted}>{g.phone}</Text>
                      <Text style={s.muted}>{stateLabel[g.status]}</Text>
                    </View>
                  </Pressable>
                  <Pressable
                    disabled={busy || !!pending}
                    accessibilityRole="checkbox"
                    accessibilityLabel={`Select ${g.name}, ${g.phone}`}
                    accessibilityState={{
                      checked: g.selected,
                      disabled: busy || !!pending,
                    }}
                    onPress={() =>
                      void run(async () => {
                        await update((c) => ({
                          ...c,
                          guests: c.guests.map((x) =>
                            x.id === g.id ? { ...x, selected: !x.selected } : x,
                          ),
                        }));
                        feedback();
                      })
                    }
                    style={{ padding: 12 }}
                  >
                    <View style={[s.check, g.selected && s.checked]}>
                      <Text style={{ color: "white" }}>
                        {g.selected ? "✓" : ""}
                      </Text>
                    </View>
                  </Pressable>
                </View>
              )}
            />
            <View style={s.footer}>
              <Text style={s.muted}>{selected.length} guests selected</Text>
              <Button
                title={pending ? "Return to current guest" : "Start inviting"}
                disabled={busy || !selected.length}
                onPress={begin}
              />
            </View>
          </>
        ) : null}
        {screen === "send" ? (
          <>
            <ScrollView
              contentContainerStyle={{
                gap: 20,
                paddingTop: 8,
                paddingBottom: 24,
              }}
            >
              <Text style={s.muted}>
                {confirmed} of {selected.length} marked sent
              </Text>
              <View style={s.progress}>
                <View
                  style={{
                    height: 4,
                    backgroundColor: colors.blue,
                    width: `${selected.length ? (confirmed / selected.length) * 100 : 0}%`,
                  }}
                />
              </View>
              {guest ? (
                <>
                  <Text accessibilityRole="header" style={s.h1}>
                    {guest.name}
                  </Text>
                  {pending ? (
                    <Text style={s.body}>Did you send it?</Text>
                  ) : null}
                  <Text style={s.muted}>
                    {pending?.recipient || guest.phone}
                  </Text>
                  <View style={s.card}>
                    <Text style={s.eyebrow}>MESSAGE</Text>
                    <Text selectable style={s.body}>
                      {pending?.preparedMessage ||
                        safeMessage(data.event, guest.name) ||
                        "Finish your invitation before opening WhatsApp."}
                    </Text>
                  </View>
                  <Text style={s.muted}>
                    {pending
                      ? "Only you can confirm sending. Opening WhatsApp does not prove delivery."
                      : "You will review this message and tap Send inside WhatsApp."}
                  </Text>
                  {pending ? (
                    <View style={{ gap: 12 }}>
                      <Button
                        secondary
                        title="Open same message again"
                        onPress={() =>
                          void run(() => controller.retry(pending.id))
                        }
                        disabled={busy}
                      />
                      <View
                        style={{
                          flexDirection: "row",
                          flexWrap: "wrap",
                          gap: 12,
                        }}
                      >
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Copy message"
                          disabled={busy}
                          accessibilityState={{ disabled: busy }}
                          onPress={() =>
                            void run(() => copy(pending.preparedMessage))
                          }
                          style={({ pressed }) => ({
                            minHeight: 44,
                            justifyContent: "center",
                            paddingHorizontal: 10,
                            opacity: busy ? 0.45 : pressed ? 0.6 : 1,
                          })}
                        >
                          <Text style={s.link}>Copy message</Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel="Copy number"
                          disabled={busy}
                          accessibilityState={{ disabled: busy }}
                          onPress={() =>
                            void run(() => copy(pending.recipient))
                          }
                          style={({ pressed }) => ({
                            minHeight: 44,
                            justifyContent: "center",
                            paddingHorizontal: 10,
                            opacity: busy ? 0.45 : pressed ? 0.6 : 1,
                          })}
                        >
                          <Text style={s.link}>Copy number</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : null}
                </>
              ) : (
                <>
                  <Text accessibilityRole="header" style={s.h1}>
                    {remaining.length
                      ? "A few to revisit."
                      : "All guests reviewed."}
                  </Text>
                  <Text style={s.body}>
                    {confirmed} marked sent · {remaining.length} remaining
                  </Text>
                  <Text style={s.muted}>
                    These are your confirmations, not delivery receipts.
                  </Text>
                  <Button
                    title={
                      remaining.length ? "Review remaining" : "Review guests"
                    }
                    onPress={() => showPanel("review")}
                  />
                  <Button
                    title="Edit invitation"
                    secondary
                    onPress={() => {
                      setDraft(data.event);
                      setScreen("invitation");
                    }}
                    disabled={busy}
                  />
                </>
              )}
            </ScrollView>
            {guest ? (
              <View style={s.footer}>
                {pending ? (
                  <>
                    <Button
                      title={
                        selected.filter((g) => g.status === "pending").length
                          ? "Sent, next guest"
                          : "Sent, finish"
                      }
                      onPress={confirmNext}
                      disabled={busy}
                    />
                    <View style={{ flexDirection: "row", gap: 10 }}>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Not yet"
                          secondary
                          onPress={notYet}
                          disabled={busy}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Button
                          title="Skip"
                          secondary
                          onPress={skipPending}
                          disabled={busy}
                        />
                      </View>
                    </View>
                  </>
                ) : (
                  <>
                    <Button
                      title="Open WhatsApp"
                      onPress={() => openGuest(guest)}
                      disabled={busy || !safeMessage(data.event, guest.name)}
                    />
                    <Button
                      title="Skip for now"
                      secondary
                      onPress={() =>
                        void run(async () => {
                          await update((c) => skipGuest(c, guest.id));
                          setNotice("Saved for later.");
                        })
                      }
                      disabled={busy}
                    />
                  </>
                )}
              </View>
            ) : null}
          </>
        ) : null}
      </KeyboardAvoidingView>
      <Sheet
        title={
          panel === "privacy"
            ? "Settings"
            : panel === "country"
              ? "Choose phone country"
              : panel === "add"
                ? "Add guests"
                : panel === "paste"
                  ? "Paste guest list"
                  : panel === "import"
                    ? "Review import"
                    : panel === "review"
                      ? "Your guests"
                      : panel === "edit"
                        ? "Edit guest"
                        : panel === "contact"
                          ? "Choose a number"
                          : "Add a guest"
        }
        visible={!!panel}
        scroll={panel !== "import" && panel !== "review"}
        onClose={closePanel}
      >
        <ErrorNotice error={error} />
        {panel === "country" ? (
          <CountryPicker
            selected={draft.countryCode}
            busy={busy}
            onSelect={(countryCode) => {
              setDraft({ ...draft, countryCode });
              setPanel(null);
            }}
          />
        ) : null}
        {panel === "add" ? (
          <>
            <Button
              title="Choose from contacts"
              onPress={chooseContact}
              disabled={busy}
            />
            <Button
              title="Paste a list"
              secondary
              onPress={() => showPanel("paste")}
            />
            <Button
              title="Import CSV or contact file"
              secondary
              onPress={importFile}
              disabled={busy}
            />
            <Button
              title="Add one guest"
              secondary
              onPress={() => {
                setName("");
                setPhone("");
                setEditing(null);
                showPanel("manual");
              }}
            />
            <Text style={s.muted}>
              Only contacts you choose are added. No address book is uploaded.
            </Text>
          </>
        ) : null}
        {panel === "contact" ? (
          <>
            <Text style={s.muted}>
              Only the number you choose will be added.
            </Text>
            {contactChoices.map((c, i) => (
              <Button
                key={i}
                title={`${c.label || "Phone"} · ${c.phone}`}
                secondary
                onPress={() => {
                  setName(c.name);
                  setPhone(c.phone);
                  setEditing(null);
                  showPanel("manual");
                }}
              />
            ))}
          </>
        ) : null}
        {panel === "manual" || panel === "edit" ? (
          <>
            <Field
              label="Guest name"
              value={name}
              onChangeText={setName}
              maxLength={200}
            />
            <Field
              label={`Phone number · default ${data.event.countryCode}`}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={100}
              editable={
                !editing || !data.attempts.some((a) => a.guestId === editing.id)
              }
            />
            {editing && data.attempts.some((a) => a.guestId === editing.id) ? (
              <Text style={s.muted}>
                A number with invitation history cannot be edited. This protects
                previous confirmations.
              </Text>
            ) : null}
            <Button title="Save guest" onPress={addManual} disabled={busy} />
            {editing && !data.attempts.some((a) => a.guestId === editing.id) ? (
              <Button
                title="Remove guest"
                secondary
                onPress={() =>
                  Alert.alert("Remove guest?", editing.name, [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Remove",
                      style: "destructive",
                      onPress: () =>
                        void run(async () => {
                          await update((c) => ({
                            ...c,
                            guests: c.guests.filter((g) => g.id !== editing.id),
                          }));
                          setPanel(null);
                        }),
                    },
                  ])
                }
              />
            ) : null}
          </>
        ) : null}
        {panel === "paste" ? (
          <>
            <Text style={s.muted}>
              One guest per line: Name, +country code and number. A CSV header
              is optional.
            </Text>
            <Field
              label="Guest list"
              value={paste}
              onChangeText={setPaste}
              multiline
              maxLength={1000000}
              placeholder={"Anjali, +919876543210"}
            />
            <Button
              title="Preview guests"
              onPress={() =>
                void run(async () => acceptPreview(paste, "paste"))
              }
              disabled={busy}
            />
          </>
        ) : null}
        {panel === "import" && preview ? (
          <ImportReview
            preview={preview}
            existingGuests={data.guests}
            selectedRows={importRows}
            onSelectedRows={setImportRows}
            busy={busy}
            onApply={() =>
              void run(async () => {
                await update((c) =>
                  applyImportDecisions(
                    c,
                    preview,
                    preview.rows.map((row) => ({
                      row: row.row,
                      action: importRows.includes(row.row) ? "add" : "skip",
                      id: id(),
                    })),
                  ),
                );
                setPanel(null);
                setPaste("");
                setNotice("Selected guests added.");
              })
            }
          />
        ) : null}
        {panel === "privacy" ? (
          <SettingsPanel
            busy={busy}
            haptics={haptics}
            reducedMotion={reducedMotion}
            preferencesError={preferencesError}
            onResetPreferences={resetPreferences}
            onRetryPreferences={() =>
              void run(async () => {
                await loadPreferences();
              })
            }
            onHaptics={() =>
              void run(async () => {
                await savePreferences((p) =>
                  setHapticsEnabled(p, !p.hapticsEnabled),
                );
              })
            }
            onExport={exportBackup}
            onRestore={restore}
            onClear={clear}
            onOnboarding={() => {
              setPanel(null);
              setOnboardingVisible(true);
            }}
            onOpen={(url) =>
              void run(async () => {
                await Linking.openURL(url);
              })
            }
            onCopyDiagnostics={() =>
              void run(() =>
                copy(
                  "Dearo 0.1.0 | " +
                    Platform.OS +
                    " " +
                    String(Platform.Version) +
                    " | local-only invitation companion",
                ),
              )
            }
          />
        ) : null}
        {panel === "review" ? (
          <GuestReview
            guests={data.guests}
            pending={!!pending}
            busy={busy}
            onRevisit={revisit}
            onManage={() => {
              setPanel(null);
              setScreen("guests");
            }}
          />
        ) : null}
      </Sheet>
    </SafeAreaView>
  );
}
