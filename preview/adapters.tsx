import React, { createContext, useContext } from "react";
import { View, type ViewProps } from "react-native";
import { parseBackup, serializeBackup, type AppState } from "../src/domain";
import {
  parseProductPreferences,
  serializeProductPreferences,
  type ProductPreferences,
} from "../src/product/preferences";
import { assertWhatsAppUrl, type PhoneCandidate } from "../src/services/guards";
import {
  createPreviewFixture,
  resolvePreviewScenario,
  type PreviewScenario,
} from "./fixtures";

/** Browser-only synthetic visual harness. No production native service is invoked here. */
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const currentScenario =
  typeof window === "undefined"
    ? "onboarding"
    : resolvePreviewScenario(window.location.search);
let fixture = createPreviewFixture(currentScenario);
let eventState: AppState | null = fixture.state;
let productState: ProductPreferences | null = fixture.preferences;
export const previewDiagnostics: {
  mode: "synthetic-browser-visual-qa";
  scenario: PreviewScenario;
  handoffs: string[];
  copiedText: string | null;
  backupShareRequests: number;
  contactPickerRequests: number;
  filePickerRequests: number;
  reviewRequests: number;
  hapticRequests: number;
} = {
  mode: "synthetic-browser-visual-qa",
  scenario: currentScenario,
  handoffs: [],
  copiedText: null,
  backupShareRequests: 0,
  contactPickerRequests: 0,
  filePickerRequests: 0,
  reviewRequests: 0,
  hapticRequests: 0,
};

export const repository = {
  async load(): Promise<AppState | null> {
    return clone(eventState);
  },
  async save(state: AppState): Promise<void> {
    eventState = parseBackup(serializeBackup(state));
  },
  async clear(): Promise<void> {
    eventState = null;
  },
};
export const preferencesRepository = {
  async load(): Promise<ProductPreferences> {
    if (!productState)
      productState = parseProductPreferences(null, new Date().toISOString());
    return clone(productState);
  },
  async save(preferences: ProductPreferences): Promise<void> {
    productState = parseProductPreferences(
      serializeProductPreferences(preferences),
      new Date().toISOString(),
    );
  },
  async clear(): Promise<void> {
    productState = null;
  },
};
export function getPreviewSnapshot() {
  return clone({
    event: eventState,
    preferences: productState,
    diagnostics: previewDiagnostics,
  });
}
/** Reset between explicit QA scenarios. Reload/remount the app afterwards. */
export function resetPreviewState(scenario: PreviewScenario): void {
  fixture = createPreviewFixture(scenario);
  eventState = fixture.state;
  productState = fixture.preferences;
  Object.assign(previewDiagnostics, {
    scenario,
    handoffs: [],
    copiedText: null,
    backupShareRequests: 0,
    contactPickerRequests: 0,
    filePickerRequests: 0,
    reviewRequests: 0,
    hapticRequests: 0,
  });
}
export async function openWhatsApp(url: string): Promise<void> {
  assertWhatsAppUrl(url);
  // Record the prepared link in memory; deliberately never call window.open/Linking/fetch.
  previewDiagnostics.handoffs.push(url);
}
export async function copyText(text: string): Promise<void> {
  previewDiagnostics.copiedText = text;
}
export type { PhoneCandidate } from "../src/services/guards";
export async function pickContactPhones(): Promise<PhoneCandidate[] | null> {
  previewDiagnostics.contactPickerRequests++;
  return [
    { name: "Casey Example", phone: "+12025550109", label: "Synthetic mobile" },
  ];
}
export interface PickedImportFile {
  name: string;
  text: string;
  extension: "csv" | "vcf" | "json";
}
export async function pickImportFile(): Promise<PickedImportFile | null> {
  previewDiagnostics.filePickerRequests++;
  return null;
}
export async function shareBackup(
  json: string,
): Promise<{ status: "share-sheet-closed" }> {
  parseBackup(json);
  previewDiagnostics.backupShareRequests++;
  // No file, download, share sheet, clipboard or third-party transmission occurs.
  return { status: "share-sheet-closed" };
}
export async function optionalHaptic(
  enabled: boolean,
  _kind: "selection" | "success" = "selection",
): Promise<void> {
  if (enabled) previewDiagnostics.hapticRequests++;
}
export async function requestNativeReview(): Promise<"unavailable"> {
  previewDiagnostics.reviewRequests++;
  return "unavailable";
}
export const CryptoDigestAlgorithm = { SHA256: "SHA-256" } as const;
export function randomUUID(): string {
  if (!globalThis.crypto)
    throw new Error("Browser crypto unavailable in visual QA harness");
  if (typeof globalThis.crypto.randomUUID === "function")
    return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export async function digestStringAsync(
  algorithm: string,
  value: string,
): Promise<string> {
  if (algorithm !== CryptoDigestAlgorithm.SHA256)
    throw new Error("Only SHA-256 is used by this QA harness");
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}
export function StatusBar(_props: { style?: string; [key: string]: unknown }) {
  return null;
}
const insets = { top: 0, right: 0, bottom: 0, left: 0 };
const frame = { x: 0, y: 0, width: 390, height: 844 };
export const initialWindowMetrics = { insets, frame };
export const SafeAreaInsetsContext = createContext(insets);
export const SafeAreaFrameContext = createContext(frame);
export function SafeAreaProvider({ children, ...props }: ViewProps) {
  return (
    <SafeAreaInsetsContext.Provider value={insets}>
      <SafeAreaFrameContext.Provider value={frame}>
        <View {...props} style={[{ flex: 1 }, props.style]}>
          {children}
        </View>
      </SafeAreaFrameContext.Provider>
    </SafeAreaInsetsContext.Provider>
  );
}
export function SafeAreaView({
  children,
  ...props
}: ViewProps & { edges?: unknown; mode?: unknown }) {
  const { edges: _edges, mode: _mode, ...viewProps } = props;
  return <View {...viewProps}>{children}</View>;
}
export function useSafeAreaInsets() {
  return useContext(SafeAreaInsetsContext);
}
export function useSafeAreaFrame() {
  return useContext(SafeAreaFrameContext);
}
