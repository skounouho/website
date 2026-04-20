import Link from "next/link";
import { PageContainer } from "@/components/layout/PageContainer";

export default function NotFound() {
  return (
    <PageContainer className="min-h-screen flex flex-col items-center justify-center gap-6 text-center">
      <p className="font-sans">Nothing here.</p>
      <Link href="/" className="font-sans text-sm">
        ← Home
      </Link>
    </PageContainer>
  );
}
