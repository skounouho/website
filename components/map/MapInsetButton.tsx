"use client";

import { forwardRef } from "react";

interface Props {
  viewBox: string;
  regionPaths: string[];
  ariaLabel: string;
  onClick: () => void;
}

export const MapInsetButton = forwardRef<HTMLButtonElement, Props>(function MapInsetButton(
  { viewBox, regionPaths, ariaLabel, onClick },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="fixed bottom-8 right-8 z-20 h-[84px] w-36 overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--bg)] shadow-sm transition-colors motion-safe:duration-[var(--duration-fast)] hover:border-[var(--accent)] focus-visible:border-[var(--accent)] focus-visible:outline-none"
    >
      <svg
        viewBox={viewBox}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        {regionPaths.map((d, i) => (
          <path
            key={i}
            d={d}
            fill="var(--border)"
            stroke="var(--fg-muted)"
            strokeWidth={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
    </button>
  );
});
