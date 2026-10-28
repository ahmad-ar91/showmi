import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

/**
 * Temporary typographic mark: the first letter of the product name set in the display face.
 * Replace with the real logo once the name is final.
 */
export function BrandMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-lg bg-ink font-display text-paper", className)}
      style={{ width: size, height: size, fontSize: size * 0.56, lineHeight: 1 }}
    >
      {BRAND.name.charAt(0)}
    </span>
  );
}
