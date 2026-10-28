import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Monogram: the first letter of the product name in the display face on an ink tile,
 * with the brand dot at the top right of the letter. Matches src/app/icon.svg.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  const dot = Math.max(4, Math.round(size * 0.13));
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0 items-center justify-center bg-ink font-display text-paper", className)}
      style={{ width: size, height: size, borderRadius: size * 0.25, fontSize: size * 0.58, lineHeight: 1 }}
    >
      {BRAND.name.charAt(0)}
      <span
        className="absolute rounded-full"
        style={{ width: dot, height: dot, background: BRAND.markDot, top: size * 0.2, left: size * 0.68 }}
      />
    </span>
  );
}

/** Name plus the parent-brand endorsement, for the app shell and documents. */
export function BrandLockup({ size = 34 }: { size?: number }) {
  return (
    <span className="flex items-center gap-3">
      <BrandMark size={size} />
      <span>
        <span className="block font-display text-[22px] leading-none text-ink">{BRAND.name}</span>
        <span className="mt-1 block text-xs text-muted">
          by <span className="font-medium text-ink">{BRAND.endorsedBy}</span>
        </span>
      </span>
    </span>
  );
}
