import type { BlogPost } from "@/lib/content";
import { formatPostDate } from "@/lib/format";

export function PostHeader({ post }: { post: BlogPost }) {
  return (
    <header className="mb-[var(--space-block)]">
      <div className="font-serif text-sm" style={{ color: "var(--fg-muted)" }}>
        {formatPostDate(post.date)}
      </div>
      {post.updated ? (
        <div className="font-serif text-sm" style={{ color: "var(--fg-muted)" }}>
          Updated {formatPostDate(post.updated)}
        </div>
      ) : null}
      <h1
        className="font-sans mt-3 text-[36px] font-bold leading-[1.15]"
        style={{ color: "var(--fg)" }}
      >
        {post.title}
      </h1>
    </header>
  );
}
