import "@/styles/globals.css";
import Link from "next/link";
import en from "@/i18n/messages/en.json";

// Used when a URL matches no route at all. It bypasses the language layout, so it reads the
// English file directly (like global-error). Pages that call notFound() use [locale]/not-found.tsx.
export default function GlobalNotFound() {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        <main
          id="main"
          className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-14"
        >
          <h1 className="text-2xl font-semibold">{en.notFound.title}</h1>
          <p>{en.notFound.body}</p>
          <Link href="/" className="underline">
            {en.common.goHome}
          </Link>
        </main>
      </body>
    </html>
  );
}
