"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui";
import { FitFrame } from "./frames";

export interface LightboxItem {
  key: string;
  caption: string;
  width: number;
  height: number;
  render: () => React.ReactNode;
}

/** Full-screen review of one artwork at a time. Arrow keys move, Escape closes. */
export function Lightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: LightboxItem[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const item = items[index];
  const count = items.length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight" && count > 1) onIndexChange((index + 1) % count);
      if (e.key === "ArrowLeft" && count > 1) onIndexChange((index - 1 + count) % count);
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [index, count, onClose, onIndexChange]);

  if (!item) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={item.caption}
      className="fixed inset-0 z-50 flex flex-col bg-ink/90 text-paper"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-6" onClick={(e) => e.stopPropagation()}>
        <p className="min-w-0 truncate text-sm">
          {item.caption}
          {count > 1 && (
            <span className="ml-2 font-mono text-xs text-paper/60">
              {index + 1} of {count}
            </span>
          )}
        </p>
        <Button size="sm" variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
      <div className="min-h-0 flex-1 px-4 pb-4 sm:px-10" onClick={(e) => e.stopPropagation()}>
        <FitFrame key={item.key} width={item.width} height={item.height} fitHeight className="drop-shadow-2xl">
          {item.render()}
        </FitFrame>
      </div>
      {count > 1 && (
        <div className="flex justify-center gap-3 pb-5" onClick={(e) => e.stopPropagation()}>
          <Button size="sm" variant="secondary" onClick={() => onIndexChange((index - 1 + count) % count)}>
            Previous
          </Button>
          <Button size="sm" variant="secondary" onClick={() => onIndexChange((index + 1) % count)}>
            Next
          </Button>
        </div>
      )}
    </div>,
    document.body,
  );
}
