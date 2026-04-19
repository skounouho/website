import type { Metadata } from "next";
import {
  getBlogPosts,
  getEducation,
  getPins,
  getPublications,
  getWork,
} from "@/lib/content";
import { WorkEntry } from "@/components/resume/WorkEntry";
import { EducationEntry } from "@/components/resume/EducationEntry";
import { PublicationEntry } from "@/components/resume/PublicationEntry";

export const metadata: Metadata = {
  title: "Resume",
  description: "Work, education, and publications.",
};

function byStartDesc<T extends { start: string }>(a: T, b: T): number {
  return a.start < b.start ? 1 : a.start > b.start ? -1 : 0;
}

export default function ResumePage() {
  const work = [...getWork()].sort(byStartDesc);
  const education = [...getEducation()].sort(byStartDesc);
  const publications = [...getPublications()].sort((a, b) => b.year - a.year);
  const posts = getBlogPosts();
  const pins = getPins();

  return (
    <div className="mx-auto max-w-[70ch] px-6 py-24">
      <section>
        <h2
          className="mb-10 text-[28px] font-bold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Work
        </h2>
        <div className="space-y-10">
          {work.map((entry) => (
            <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2
          className="mb-10 text-[28px] font-bold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Education
        </h2>
        <div className="space-y-10">
          {education.map((entry) => (
            <EducationEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </section>

      <section className="mt-20">
        <h2
          className="mb-10 text-[28px] font-bold"
          style={{ fontFamily: "var(--font-sans)" }}
        >
          Publications
        </h2>
        <div className="space-y-10">
          {publications.map((entry) => (
            <PublicationEntry key={entry.id} entry={entry} />
          ))}
        </div>
      </section>
    </div>
  );
}
