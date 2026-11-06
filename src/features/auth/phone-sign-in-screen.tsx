import { PhoneSignIn } from "./phone-sign-in.client";

type PhoneSignInScreenProps = {
  siteKey: string | undefined;
  gate: boolean;
  saveGate?: boolean;
  redirectTo: string;
  /** Whether the visitor was already signed in when the page was requested. */
  alreadySignedIn: boolean;
};

/**
 * The customer sign-in page (ADD-01 and ADD-02): the number step and the code step share one card,
 * and the panel beside it changes with the step, so both live in one client island. The shared
 * header and footer are not here: they arrive with the shared layout. Words come from en.json.
 */
export function PhoneSignInScreen({
  siteKey,
  gate,
  saveGate = false,
  redirectTo,
  alreadySignedIn,
}: PhoneSignInScreenProps) {
  return (
    <main id="main" className="mx-auto w-full max-w-mid flex-1 px-gutter py-10 md:py-14">
      <PhoneSignIn
        siteKey={siteKey}
        gate={gate}
        saveGate={saveGate}
        redirectTo={redirectTo}
        alreadySignedIn={alreadySignedIn}
      />
    </main>
  );
}
