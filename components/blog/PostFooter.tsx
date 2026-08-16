import Link from "next/link";
import type { BlogPost, MapPin } from "@/lib/content";
import { ShareLink } from "./ShareLink";

export function PostFooter({
  post,
  places,
  shareUrl,
}: {
  post: BlogPost;
  places: MapPin[];
  shareUrl: string | null;
}) {
  return (
    <footer className="mt-[var(--space-section)] border-t pt-[var(--space-block)]" style={{ borderColor: "var(--border)" }}>
      {post.tags.length > 0 ? (
        <ul className="mb-6 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <li
              key={tag}
              className="font-sans border px-2 py-1 text-[11px] uppercase tracking-wider"
              style={{
                borderColor: "var(--border)",
                color: "var(--fg-muted)",
              }}
            >
              {tag}
            </li>
          ))}
        </ul>
      ) : null}

      {places.length > 0 ? (
        <div className="mb-8">
          <h3 className="font-sans mb-2 text-[20px] font-bold">
            Places mentioned
          </h3>
          <ul className="font-serif flex flex-col gap-1">
            {places.map((pin) => (
              <li key={pin.id}>
                <Link href={`/map#${pin.id}`}>{pin.name}</Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex items-start justify-between gap-6">
        <Link href="/blog" className="font-sans text-sm">
          ← Back to writing
        </Link>
        {shareUrl ? <ShareLink url={shareUrl} /> : null}
      </div>
    </footer>
  );
}
