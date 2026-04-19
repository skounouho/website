import Link from "next/link";
import type { BlogPost, MapPin } from "@/lib/content";

export function PostFooter({
  post,
  places,
}: {
  post: BlogPost;
  places: MapPin[];
}) {
  return (
    <footer className="mt-16 border-t pt-10" style={{ borderColor: "var(--border)" }}>
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
          <h3 className="font-sans mb-2 text-[18px] font-medium">
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

      <Link href="/blog" className="font-sans text-sm">
        ← Back to writing
      </Link>
    </footer>
  );
}
