import { ToolRefusal, type ToolContext } from "./types";

/**
 * The login wall for the assistant's list tools (ADR-171): the tools that list homes, projects, localities or a
 * builder's projects run only for a signed-in customer. A customer who is not signed in gets the refusal
 * `sign_in_required`, which tells the model to point to the sign-in button and to list nothing. The tools that
 * read one home or one project by its id stay open, like the pages that show them.
 */
export function requireSignIn(context: Pick<ToolContext, "signedIn">): void {
  if (!context.signedIn) throw new ToolRefusal("sign_in_required");
}
