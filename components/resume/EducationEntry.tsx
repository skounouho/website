import type { EducationEntry as Edu } from "@/lib/content";
import { formatYearMonthRange } from "@/lib/format";

export function EducationEntry({ entry }: { entry: Edu }) {
  const meta = [
    entry.minor ? `Minor: ${entry.minor}` : null,
    entry.certificate ? `Certificate: ${entry.certificate}` : null,
    entry.gpa ? `GPA: ${entry.gpa}` : null,
    ...entry.honors,
  ].filter((x): x is string => Boolean(x));

  return (
    <article className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 gap-y-2">
      <h3 className="font-sans text-[22px] font-medium leading-tight">
        {entry.degree}
      </h3>
      <div
        className="font-serif text-right text-sm"
        style={{ color: "var(--fg-muted)" }}
      >
        {formatYearMonthRange(entry.start, entry.end)}
      </div>
      <div className="font-serif col-span-2">{entry.institution}</div>
      {meta.length > 0 ? (
        <div
          className="font-serif col-span-2 text-sm"
          style={{ color: "var(--fg-muted)" }}
        >
          {meta.join(" · ")}
        </div>
      ) : null}
    </article>
  );
}
