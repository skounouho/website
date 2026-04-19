import NextLink from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode };

export function MdxLink({ href, children, ...rest }: Props) {
  if (!href) return <a {...rest}>{children}</a>;

  const isExternal = /^https?:\/\//.test(href);
  if (!isExternal) {
    return (
      <NextLink href={href} {...rest}>
        {children}
      </NextLink>
    );
  }

  return (
    <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
      {children}
      <span aria-hidden="true" className="ml-0.5 inline-block text-[0.85em]">
        ↗
      </span>
    </a>
  );
}
