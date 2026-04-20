import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-screen max-w-[60ch] flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="font-sans">Nothing here.</p>
      <Link href="/" className="font-sans text-sm">
        ← Home
      </Link>
    </div>
  );
}
