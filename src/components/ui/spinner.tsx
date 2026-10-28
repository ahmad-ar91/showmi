import { cn } from "@/lib/utils";

const SIZES = { sm: "h-3.5 w-3.5", md: "h-4 w-4", lg: "h-6 w-6" } as const;

/** Loading ring. Takes the current text colour, so it matches whatever it sits in. */
export function Spinner({ size = "md", className }: { size?: keyof typeof SIZES; className?: string }) {
  return <span role="status" aria-label="Loading" className={cn("spinner shrink-0", SIZES[size], className)} />;
}
