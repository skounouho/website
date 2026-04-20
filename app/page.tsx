import type { Metadata } from "next";
import {
  getAboutPage,
  getBlogPosts,
  getEducation,
  getPins,
  getPublications,
  getWork,
} from "@/lib/content";
import {
  partitionPublicationsByKind,
  partitionWorkByCategory,
  sortPublicationsByYearDesc,
  sortWorkByStartDesc,
} from "@/lib/content/resume-sections";
import { renderMdx } from "@/lib/content/mdx";
import { WorkEntry } from "@/components/resume/WorkEntry";
import { EducationEntry } from "@/components/resume/EducationEntry";
import { PublicationEntry } from "@/components/resume/PublicationEntry";
import { PageContainer } from "@/components/layout/PageContainer";

export const metadata: Metadata = {
  title: "Senou Kounouho",
  description: "About, work, education, and publications.",
};

export default function Home() {
  const about = getAboutPage();
  const { paid, teachingOther } = partitionWorkByCategory(getWork());
  const paidWork = sortWorkByStartDesc(paid);
  const teachingWork = sortWorkByStartDesc(teachingOther);
  const education = sortWorkByStartDesc(getEducation());
  const { papers, conferences } = partitionPublicationsByKind(getPublications());
  const currentYear = new Date().getFullYear();
  const sortedPapers = sortPublicationsByYearDesc(papers, currentYear);
  const sortedConferences = sortPublicationsByYearDesc(conferences, currentYear);
  const posts = getBlogPosts();
  const pins = getPins();

  const sectionHeading =
    "font-sans mb-[var(--space-block)] text-[24px] font-bold";

  return (
    <PageContainer>
      <section id="about" aria-labelledby="about-heading">
        <h1 id="about-heading" className="sr-only">
          About
        </h1>
        <article className="prose-site w-full">{renderMdx(about.body)}</article>
      </section>

      <hr
        className="mt-[var(--space-section)] border-0"
        style={{ borderTop: "1px solid var(--border)" }}
        aria-hidden="true"
      />

      <div id="resume" className="mt-[var(--space-section)]">
        <section id="work">
          <h2 className={sectionHeading}>Work &amp; Internships</h2>
          <div className="space-y-10">
            {paidWork.map((entry) => (
              <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
            ))}
          </div>
        </section>

        <section id="teaching" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Teaching &amp; Other</h2>
          <div className="space-y-10">
            {teachingWork.map((entry) => (
              <WorkEntry key={entry.id} entry={entry} posts={posts} pins={pins} />
            ))}
          </div>
        </section>

        <section id="education" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Education</h2>
          <div className="space-y-10">
            {education.map((entry) => (
              <EducationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <section id="papers" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Published Papers</h2>
          <div className="space-y-10">
            {sortedPapers.map((entry) => (
              <PublicationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>

        <section id="conferences" className="mt-[var(--space-section)]">
          <h2 className={sectionHeading}>Conferences</h2>
          <div className="space-y-10">
            {sortedConferences.map((entry) => (
              <PublicationEntry key={entry.id} entry={entry} />
            ))}
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
