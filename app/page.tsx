import { getBlogPosts, getPins, getWork } from "@/lib/content";

export default function Home() {
  const posts = getBlogPosts();
  const pins = getPins();
  const work = getWork();
  return (
    <main className="p-8 font-sans">
      <h1 className="text-2xl">Content loader smoke page</h1>
      <p>
        {posts.length} post(s), {pins.length} pin(s), {work.length} work entry(ies).
      </p>
    </main>
  );
}
