import Link from "next/link";
import type { BlogPost, MapPin, WorkEntry as Work } from "@/lib/content";
import { formatYearMonthRange } from "@/lib/format";

export function WorkEntry({
  entry,
  posts,
  pins,
}: {
  entry: Work;
  posts: BlogPost[];
  pins: MapPin[];
}) {
  const relatedPosts = entry.blog_slugs
    .map((slug) => posts.find((p) => p.slug === slug))
    .filter((p): p is BlogPost => Boolean(p));
  const locationPin =
    entry.map_pin_ids
      .map((id) => pins.find((p) => p.id === id))
      .find((p): p is MapPin => Boolean(p)) ?? null;

  return (
    <article>
      <details className="group/work">
        <summary className="list-none cursor-pointer space-y-1 [&::-webkit-details-marker]:hidden">
          <h3 className="font-sans text-[20px] font-bold leading-tight transition-colors duration-[var(--duration-fast)] ease-[var(--ease-standard)] group-hover/work:text-[color:var(--accent)]">
            {entry.role}
          </h3>
          {entry.subtitle ? (
            <div className="font-serif italic">{entry.subtitle}</div>
          ) : null}
          <div className="font-serif text-sm" style={{ color: "var(--fg-muted)" }}>
            {entry.org_url ? (
              <a href={entry.org_url} target="_blank" rel="noopener noreferrer">
                {entry.org}
              </a>
            ) : (
              <span>{entry.org}</span>
            )}
            {" · "}
            {locationPin ? (
              <Link href={`/map#${locationPin.id}`}>{entry.location}</Link>
            ) : (
              entry.location
            )}
            {" · "}
            {formatYearMonthRange(entry.start, entry.end)}
          </div>
        </summary>
        <div className="mt-3 space-y-3">
          <ul className="list-disc space-y-1 pl-5">
            {entry.highlights.map((h, i) => (
              <li key={i}>{h}</li>
            ))}
          </ul>
          {relatedPosts.length > 0 && (
            <div className="text-sm" style={{ color: "var(--fg-muted)" }}>
              <span className="font-sans">Related: </span>
              {relatedPosts
                .map((p) => (
                  <Link key={`p-${p.slug}`} href={`/blog/${p.slug}`}>
                    {p.title}
                  </Link>
                ))
                .reduce<React.ReactNode[]>(
                  (acc, node, i) =>
                    i === 0 ? [node] : [...acc, " · ", node],
                  [],
                )}
            </div>
          )}
        </div>
      </details>
    </article>
  );
}
