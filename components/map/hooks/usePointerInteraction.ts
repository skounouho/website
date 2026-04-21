import { useRef } from "react";
import type {
  Dispatch,
  MouseEventHandler,
  PointerEventHandler,
  SetStateAction,
} from "react";
import { GLOBE_BASE_RADIUS } from "@/lib/projection";
import type { GlobeMode } from "./useAutoRotate";

const DRIFT_SAMPLE_WINDOW_MS = 80;
const DRIFT_MIN_RELEASE_SPEED = 0.15;
const DRIFT_MAX_RELEASE_AGE_MS = 150;

interface DragState {
  pointerId: number;
  startX: number;
  startY: number;
  startRotation: [number, number];
  samples: Array<{ x: number; y: number; t: number }>;
}

interface PinchState {
  pointers: Map<number, { x: number; y: number }>;
  startDistance: number | null;
  startScale: number;
}

/**
 * Pure helper: compute release velocity from a rolling pointer-sample window.
 * Returns null when the release is too slow to warrant drift or the window
 * is too old to be trustworthy.
 */
function computeReleaseVelocity(
  drag: DragState,
  scale: number,
): { vLon: number; vLat: number } | null {
  if (drag.samples.length < 2) return null;
  const first = drag.samples[0];
  const last = drag.samples[drag.samples.length - 1];
  const dt = last.t - first.t;
  if (dt <= 0 || dt >= DRIFT_MAX_RELEASE_AGE_MS) return null;

  const pxPerMsToDegPerFrame = 16.67 * (180 / (scale * GLOBE_BASE_RADIUS));
  const vLon = ((last.x - first.x) / dt) * pxPerMsToDegPerFrame;
  const vLat = (-(last.y - first.y) / dt) * pxPerMsToDegPerFrame;
  if (Math.hypot(vLon, vLat) <= DRIFT_MIN_RELEASE_SPEED) return null;
  return { vLon, vLat };
}

export interface PointerHandlers {
  onPointerDown: PointerEventHandler<HTMLDivElement>;
  onPointerMove: PointerEventHandler<HTMLDivElement>;
  onPointerUp: PointerEventHandler<HTMLDivElement>;
  onPointerCancel: PointerEventHandler<HTMLDivElement>;
  onClick: MouseEventHandler<HTMLDivElement>;
}

export function usePointerInteraction(opts: {
  scale: number;
  rotation: [number, number];
  prefersReducedMotion: boolean;
  isPointerOnGlobe: (clientX: number, clientY: number) => boolean;
  setMode: Dispatch<SetStateAction<GlobeMode>>;
  setOpenClusterId: Dispatch<SetStateAction<string | null>>;
  cancelFly: () => void;
  cancelDrift: () => void;
  startDrift: (vLon: number, vLat: number) => void;
  scheduleRotation: (next: [number, number]) => void;
  scheduleScale: (next: number) => void;
}): PointerHandlers {
  const {
    scale,
    rotation,
    prefersReducedMotion,
    isPointerOnGlobe,
    setMode,
    setOpenClusterId,
    cancelFly,
    cancelDrift,
    startDrift,
    scheduleRotation,
    scheduleScale,
  } = opts;

  const dragRef = useRef<DragState | null>(null);
  const pinchRef = useRef<PinchState>({
    pointers: new Map(),
    startDistance: null,
    startScale: 1,
  });
  const pointerDownOnGlobeRef = useRef<boolean>(false);

  const clearPinchIfSinglePointer = () => {
    if (pinchRef.current.pointers.size < 2) {
      pinchRef.current.startDistance = null;
    }
  };

  const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    const onGlobe = isPointerOnGlobe(e.clientX, e.clientY);
    pointerDownOnGlobeRef.current = onGlobe;
    if (!onGlobe) return;

    cancelFly();
    cancelDrift();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startRotation: rotation,
      samples: [{ x: e.clientX, y: e.clientY, t: e.timeStamp }],
    };
    setMode("user");
    pinchRef.current.pointers.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
    });
    if (pinchRef.current.pointers.size === 2) {
      const [a, b] = Array.from(pinchRef.current.pointers.values());
      pinchRef.current.startDistance = Math.hypot(a.x - b.x, a.y - b.y);
      pinchRef.current.startScale = scale;
      dragRef.current = null; // pinch takes over
    }
  };

  const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
    const drag = dragRef.current;
    if (drag && drag.pointerId === e.pointerId) {
      const dx = e.clientX - drag.startX;
      const dy = e.clientY - drag.startY;
      const degPerPx = 180 / (scale * GLOBE_BASE_RADIUS);
      const nextLon = drag.startRotation[0] + dx * degPerPx;
      const nextLat = Math.max(
        -90,
        Math.min(90, drag.startRotation[1] - dy * degPerPx),
      );
      scheduleRotation([nextLon, nextLat]);
      drag.samples.push({ x: e.clientX, y: e.clientY, t: e.timeStamp });
      while (
        drag.samples.length > 2 &&
        e.timeStamp - drag.samples[0].t > DRIFT_SAMPLE_WINDOW_MS
      ) {
        drag.samples.shift();
      }
    }
    if (pinchRef.current.pointers.has(e.pointerId)) {
      pinchRef.current.pointers.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
      });
    }
    if (
      pinchRef.current.pointers.size === 2 &&
      pinchRef.current.startDistance !== null
    ) {
      const [a, b] = Array.from(pinchRef.current.pointers.values());
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) /
        pinchRef.current.startDistance;
      scheduleScale(pinchRef.current.startScale * ratio);
    }
  };

  const onPointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
    const drag = dragRef.current;
    const shouldCheckDrift =
      drag !== null &&
      drag.pointerId === e.pointerId &&
      pinchRef.current.pointers.size < 2 &&
      !prefersReducedMotion;

    if (shouldCheckDrift) {
      const v = computeReleaseVelocity(drag, scale);
      if (v) startDrift(v.vLon, v.vLat);
    }
    if (drag && drag.pointerId === e.pointerId) {
      dragRef.current = null;
    }

    pinchRef.current.pointers.delete(e.pointerId);
    clearPinchIfSinglePointer();
  };

  const onPointerCancel: PointerEventHandler<HTMLDivElement> = (e) => {
    dragRef.current = null;
    cancelDrift();
    pinchRef.current.pointers.delete(e.pointerId);
    clearPinchIfSinglePointer();
  };

  const onClick: MouseEventHandler<HTMLDivElement> = (e) => {
    if ((e.target as HTMLElement).closest("[data-pin]")) return;
    setOpenClusterId(null);
    // If pointerdown started on the globe, this click terminates a drag
    // (possibly released off-sphere); don't treat it as "click outside".
    const startedOnGlobe = pointerDownOnGlobeRef.current;
    pointerDownOnGlobeRef.current = false;
    if (startedOnGlobe) return;
    if (isPointerOnGlobe(e.clientX, e.clientY)) return;
    cancelFly();
    cancelDrift();
    setMode("auto");
  };

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    onClick,
  };
}
