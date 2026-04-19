import Link from "next/link";
import type { BlogPost } from "@/lib/content";
import { formatPostDate } from "@/lib/format";

export function PostListRow({ post }: { post: BlogPost }) {
  return (
    <li className="py-2">
      <Link
        href={`/blog/${post.slug}`}
        className="group flex flex-col gap-1 no-underline sm:flex-row sm:items-baseline sm:gap-6"
      >
        <span
          className="shrink-0 text-sm"
          style={{
            color: "var(--fg-muted)",
            fontFamily: "var(--font-serif)",
          }}
        >
          {formatPostDate(post.date)}
          {post.draft ? (
            <span
              className="ml-2 inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
              style={{
                borderColor: "var(--border)",
                fontFamily: "var(--font-sans)",
              }}
            >
              Draft
            </span>
          ) : null}
        </span>
        <span
          className="text-[20px] transition-colors motion-safe:duration-[var(--duration-fast)] group-hover:text-[var(--accent)]"
          style={{ fontFamily: "var(--font-serif)" }}
        >
          {post.title}
        </span>
      </Link>
    </li>
  );
}
