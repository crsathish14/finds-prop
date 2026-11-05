import { describe, expect, it } from "vitest";
import { enquiryLinks } from "../enquiry-links";

describe("UT-property-enquiry-links: where the gate leads", () => {
  it("asks sign-in to come back to the home, and says why for the first link only", () => {
    expect(enquiryLinks("/properties/3-bhk-velachery-k3x9a2bd")).toEqual({
      signInHref: "/auth?gate=enquire&redirect=%2Fproperties%2F3-bhk-velachery-k3x9a2bd",
      createAccountHref: "/auth?redirect=%2Fproperties%2F3-bhk-velachery-k3x9a2bd",
    });
  });

  it("encodes the address, so nothing in it can add a parameter", () => {
    const { signInHref } = enquiryLinks("/properties/x?next=https://example.com&a=b");
    expect(signInHref).not.toContain("&a=b");
    expect(signInHref).not.toContain("https://");
  });
});
