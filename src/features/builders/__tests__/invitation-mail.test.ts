import { describe, expect, it } from "vitest";
import { ActionError } from "@/server/actions/normalise-error";
import { createLogger } from "@/server/logger";
import { createFakeMailSender } from "@/server/mail";
import { buildInvitationMail, deliverInvitationMail } from "../invitation-mail";

const VALUES = {
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  kind: "builder",
  signInUrl: "https://findsprop.com/builder/login",
  siteName: "findsprop",
} as const;

function harness(sender = createFakeMailSender()) {
  const lines: string[] = [];
  const log = createLogger({}, { write: (line: string) => void lines.push(line) });
  return {
    sender,
    lines,
    deps: { sender, signInUrl: VALUES.signInUrl, siteName: VALUES.siteName, log },
  };
}

describe("UT-invitation-mail: the greeting an invited builder or agent gets (ADR-203)", () => {
  it("goes to the login email, names the site, the person and the sign-in address", () => {
    const mail = buildInvitationMail(VALUES);
    expect(mail.to).toBe("sales@kadalhomes.example");
    expect(mail.subject).toBe("Welcome to findsprop: you have been added as a Builder");
    expect(mail.text).toContain("Hello Kadal Homes,");
    expect(mail.text).toContain("https://findsprop.com/builder/login");
    expect(mail.text).toContain("Google account for sales@kadalhomes.example");
  });

  it("says the type: Builder for a builder and Agent for an agent", () => {
    expect(buildInvitationMail(VALUES).text).toContain("Account type: Builder");
    const agent = buildInvitationMail({ ...VALUES, kind: "agent" });
    expect(agent.text).toContain("Account type: Agent");
    expect(agent.text).toContain("as an Agent.");
    expect(agent.subject).toBe("Welcome to findsprop: you have been added as an Agent");
    expect(agent.text).not.toContain("Builder");
  });

  it("holds no raw placeholder and says there is no password", () => {
    const { text } = buildInvitationMail(VALUES);
    expect(text).not.toMatch(/[{}]/);
    expect(text).toContain("no password");
  });
});

describe("UT-invitation-mail: sending it (ADR-203)", () => {
  it("hands the message to the sender, and logs the kind only", async () => {
    const { sender, lines, deps } = harness();
    expect(await deliverInvitationMail(VALUES, deps)).toBe(true);
    expect(sender.sent).toHaveLength(1);
    expect(sender.sent[0]?.to).toBe("sales@kadalhomes.example");
    const logged = lines.join("\n");
    expect(logged).toContain("invitation mail handed to the sender");
    expect(logged).not.toContain("kadalhomes");
    expect(logged).not.toContain("Kadal");
  });

  it("never throws when the provider fails, and logs the code without the address", async () => {
    const failing = createFakeMailSender({
      failWith: new ActionError(
        "UPSTREAM_FAILED",
        "The mail provider refused the message (HTTP 429)",
      ),
    });
    const { lines, deps } = harness(failing);
    expect(await deliverInvitationMail(VALUES, deps)).toBe(false);
    const logged = lines.join("\n");
    expect(logged).toContain("invitation mail not sent");
    expect(logged).toContain("UPSTREAM_FAILED");
    expect(logged).not.toContain("kadalhomes");
  });
});
