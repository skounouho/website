"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";
import { NavIcon } from "./NavIcon";

type Theme = "light" | "dark";

function getDomTheme(): Theme {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "dark" ? "dark" : "light";
}

function subscribeThemeChanges(onChange: () => void): () => void {
  const obs = new MutationObserver(onChange);
  obs.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => obs.disconnect();
}

export function ThemeToggle() {
  /*
   * The server snapshot is null so SSR and the initial client render both
   * emit a blank placeholder. After hydration, `getDomTheme` reads the real
   * data-theme set by the inline ThemeScript. This avoids the Sun/Moon
   * icon flashing or mismatching on hydration.
   */
  const theme = useSyncExternalStore<Theme | null>(
    subscribeThemeChanges,
    getDomTheme,
    () => null,
  );

  if (theme === null) {
    // Reserve the 24x24 slot so the nav doesn't shift when the icon paints.
    return <span aria-hidden="true" className="inline-block h-6 w-6" />;
  }

  const next: Theme = theme === "light" ? "dark" : "light";
  return (
    <button
      type="button"
      aria-label={`Switch to ${next} mode`}
      onClick={() => {
        document.documentElement.setAttribute("data-theme", next);
        try {
          window.localStorage.setItem("theme", next);
        } catch {
          /* ignore (private mode, etc.) */
        }
      }}
      className="group/nav-item inline-flex h-6 w-6 items-center justify-center bg-transparent text-[color:var(--fg-muted)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] hover:text-[color:var(--accent)]"
    >
      <NavIcon Icon={theme === "light" ? Sun : Moon} />
    </button>
  );
}
