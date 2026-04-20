import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
  className?: string;
}

/**
 * Single source of truth for long-form page layout: reading width (60ch),
 * horizontal gutter (reserves space for the floating nav at md+), and vertical
 * rhythm. The outer <div> owns padding and the desktop top offset; the inner
 * <div> owns the content column width. Every page that holds prose, resume
 * entries, or lists of links should use this. The map page opts out.
 */
export function PageContainer({ children, className }: Props) {
  const outer =
    "px-6 md:px-24 " +
    "pt-[var(--space-page-y)] pb-[var(--space-page-y)] md:pt-[20vh]";
  const inner = "mx-auto max-w-[60ch]";
  const innerClass = className ? `${inner} ${className}` : inner;
  return (
    <div className={outer}>
      <div className={innerClass}>{children}</div>
    </div>
  );
}
