import { startStaffGoogleSignInSchema } from "./schemas";

/**
 * How the sign-in action runs, kept apart from the "use server" file so a test can build the same
 * action with fake dependencies. The visitor is not signed in yet, so there is no authentication
 * step; the rate limit is what protects it (S3-T10).
 */
export const startStaffGoogleSignInConfig = {
  name: "startStaffGoogleSignIn",
  input: startStaffGoogleSignInSchema,
  auth: "none" as const,
  rateLimit: { scope: "staff_sign_in" as const },
};
