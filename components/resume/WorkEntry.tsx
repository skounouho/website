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
  const relatedPins = entry.map_pin_ids
    .map((id) => pins.find((p) => p.id === id))
    .filter((p): p is MapPin => Boolean(p));

  return (
    <article className="space-y-3">
      <h3 className="font-sans text-[22px] font-medium leading-tight">
        {entry.role}
      </h3>
      <div className="font-serif text-sm" style={{ color: "var(--fg-muted)" }}>
        {entry.org_url ? (
          <a href={entry.org_url} target="_blank" rel="noopener noreferrer">
            {entry.org}
          </a>
        ) : (
          <span>{entry.org}</span>
        )}
        {" · "}
        {entry.location}
        {" · "}
        {formatYearMonthRange(entry.start, entry.end)}
      </div>
      <ul className="list-disc space-y-1 pl-5">
        {entry.highlights.map((h, i) => (
          <li key={i}>{h}</li>
        ))}
      </ul>
      {(relatedPosts.length > 0 || relatedPins.length > 0) && (
        <div className="text-sm" style={{ color: "var(--fg-muted)" }}>
          <span className="font-sans">Related: </span>
          {[
            ...relatedPosts.map((p) => (
              <Link key={`p-${p.slug}`} href={`/blog/${p.slug}`}>
                {p.title}
              </Link>
            )),
            ...relatedPins.map((p) => (
              <Link key={`m-${p.id}`} href={`/map#${p.id}`}>
                {p.name}
              </Link>
            )),
          ].reduce<React.ReactNode[]>(
            (acc, node, i) =>
              i === 0 ? [node] : [...acc, " · ", node],
            [],
          )}
        </div>
      )}
    </article>
  );
}
