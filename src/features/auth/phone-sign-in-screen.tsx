import { PhoneSignIn } from "./phone-sign-in.client";

type PhoneSignInScreenProps = {
  siteKey: string | undefined;
  gate: boolean;
  saveGate?: boolean;
  expiredGate?: boolean;
  redirectTo: string;
  /** Whether the visitor was already signed in when the page was requested. */
  alreadySignedIn: boolean;
  /** Whether the email step follows the name step. The server turns it off with FLAG_CUSTOMER_EMAIL=0. */
  emailStep?: boolean;
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
  expiredGate = false,
  redirectTo,
  alreadySignedIn,
  emailStep = true,
}: PhoneSignInScreenProps) {
  return (
    <main id="main" className="mx-auto w-full max-w-mid flex-1 px-gutter py-10 md:py-14">
      <PhoneSignIn
        siteKey={siteKey}
        gate={gate}
        saveGate={saveGate}
        expiredGate={expiredGate}
        redirectTo={redirectTo}
        alreadySignedIn={alreadySignedIn}
        emailStep={emailStep}
      />
    </main>
  );
}
