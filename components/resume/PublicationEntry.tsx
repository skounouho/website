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
      <div
        className="text-sm"
        style={{ fontFamily: "var(--font-serif)" }}
      >
        {entry.authors.join(", ")}
      </div>
      <div style={{ fontFamily: "var(--font-serif)" }}>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {title}
          </a>
        ) : (
          title
        )}
        {label ? (
          <span
            className="ml-2 inline-block border px-1.5 py-0.5 align-middle text-[10px] uppercase tracking-wider"
            style={{
              borderColor: "var(--border)",
              color: "var(--fg-muted)",
              fontFamily: "var(--font-sans)",
            }}
          >
            [{label}]
          </span>
        ) : null}
      </div>
      <div
        className="text-sm"
        style={{ color: "var(--fg-muted)", fontFamily: "var(--font-serif)" }}
      >
        {entry.venue} ({entry.year})
      </div>
    </article>
  );
}
