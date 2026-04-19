import type { BlockquoteHTMLAttributes, ReactNode } from "react";

export function MdxBlockquote({
  children,
  ...rest
}: BlockquoteHTMLAttributes<HTMLElement> & { children?: ReactNode }) {
  return (
    <blockquote
      {...rest}
      className="my-6 border-l-[3px] pl-5 italic"
      style={{ borderColor: "var(--accent)", color: "var(--fg)" }}
    >
      {children}
    </blockquote>
  );
}
