"use client";

import { useState } from "react";
import { Button, type ButtonSize } from "./button";

/** Copies text to the clipboard and confirms in words for 1.5 seconds. */
export function CopyButton({ text, size = "sm", label = "Copy" }: { text: string; size?: ButtonSize; label?: string }) {
  const [state, setState] = useState<"idle" | "done" | "failed">("idle");
  return (
    <Button
      size={size}
      variant="quiet"
      className="h-7 px-2"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setState("done");
        } catch {
          setState("failed");
        }
        setTimeout(() => setState("idle"), 1500);
      }}
    >
      <span className={state === "done" ? "text-ok" : state === "failed" ? "text-bad" : undefined}>
        {state === "done" ? "Copied" : state === "failed" ? "Copy blocked" : label}
      </span>
    </Button>
  );
}
