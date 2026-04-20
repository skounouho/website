import type { Publication, WorkEntry } from "./schemas";

export function partitionWorkByCategory(work: readonly WorkEntry[]): {
  paid: WorkEntry[];
  teachingOther: WorkEntry[];
} {
  const paid: WorkEntry[] = [];
  const teachingOther: WorkEntry[] = [];
  for (const entry of work) {
    if (entry.category === "paid") paid.push(entry);
    else teachingOther.push(entry);
  }
  return { paid, teachingOther };
}

export function partitionPublicationsByKind(
  pubs: readonly Publication[],
): { papers: Publication[]; conferences: Publication[] } {
  const papers: Publication[] = [];
  const conferences: Publication[] = [];
  for (const p of pubs) {
    if (p.kind === "presentation") conferences.push(p);
    else papers.push(p);
  }
  return { papers, conferences };
}

export function sortWorkByStartDesc<T extends { start: string }>(
  entries: readonly T[],
): T[] {
  return [...entries].sort((a, b) =>
    a.start < b.start ? 1 : a.start > b.start ? -1 : 0,
  );
}

export function sortPublicationsByYearDesc(
  pubs: readonly Publication[],
  currentYear: number,
): Publication[] {
  return [...pubs].sort(
    (a, b) => (b.year ?? currentYear) - (a.year ?? currentYear),
  );
}
