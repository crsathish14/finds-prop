// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "../accordion";

function sample() {
  return (
    <Accordion>
      <AccordionItem id="a">
        <AccordionTrigger>First question</AccordionTrigger>
        <AccordionContent>First answer</AccordionContent>
      </AccordionItem>
      <AccordionItem id="b" open>
        <AccordionTrigger>Second question</AccordionTrigger>
        <AccordionContent>Second answer</AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

const itemOf = (question: string) =>
  screen.getByText(question).closest("details") as HTMLDetailsElement;

describe("Accordion (ADR-143)", () => {
  it("puts each question in a level-3 heading inside its summary", () => {
    render(sample());
    const headings = screen.getAllByRole("heading", { level: 3 });
    expect(headings.map((heading) => heading.textContent)).toEqual([
      "First question",
      "Second question",
    ]);
    for (const heading of headings) expect(heading.parentElement?.tagName).toBe("SUMMARY");
  });

  it("starts closed unless told to open, and keeps every answer in the page", () => {
    render(sample());
    expect(itemOf("First question").open).toBe(false);
    expect(itemOf("Second question").open).toBe(true);
    expect(screen.getByText("First answer")).toBeInTheDocument();
    expect(screen.getByText("Second answer")).toBeInTheDocument();
  });

  it("opens and closes with the summary, and keeps another open at the same time", () => {
    render(sample());
    const first = itemOf("First question");
    fireEvent.click(screen.getByText("First question"));
    expect(first.open).toBe(true);
    expect(itemOf("Second question").open).toBe(true);
    fireEvent.click(screen.getByText("First question"));
    expect(first.open).toBe(false);
  });

  it("gives the item the anchor it was given", () => {
    render(sample());
    expect(document.getElementById("a")?.tagName).toBe("DETAILS");
  });
});
