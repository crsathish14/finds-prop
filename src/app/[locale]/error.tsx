"use client";

import { useTranslations } from "next-intl";

// Styled to the approved `errors` screens in Stage 2 (S2-T08), which also swaps the raw button for Button.
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations();
  // Details stay on the server; the digest lets support find the matching log line.
  return (
    <main
      id="main"
      className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-4 px-6 py-16"
    >
      <h1 className="text-2xl font-semibold">{t("errorPage.title")}</h1>
      <p>{t("errorPage.body")}</p>
      {error.digest ? (
        <p className="text-sm">{t("common.reference", { id: error.digest })}</p>
      ) : null}
      {/* eslint-disable-next-line no-restricted-syntax -- stand-in until the shared Button exists (S2-T04, S2-T08) */}
      <button type="button" onClick={reset} className="w-fit underline">
        {t("common.tryAgain")}
      </button>
    </main>
  );
}
