// @vitest-environment jsdom
import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import { AgentCard, initialsOf, type AgentCardData } from "../agent-card";

const agent: AgentCardData = {
  name: "Meena Realty",
  tagline: "South Chennai",
  years: 14,
  listings: 23,
  localities: ["Adyar", "Besant Nagar", "Velachery", "Not shown"],
  profileHref: "/agents/abc",
};

describe("AgentCard: one recommended agent", () => {
  it("shows the name as a link to the profile, the facts and three localities", () => {
    renderWithMessages(
      <AgentCard agent={agent} contact={<button type="button">Show contact</button>} />,
    );
    expect(screen.getByRole("heading", { level: 3, name: "Meena Realty" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Meena Realty" })).toHaveAttribute(
      "href",
      "/agents/abc",
    );
    expect(screen.getByText("14 years")).toBeInTheDocument();
    expect(screen.getByText("23")).toBeInTheDocument();
    expect(screen.getByText("Adyar")).toBeInTheDocument();
    expect(screen.getByText("Velachery")).toBeInTheDocument();
    expect(screen.queryByText("Not shown")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show contact" })).toBeInTheDocument();
  });

  it("leaves out a missing or zero fact instead of showing it blank", () => {
    renderWithMessages(
      <AgentCard
        agent={{ name: "Quiet Agent", years: null, listings: 0, profileHref: "/agents/x" }}
      />,
    );
    expect(screen.queryByText("Experience")).not.toBeInTheDocument();
    expect(screen.queryByText("Listings")).not.toBeInTheDocument();
    expect(screen.queryByText("Works in")).not.toBeInTheDocument();
    expect(document.querySelector("[data-slot=agent-card-photo]")).toHaveTextContent("QA");
  });

  it("takes the first letters of the first two words as initials", () => {
    expect(initialsOf("Meena Realty Group")).toBe("MR");
    expect(initialsOf("Solo")).toBe("S");
  });
});
