"use client";

import { Toaster } from "react-hot-toast";

export function AppToaster() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        style: {
          background: "#18181b",
          color: "#f4f4f5",
          border: "1px solid #3f3f46",
          fontSize: "13px",
        },
        success: { iconTheme: { primary: "#34d399", secondary: "#18181b" } },
        error: { iconTheme: { primary: "#f87171", secondary: "#18181b" } },
      }}
    />
  );
}
