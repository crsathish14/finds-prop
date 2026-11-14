import { ActionError } from "../actions/normalise-error";

/** What `idempotency_keys.scope` accepts (the table's check constraint): lowercase words joined by underscores, 40 characters at most. */
const SCOPE_SHAPE = /^[a-z][a-z0-9_]*$/;
const SCOPE_MAX_LENGTH = 40;

/**
 * The claim's scope for an action. Actions are named by intent in camel case ("createListingDraft"), but
 * the table only takes lowercase and underscores ("create_listing_draft"), so the name is converted here,
 * in one place. A name that still does not fit is a coding mistake: it fails loudly with INTERNAL rather
 * than as a database error on the first request.
 */
export function idempotencyScope(actionName: string): string {
  const scope = actionName.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
  if (!SCOPE_SHAPE.test(scope) || scope.length > SCOPE_MAX_LENGTH) {
    throw new ActionError("INTERNAL", "Idempotency: the action name cannot be used as a scope");
  }
  return scope;
}
