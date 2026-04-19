import type { HTMLAttributes, ReactNode } from "react";

export function MdxPre({
  children,
  ...rest
}: HTMLAttributes<HTMLPreElement> & { children?: ReactNode }) {
  return (
    <pre
      {...rest}
      className="font-mono my-6 overflow-x-auto rounded-[2px] border p-4 text-[0.9em]"
      style={{ borderColor: "var(--border)", background: "var(--bg)" }}
    >
      {children}
    </pre>
  );
}

export function MdxCode({
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & { children?: ReactNode }) {
  // If there's a className like "language-xxx", Shiki wrapped it — render as-is.
  const isBlock = className?.startsWith("language-");
  if (isBlock) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }
  return (
    <code
      {...rest}
      className="font-mono rounded-[2px] px-1 py-0.5 text-[0.9em]"
      style={{
        background: "color-mix(in srgb, var(--border) 50%, transparent)",
      }}
    >
      {children}
    </code>
  );
}
