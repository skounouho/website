import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBlogPost, getBlogPosts, getPin } from "@/lib/content";
import { renderMdx } from "@/lib/content/mdx";
import { PostHeader } from "@/components/blog/PostHeader";
import { PostFooter } from "@/components/blog/PostFooter";
import { PageContainer } from "@/components/layout/PageContainer";

export function generateStaticParams() {
  return getBlogPosts()
    .filter((p) => !p.draft)
    .map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await props.params;
  const post = getBlogPost(slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.updated,
    },
  };
}

export default async function BlogPostPage(props: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await props.params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const places = post.places
    .map((id) => getPin(id))
    .filter((p): p is NonNullable<typeof p> => p !== null);

  return (
    <PageContainer>
      <article>
        <PostHeader post={post} />
        <div className="prose-site">{renderMdx(post.body)}</div>
        <PostFooter post={post} places={places} />
      </article>
    </PageContainer>
  );
}
