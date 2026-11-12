import { readdirSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * S8-T04 (ADR-125): the inventory of who may call each Server Action. The access level is written in
 * each feature's `action-config.ts` and spread into its `actions.ts`, so the table is read from the
 * source, not from the running modules. Adding an action, or changing who may call one, fails here
 * until the list below is changed on purpose, where a reviewer sees it.
 */
type Level = "none" | "user" | "verified-phone" | "builder" | "super_admin";

const featuresFolder = fileURLToPath(new URL("../../../features/", import.meta.url));

function readLevel(text: string): Level | undefined {
  const match = /auth:\s*(?:"([\w-]+)"|\{\s*role:\s*"([\w-]+)"\s+as const\s*\})/.exec(text);
  const found = match?.[1] ?? match?.[2];
  return found as Level | undefined;
}

/** "feature/exportName" to access level, for every defineAction in every feature's actions.ts. */
function readInventory(): { table: Record<string, Level>; declared: number; unresolved: string[] } {
  const table: Record<string, Level> = {};
  const unresolved: string[] = [];
  let declared = 0;
  for (const feature of readdirSync(featuresFolder)) {
    const actionsPath = `${featuresFolder}${feature}/actions.ts`;
    if (!existsSync(actionsPath)) continue;
    const configPath = `${featuresFolder}${feature}/action-config.ts`;
    const configText = existsSync(configPath) ? readFileSync(configPath, "utf8") : "";
    const actionsText = readFileSync(actionsPath, "utf8");
    declared += actionsText.match(/defineAction\(/g)?.length ?? 0;

    const actionPattern = /export const (\w+)\s*=\s*defineAction\(\{([\s\S]*?)\n\}\);/g;
    for (const [, exportName, body] of actionsText.matchAll(actionPattern)) {
      const key = `${feature}/${exportName}`;
      let level = readLevel(body ?? "");
      const spread = /\.\.\.(\w+)/.exec(body ?? "")?.[1];
      if (!level && spread) {
        const configPattern = new RegExp(`export const ${spread}\\s*=\\s*\\{([\\s\\S]*?)\\n\\}`);
        level = readLevel(configPattern.exec(configText)?.[1] ?? "");
      }
      if (level) table[key] = level;
      else unresolved.push(key);
    }
  }
  return { table, declared, unresolved };
}

const EXPECTED: Record<string, Level> = {
  "auth/sendPhoneCode": "none",
  "auth/verifyPhoneCode": "none",
  "auth/saveProfileName": "user",
  "auth/addEmail": "verified-phone",
  "auth/resendEmailLink": "verified-phone",
  "auth/signOut": "none",
  "builders/inviteBuilder": "super_admin",
  "builders/resendInvitation": "super_admin",
  "builders/setBuilderActive": "super_admin",
  "builders/updateBuilder": "super_admin",
  "builders/updateMyProfile": "builder",
  "crm/saveCrmIntegration": "super_admin",
  "crm/deleteCrmIntegration": "super_admin",
  "crm/testCrmIntegration": "super_admin",
  "crm/retryCrmDelivery": "super_admin",
  "enquiries/sendEnquiry": "verified-phone",
  "enquiries/setEnquiryStatus": "verified-phone",
  "form-builder/createForm": "super_admin",
  "form-builder/updateForm": "super_admin",
  "form-builder/setFormActive": "super_admin",
  "form-builder/duplicateForm": "super_admin",
  "form-builder/deleteForm": "super_admin",
  "forms/submitForm": "none",
  "forms/submitProjectForm": "verified-phone",
  "leads/setLeadStatus": "super_admin",
  "leads/loadMoreLeads": "super_admin",
  "leads/loadMoreSubmissions": "super_admin",
  "leads/setMyLeadStatus": "builder",
  "leads/loadMoreMyLeads": "builder",
  "listings/createListingDraft": "verified-phone",
  "listings/saveListingDraft": "verified-phone",
  "listings/deleteListingDraft": "verified-phone",
  "listings/submitListing": "verified-phone",
  "listings/closeListing": "verified-phone",
  "listings/deleteListing": "verified-phone",
  "listings/saveListingChanges": "verified-phone",
  "media/requestPhotoUpload": "verified-phone",
  "media/finalizePhoto": "verified-phone",
  "media/removePhoto": "verified-phone",
  "moderation/moderateListing": "super_admin",
  "moderation/loadMoreListings": "super_admin",
  "project-editor/createProject": "super_admin",
  "project-editor/updateProject": "super_admin",
  "project-editor/createMyProject": "builder",
  "project-editor/updateMyProject": "builder",
  "project-moderation/moderateProject": "super_admin",
  "project-moderation/deleteProject": "super_admin",
  "projects/submitProjectLead": "verified-phone",
  "projects/trackProjectEvent": "none",
  "saved/saveHomeAction": "verified-phone",
  "saved/unsaveHomeAction": "verified-phone",
  "saved/readSavedHomes": "none",
  "site-content/saveHeader": "super_admin",
  "site-content/saveHero": "super_admin",
  "site-content/saveHomepage": "super_admin",
  "site-content/saveFooter": "super_admin",
  "site-content/saveSponsors": "super_admin",
  "staff-auth/startStaffGoogleSignIn": "none",
  "units/addUnit": "super_admin",
  "units/updateUnit": "super_admin",
  "units/deleteUnit": "super_admin",
  "units/loadMoreUnits": "super_admin",
  "units/addMyUnit": "builder",
  "units/updateMyUnit": "builder",
  "units/deleteMyUnit": "builder",
  "units/loadMoreMyUnits": "builder",
};

/** Why each action that needs no sign-in is open. A new open action needs a reason written here. */
const OPEN_BY_DESIGN: Record<string, string> = {
  "auth/sendPhoneCode": "the visitor is not signed in yet; rate limited by phone and address",
  "auth/verifyPhoneCode": "this is the step that signs the visitor in; rate limited",
  "auth/signOut": "ends the caller's own session and does nothing when there is none",
  "forms/submitForm": "the public contact and lead forms; Turnstile, rate limit and idempotency",
  "projects/trackProjectEvent": "a counter for public project pages; stores no personal data",
  "saved/readSavedHomes": "answers who is signed in; a visitor gets an empty list and no error",
  "staff-auth/startStaffGoogleSignIn":
    "starts the Google redirect; eligibility is decided in the callback",
};

describe("UT-action-access: who may call each Server Action (S8-T04, ADR-125)", () => {
  const { table, declared, unresolved } = readInventory();

  it("finds the access level of every defineAction, so none can be skipped", () => {
    expect(unresolved).toEqual([]);
    expect(Object.keys(table).length).toBe(declared);
  });

  it("holds the counts by level: 31 super_admin, 9 builder, 18 verified-phone, 7 none, 1 user", () => {
    const counts = { none: 0, user: 0, "verified-phone": 0, builder: 0, super_admin: 0 };
    for (const level of Object.values(table)) counts[level] += 1;
    expect(counts).toEqual({
      super_admin: 31,
      builder: 9,
      "verified-phone": 18,
      none: 7,
      user: 1,
    });
    expect(Object.keys(table)).toHaveLength(66);
  });

  it("matches the written list: a new action or a changed level must be changed here on purpose", () => {
    expect(table).toEqual(EXPECTED);
  });

  it("explains every action that needs no sign-in, and only those", () => {
    const open = Object.keys(table).filter((key) => table[key] === "none");
    expect(open.sort()).toEqual(Object.keys(OPEN_BY_DESIGN).sort());
    for (const reason of Object.values(OPEN_BY_DESIGN)) expect(reason.length).toBeGreaterThan(10);
  });

  it("keeps every admin and builder action behind a role, never behind a plain sign-in", () => {
    for (const key of Object.keys(table)) {
      const name = key.split("/")[1] ?? "";
      if (/My[A-Z]/.test(name)) expect(table[key], key).toBe("builder");
    }
  });
});
