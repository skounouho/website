import path from "node:path";

export interface ContentPaths {
  root: string;
  blog: string;
  map: string;
  about: string;
  resume: {
    work: string;
    education: string;
    publications: string;
    service: string;
  };
}

export function contentPaths(root?: string): ContentPaths {
  const r = root ?? path.join(process.cwd(), "content");
  return {
    root: r,
    blog: path.join(r, "blog"),
    map: path.join(r, "map.yaml"),
    about: path.join(r, "about.mdx"),
    resume: {
      work: path.join(r, "resume", "work.yaml"),
      education: path.join(r, "resume", "education.yaml"),
      publications: path.join(r, "resume", "publications.yaml"),
      service: path.join(r, "resume", "service.yaml"),
    },
  };
}
