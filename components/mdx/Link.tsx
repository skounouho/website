import NextLink from "next/link";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { isExternalHref } from "./link-util";

type Props = AnchorHTMLAttributes<HTMLAnchorElement> & { children?: ReactNode };

export function MdxLink({ href, children, ...rest }: Props) {
  if (!href) return <a {...rest}>{children}</a>;

  if (!isExternalHref(href)) {
    return (
      <NextLink href={href} {...rest}>
        {children}
      </NextLink>
    );
  }

  // Only http/https get the "↗" affordance; mailto:/tel: open in the native
  // handler without a new tab.
  const isHttp = /^https?:\/\//i.test(href);
  if (!isHttp) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
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
