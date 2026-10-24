import React from "react";
import { createRoot } from "react-dom/client";
import DearoApp from "../src/ui/DearoApp";
import { AppErrorBoundary } from "../src/ui/AppErrorBoundary";
import { SafeAreaProvider } from "./adapters";
import { NativeAlertPreview } from "./native";
createRoot(document.getElementById("root")!).render(
  <SafeAreaProvider>
    <AppErrorBoundary>
      <DearoApp />
    </AppErrorBoundary>
    <NativeAlertPreview />
  </SafeAreaProvider>,
);
