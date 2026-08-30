"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "var(--toast-bg)",
          color: "var(--toast-fg)",
          border: "1px solid var(--toast-border)",
          fontSize: "13px",
        },
        success: { iconTheme: { primary: "#34d399", secondary: "var(--toast-bg)" } },
        error: { iconTheme: { primary: "#f87171", secondary: "var(--toast-bg)" } },
      }}
    />
  );
}
