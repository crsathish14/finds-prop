import type { ReactNode } from "react";
import { AuthAside, type AuthStep } from "./auth-aside";

/**
 * The layout of the customer sign-in pages: the panel beside the card on large screens, and the card.
 * The panel's text follows the step. Every step of /auth uses it, so the card never jumps between
 * steps (ADD-01 to ADD-03).
 */
export function AuthFrame({ step, children }: { step: AuthStep; children: ReactNode }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <AuthAside step={step} />
      <section className="grid place-items-center">
        <div className="w-full max-w-md rounded-xl border border-line bg-surface p-6 shadow-card md:p-8">
          {children}
        </div>
      </section>
    </div>
  );
}
