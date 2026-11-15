import { describe, expect, it } from "vitest";
import { offerFromOutput } from "../proposal-offer";

// UT-ai-proposal-offer (AI-P6-T02): what a propose tool's checked output asks the confirm card to be. Made-up data.

const MESSAGE = "Is this home still available?";

describe("UT-ai-proposal-offer: what a result offers", () => {
  it("offers the signed proposal of a ready result, of either propose tool", () => {
    const output = { status: "ready", proposal: "body.signature", target: { homeId: "k3x9a2bd" } };
    expect(offerFromOutput("propose_enquiry", output)).toEqual({
      state: "ready",
      proposal: "body.signature",
    });
    expect(offerFromOutput("propose_site_visit", output)).toEqual({
      state: "ready",
      proposal: "body.signature",
    });
  });

  it("offers the sign-in prompt of a result for a visitor, with the target and the words", () => {
    expect(
      offerFromOutput("propose_enquiry", {
        status: "sign_in_required",
        target: { homeId: "k3x9a2bd" },
        untrustedText: { title: "3 BHK", message: MESSAGE },
      }),
    ).toEqual({
      state: "sign_in_required",
      kind: "enquiry",
      homeId: "k3x9a2bd",
      message: MESSAGE,
    });
    expect(
      offerFromOutput("propose_site_visit", {
        status: "sign_in_required",
        target: { slug: "kadal-vista" },
        visitDate: "2026-12-05",
        untrustedText: { name: "Kadal Vista", message: MESSAGE },
      }),
    ).toEqual({
      state: "sign_in_required",
      kind: "site_visit",
      slug: "kadal-vista",
      visitDate: "2026-12-05",
      message: MESSAGE,
    });
  });

  it("offers nothing for any other tool, even one that returns a proposal-shaped result", () => {
    const output = { status: "ready", proposal: "body.signature" };
    expect(offerFromOutput("get_property", output)).toBeNull();
    expect(offerFromOutput("search_projects", output)).toBeNull();
    expect(offerFromOutput("made_up_tool", output)).toBeNull();
  });

  it("offers nothing for a result that is not a card, or whose target does not fit", () => {
    expect(offerFromOutput("propose_enquiry", null)).toBeNull();
    expect(offerFromOutput("propose_enquiry", { status: "something_else" })).toBeNull();
    expect(
      offerFromOutput("propose_enquiry", {
        status: "sign_in_required",
        target: { homeId: "not a home id" },
        untrustedText: { message: MESSAGE },
      }),
    ).toBeNull();
    expect(
      offerFromOutput("propose_site_visit", {
        status: "sign_in_required",
        target: { slug: "Not A Slug" },
        visitDate: "2026-12-05",
        untrustedText: { message: MESSAGE },
      }),
    ).toBeNull();
  });
});
