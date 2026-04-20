import { useState } from "react";

/**
 * Reads `prefers-reduced-motion` once on mount. Not reactive to changes —
 * matches the site's other motion-gated features.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  return reduced;
}
