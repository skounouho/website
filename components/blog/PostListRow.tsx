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
          className="font-serif shrink-0 text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          {formatPostDate(post.date)}
          {post.draft ? (
            <span
              className="font-sans ml-2 inline-block border px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
              style={{ borderColor: "var(--border)" }}
            >
              Draft
            </span>
          ) : null}
        </span>
        <span className="font-sans text-[20px] transition-colors motion-safe:duration-[var(--duration-fast)] group-hover:text-[var(--accent)]">
          {post.title}
        </span>
      </Link>
    </li>
  );
}
