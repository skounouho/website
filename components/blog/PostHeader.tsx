import type { BlogPost } from "@/lib/content";
import { formatPostDate } from "@/lib/format";

export function PostHeader({ post }: { post: BlogPost }) {
  return (
    <header className="mb-10">
      <div
        className="text-sm"
        style={{
          color: "var(--fg-muted)",
          fontFamily: "var(--font-serif)",
        }}
      >
        {formatPostDate(post.date)}
      </div>
      {post.updated ? (
        <div
          className="text-sm"
          style={{
            color: "var(--fg-muted)",
            fontFamily: "var(--font-serif)",
          }}
        >
          Updated {formatPostDate(post.updated)}
        </div>
      ) : null}
      <h1
        className="mt-3 text-[40px] font-bold leading-[1.15]"
        style={{ fontFamily: "var(--font-sans)", color: "var(--fg)" }}
      >
        {post.title}
      </h1>
    </header>
  );
}
