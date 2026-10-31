"use client";

import en from "@/i18n/messages/en.json";
import "@/styles/globals.css";

// Last-resort boundary: it replaces the root layout, so it renders its own html and body. The
// language provider is not available here, so it reads the English file directly.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="mx-auto my-14 max-w-3xl px-6">
          <h1>{en.errorPage.title}</h1>
          <p>{en.errorPage.body}</p>
          {error.digest ? <p>{en.common.reference.replace("{id}", error.digest)}</p> : null}
          {/* eslint-disable-next-line no-restricted-syntax -- stand-in until the shared Button exists (S2-T08) */}
          <button type="button" onClick={reset}>
            {en.common.tryAgain}
          </button>
        </main>
      </body>
    </html>
  );
}
