import type { Publication } from "@/lib/content";

const statusLabel: Record<Publication["status"], string | null> = {
  published: null,
  "in-review": "in review",
  accepted: "accepted",
};

export function PublicationEntry({ entry }: { entry: Publication }) {
  const href = entry.doi
    ? `https://doi.org/${entry.doi}`
    : entry.url ?? null;
  const label = statusLabel[entry.status];

  const title = (
    <span className="italic">{entry.title}</span>
  );

  return (
    <article className="space-y-1">
      <div className="font-serif text-sm">{entry.authors.join(", ")}</div>
      <div className="font-serif">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {title}
          </a>
        ) : (
          title
        )}
        {label ? (
          <span
            className="font-sans ml-2 inline-block border px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wider"
            style={{
              borderColor: "var(--border)",
              color: "var(--fg-muted)",
            }}
          >
            {label}
          </span>
        ) : null}
      </div>
      <div
        className="font-serif text-sm"
        style={{ color: "var(--fg-muted)" }}
      >
        {entry.venue} ({entry.year})
      </div>
    </article>
  );
}
