"use client";

// Last-resort boundary: it replaces the root layout, so it renders its own html and body.
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
        <main style={{ maxWidth: "48rem", margin: "4rem auto", padding: "0 1.5rem" }}>
          <h1>Something went wrong</h1>
          <p>Please try again. If it keeps happening, tell us the reference below.</p>
          {error.digest ? <p>Reference: {error.digest}</p> : null}
          {/* eslint-disable-next-line no-restricted-syntax -- stand-in until the shared Button exists (S2-T08) */}
          <button type="button" onClick={reset}>
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
