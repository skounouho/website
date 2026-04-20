import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Single source of truth for long-form page layout: reading width, horizontal
 * gutter (reserves space for the floating nav at md+), and vertical rhythm.
 * Every page that holds prose, resume entries, or lists of links should use
 * this. The map page (full-bleed) opts out.
 */
export function PageContainer({ children, className }: Props) {
  const base =
    "mx-auto max-w-[65ch] px-6 md:px-24 " +
    "pt-[var(--space-page-y)] pb-[var(--space-page-y)] md:pt-[20vh]";
  return <div className={className ? `${base} ${className}` : base}>{children}</div>;
}
