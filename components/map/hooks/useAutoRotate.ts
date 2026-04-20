import { useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";

export type GlobeMode = "auto" | "user" | "flying";

/**
 * Spins the globe slowly on the longitude axis while `mode === "auto"`.
 * Cancels the rAF loop when mode changes or the component unmounts.
 */
export function useAutoRotate(
  mode: GlobeMode,
  setRotation: Dispatch<SetStateAction<[number, number]>>,
): void {
  useEffect(() => {
    if (mode !== "auto") return;
    let rafId = 0;
    const tick = () => {
      setRotation(([lon, lat]) => [(lon + 0.05) % 360, lat]);
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [mode, setRotation]);
}
