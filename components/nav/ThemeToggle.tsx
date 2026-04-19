"use client";

import { Moon, Sun } from "lucide-react";
import { useSyncExternalStore } from "react";

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
  // Read data-theme set by the inline ThemeScript; subscribe to future
  // changes so state stays in sync if any other code flips the attribute.
  const theme = useSyncExternalStore<Theme>(
    subscribeThemeChanges,
    getDomTheme,
    () => "light",
  );
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
      className="inline-flex h-6 w-6 items-center justify-center bg-transparent transition-colors motion-safe:duration-[var(--duration-medium)]"
      style={{ color: "var(--fg-muted)" }}
    >
      {theme === "light" ? (
        <Sun width={20} height={20} strokeWidth={1.5} />
      ) : (
        <Moon width={20} height={20} strokeWidth={1.5} />
      )}
    </button>
  );
}
