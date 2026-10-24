import React, { useState, useEffect } from "react";
export * from "react-native-web";
type Choice = { text?: string; onPress?: () => void; style?: string };
let show:
  | ((v: { title: string; message?: string; buttons: Choice[] }) => void)
  | undefined;
export const Alert = {
  alert(title: string, message?: string, buttons: Choice[] = [{ text: "OK" }]) {
    show?.({ title, message, buttons });
  },
};
export const Linking = {
  openURL: async () => {
    throw new Error("External links are blocked in visual QA.");
  },
  canOpenURL: async () => false,
};
export function NativeAlertPreview() {
  const [dialog, setDialog] = useState<{
    title: string;
    message?: string;
    buttons: Choice[];
  } | null>(null);
  useEffect(() => {
    show = setDialog;
    return () => {
      show = undefined;
    };
  }, []);
  return dialog ? (
    <div
      role="dialog"
      aria-label={dialog.title}
      style={{
        position: "fixed",
        inset: 0,
        background: "#0006",
        display: "grid",
        placeItems: "center",
        zIndex: 99999,
        padding: 20,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 18,
          padding: 24,
          maxWidth: 310,
          fontFamily: "system-ui",
        }}
      >
        <small>Native alert · browser mock</small>
        <h2>{dialog.title}</h2>
        <p style={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {dialog.message}
        </p>
        {dialog.buttons.map((button, i) => (
          <button
            key={i}
            style={{
              display: "block",
              width: "100%",
              padding: 14,
              marginTop: 8,
              border: "1px solid #ddd",
              background: "white",
              borderRadius: 10,
              color: button.style === "destructive" ? "#b32030" : "#2458EE",
            }}
            onClick={() => {
              setDialog(null);
              button.onPress?.();
            }}
          >
            {button.text}
          </button>
        ))}
      </div>
    </div>
  ) : null;
}

// Hardware back is a native boundary, not a browser capability.
export const BackHandler = {
  addEventListener: () => ({ remove() {} }),
  exitApp() {},
};
