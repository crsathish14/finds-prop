import Link from "next/link";

export default function NotFound() {
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16"
    >
      <h1 className="text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p>The link may be old, or the page may have moved.</p>
      <Link href="/" className="underline">
        Go to the home page
      </Link>
    </main>
  );
}
