import type { Metadata } from "next";
import { getBlogPosts } from "@/lib/content";
import { PostListRow } from "@/components/blog/PostListRow";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "Writing",
  description: "Essays and notes by Senou Kounouho.",
};

export default function BlogIndex() {
  const posts = [...getBlogPosts()].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  );

  return (
    <PageContainer>
      <h1 className="font-sans mb-[var(--space-section)] text-[36px] font-bold">
        Writing
      </h1>
      <ul className="flex flex-col gap-3">
        {posts.map((post) => (
          <PostListRow key={post.slug} post={post} />
        ))}
      </ul>
    </PageContainer>
  );
}
