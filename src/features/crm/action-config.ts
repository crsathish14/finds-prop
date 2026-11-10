import {
  deleteIntegrationSchema,
  retryDeliverySchema,
  saveIntegrationSchema,
  testIntegrationSchema,
} from "./schemas";

/**
 * How the admin's CRM actions run, kept apart from the "use server" file so a test can build them (S7-T09). Only a
 * super admin may call them. Saving and deleting are limited with the admin's other edits (`admin_edit`, 600 an hour).
 * A test sends a real call to somebody else's server, so it is limited like the admin's other decisions
 * (`admin_decision`, 120 an hour): plenty for setting a connection up, not enough to use the screen as a way to hit
 * a server. No idempotency key: a save sets values, so a repeat changes nothing more; a second delete finds nothing.
 * No cache tag: the connections are read for the admin alone and never cached. The database records a saved, changed
 * or deleted connection and a changed secret in the audit log with the admin as the actor (names only, never values),
 * so the actions have no `audit` entry.
 */
export const saveIntegrationConfig = {
  name: "saveCrmIntegration",
  input: saveIntegrationSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
};

export const deleteIntegrationConfig = {
  name: "deleteCrmIntegration",
  input: deleteIntegrationSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_edit" as const },
};

export const testIntegrationConfig = {
  name: "testCrmIntegration",
  input: testIntegrationSchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
};

/**
 * "Retry delivery now" (S7-T09 part B2): sends one submission to its CRM at once, on a fresh schedule. It calls
 * somebody else's server, so it is limited like a test, with the admin's decisions (`admin_decision`, 120 an hour).
 * No idempotency key: a second press meets a submission that is already sent or being sent and is a conflict. No cache
 * tag: the submissions list is read for the admin alone and never cached.
 */
export const retryDeliveryConfig = {
  name: "retryCrmDelivery",
  input: retryDeliverySchema,
  auth: { role: "super_admin" as const },
  rateLimit: { scope: "admin_decision" as const },
};
