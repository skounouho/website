"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, FileText, Home, Map } from "lucide-react";
import type { ComponentType, SVGProps } from "react";
import { ThemeToggle } from "./ThemeToggle";

interface NavItem {
  href: string;
  label: string;
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
}

const items: NavItem[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/resume", label: "Resume", Icon: FileText },
  { href: "/blog", label: "Blog", Icon: BookOpen },
  { href: "/map", label: "Map", Icon: Map },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function FloatingNav() {
  const pathname = usePathname();
  return (
    <>
      {/* Desktop: left edge, vertical */}
      <nav
        aria-label="Primary"
        className="fixed left-6 top-1/2 z-40 hidden -translate-y-1/2 md:block group"
      >
        <ul className="flex flex-col gap-8">
          {items.map(({ href, label, Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className="flex items-center gap-3 no-underline text-[color:var(--fg-muted)] hover:text-[color:var(--accent)] aria-[current=page]:text-[color:var(--accent)] transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)]"
                  onClick={(e) => {
                    // Pointer clicks: drop focus so :focus-within doesn't keep
                    // the nav expanded post-navigation. Keyboard activations
                    // (detail === 0) keep focus, so the nav stays visible
                    // while the user is still tabbing through it.
                    if (e.detail > 0) e.currentTarget.blur();
                  }}
                >
                  <Icon width={20} height={20} strokeWidth={1.5} />
                  <span className="font-sans text-sm opacity-0 transition-opacity motion-safe:duration-[var(--duration-medium)] ease-[var(--ease-standard)] group-hover:opacity-100 group-focus-within:opacity-100">
                    {label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Desktop: bottom-left theme toggle */}
      <div className="fixed bottom-6 left-6 z-40 hidden md:block">
        <ThemeToggle />
      </div>

      {/* Mobile: bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex h-14 items-center justify-around border-t md:hidden"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--bg) 85%, transparent)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      >
        {items.map(({ href, label, Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              aria-label={label}
              className="flex h-full flex-1 items-center justify-center no-underline"
              style={{ color: active ? "var(--accent)" : "var(--fg-muted)" }}
            >
              <Icon width={22} height={22} strokeWidth={1.5} />
            </Link>
          );
        })}
        <div className="flex h-full flex-1 items-center justify-center">
          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
