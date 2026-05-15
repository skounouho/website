import { Fragment, type ReactNode } from "react";

/*
 * Frontmatter titles may wrap spans in `*...*` to mark them as italic
 * (e.g. film, book, or album names). These helpers turn that convention
 * into rendered React nodes for the UI, or strip it for plain-text uses
 * like the HTML <title> and OG image.
 *
 * Only single asterisks are recognized; double asterisks pass through.
 */

const PATTERN = /\*([^*]+)\*/g;

export function renderTitle(title: string): ReactNode {
  const parts: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  for (const match of title.matchAll(PATTERN)) {
    const start = match.index ?? 0;
    if (start > lastIndex) parts.push(title.slice(lastIndex, start));
    parts.push(<em key={key++}>{match[1]}</em>);
    lastIndex = start + match[0].length;
  }
  if (lastIndex < title.length) {
    const tail = title.slice(lastIndex);
    parts.push(lastIndex > 0 ? " " + tail : tail);
  }
  return <Fragment>{parts}</Fragment>;
}

export function stripTitle(title: string): string {
  return title.replace(PATTERN, "$1");
}
