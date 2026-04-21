import { useCallback } from "react";
import type { Dispatch, SetStateAction, KeyboardEvent } from "react";
import { SCALE_MIN, SCALE_MAX } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

const ARROW_STEP_DEG = 5;
const ZOOM_STEP_FACTOR = 1.2;

const clampLat = (lat: number) => Math.max(-90, Math.min(90, lat));
const clampScale = (s: number) => Math.max(SCALE_MIN, Math.min(SCALE_MAX, s));

/**
 * Returns a keyboard handler for the globe container. Arrow keys pan by
 * `ARROW_STEP_DEG` per press; `+`/`=` and `-` zoom by `ZOOM_STEP_FACTOR`.
 * Meta/ctrl combos are passed through so browser shortcuts still work.
 */
export function useGlobeKeyboard(opts: {
  cancelFly: () => void;
  cancelDrift: () => void;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  setRotation: Dispatch<SetStateAction<[number, number]>>;
  setScale: Dispatch<SetStateAction<number>>;
}): (e: KeyboardEvent<HTMLDivElement>) => void {
  const { cancelFly, cancelDrift, setMode, setRotation, setScale } = opts;

  return useCallback(
    (e: KeyboardEvent<HTMLDivElement>) => {
      if (e.metaKey || e.ctrlKey) return;

      const actions: Record<string, () => void> = {
        ArrowLeft: () =>
          setRotation(([lon, lat]) => [lon - ARROW_STEP_DEG, lat]),
        ArrowRight: () =>
          setRotation(([lon, lat]) => [lon + ARROW_STEP_DEG, lat]),
        ArrowUp: () =>
          setRotation(([lon, lat]) => [lon, clampLat(lat + ARROW_STEP_DEG)]),
        ArrowDown: () =>
          setRotation(([lon, lat]) => [lon, clampLat(lat - ARROW_STEP_DEG)]),
        "+": () => setScale((s) => clampScale(s * ZOOM_STEP_FACTOR)),
        "=": () => setScale((s) => clampScale(s * ZOOM_STEP_FACTOR)),
        "-": () => setScale((s) => clampScale(s / ZOOM_STEP_FACTOR)),
      };

      const action = actions[e.key];
      if (!action) return;

      e.preventDefault();
      cancelFly();
      cancelDrift();
      setMode("user");
      action();
    },
    [cancelFly, cancelDrift, setMode, setRotation, setScale],
  );
}
