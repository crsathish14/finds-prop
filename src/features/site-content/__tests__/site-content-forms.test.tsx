// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import type { HeaderFormValues, StandardFooter, StandardHeader } from "../form";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { HeaderForm } = await import("../header-form.client");
const { FooterForm } = await import("../footer-form.client");

const words = en.admin.siteContent;
const STANDARD_HEADER: StandardHeader = {
  brandName: "Find Prop",
  links: [
    { label: "Buy a home", href: "/properties" },
    { label: "New projects", href: "/projects" },
  ],
  cta: { label: "Post property", href: "/post-property" },
};
const HEADER: HeaderFormValues = {
  name: "",
  links: STANDARD_HEADER.links,
  ctaLabel: "Post property",
  ctaHref: "/post-property",
};
const STANDARD_FOOTER: StandardFooter = {
  brandName: "Find Prop",
  links: [{ label: "Contact us", href: "/contact" }],
  copyright: "© 2026 Find Prop",
};
const FOOTER = {
  about: "",
  phone: "",
  email: "",
  address: "",
  links: STANDARD_FOOTER.links,
  copyright: "",
};

const ok: ActionResult<unknown> = { ok: true, data: { key: "header" } };
const picture = (name: string) => document.querySelector(`[data-slot='${name}']`);

beforeEach(() => vi.clearAllMocks());

describe("UT-header-form: the Header page (S7-T10)", () => {
  const open = (save = vi.fn().mockResolvedValue(ok), initial = HEADER) => {
    renderWithMessages(<HeaderForm initial={initial} standard={STANDARD_HEADER} save={save} />);
    return save;
  };

  it("opens on what visitors see today: the standard links and button, with the name empty", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Header" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: /Site name/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("Buy a home");
    expect(screen.getByRole("textbox", { name: "Link address 2" })).toHaveValue("/projects");
    expect(screen.getByRole("textbox", { name: /Button label/ })).toHaveValue("Post property");
    expect(screen.getByText("Leave the name empty to use Find Prop.")).toBeInTheDocument();
  });

  it("shows the four tabs as links with Header as the current page", () => {
    open();
    const nav = screen.getByRole("navigation", { name: "Site content" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.getAttribute("href")),
    ).toEqual(["/admin/header", "/admin/hero", "/admin/homepage", "/admin/footer"]);
    expect(within(nav).getByRole("link", { name: "Header" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("draws the picture from the boxes as they are typed", async () => {
    open();
    expect(picture("site-header-preview")?.textContent).toBe(
      "Find PropBuy a homeNew projectsPost property",
    );
    await userEvent.type(screen.getByRole("textbox", { name: /Site name/ }), "Kadal Homes");
    await userEvent.clear(screen.getByRole("textbox", { name: "Label 2" }));
    await userEvent.type(screen.getByRole("textbox", { name: "Label 2" }), "Plots");
    expect(picture("site-header-preview")?.textContent).toBe(
      "Kadal HomesBuy a homePlotsPost property",
    );
  });

  it("sends exactly what is in the boxes, then says so and reads the page again", async () => {
    const save = open();
    await userEvent.type(screen.getByRole("textbox", { name: /Site name/ }), "Kadal Homes");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      name: "Kadal Homes",
      links: [
        { label: "Buy a home", href: "/properties" },
        { label: "New projects", href: "/projects" },
      ],
      cta: { label: "Post property", href: "/post-property" },
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.header.saved.title, {
        description: words.header.saved.text,
      }),
    );
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("puts the server's problems on their boxes and names how many in an alert", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        "links.0.href": [{ key: "validation.linkTarget" }],
        "cta.label": [{ key: "validation.required" }],
      },
    } satisfies ActionResult<unknown>);
    open(save);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("2 things need attention");
    expect(screen.getByRole("textbox", { name: "Link address 1" })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: /Button label/ })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Link address 2" })).toBeValid();
    expect(screen.getAllByText(en.validation.linkTarget).length).toBeGreaterThan(0);
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("says a failure with no box to blame in a toast and reads the page again", async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, code: "FORBIDDEN" });
    open(save);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(en.errors.FORBIDDEN));
    expect(router.refresh).toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("turns the boxes off and says Saving while the save is working", async () => {
    let finish: (result: ActionResult<unknown>) => void = () => undefined;
    const save = vi.fn().mockReturnValue(new Promise((resolve) => (finish = resolve)));
    open(save);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("button", { name: "Saving" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("textbox", { name: /Site name/ })).toBeDisabled();
    finish(ok);
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
  });

  it("puts the boxes back to what was loaded when Discard is pressed", async () => {
    open();
    await userEvent.type(screen.getByRole("textbox", { name: /Site name/ }), "Kadal Homes");
    await userEvent.click(screen.getByRole("button", { name: "Remove: Buy a home" }));
    await userEvent.click(screen.getByRole("button", { name: "Discard" }));
    expect(screen.getByRole("textbox", { name: /Site name/ })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("Buy a home");
  });
});

describe("UT-footer-form: the Footer page (S7-T10)", () => {
  const open = (save = vi.fn().mockResolvedValue(ok), initial = FOOTER) => {
    renderWithMessages(<FooterForm initial={initial} standard={STANDARD_FOOTER} save={save} />);
    return save;
  };

  it("opens with the standard links and the contact boxes empty, with Footer as the current tab", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: "Footer" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Label 1" })).toHaveValue("Contact us");
    expect(screen.getByRole("textbox", { name: /Phone/ })).toHaveValue("");
    expect(
      within(screen.getByRole("navigation", { name: "Site content" })).getByRole("link", {
        name: "Footer",
      }),
    ).toHaveAttribute("aria-current", "page");
  });

  it("draws the standard copyright line until one is typed, and the contact lines in the public order", async () => {
    open();
    expect(picture("site-footer-preview")?.textContent).toContain("© 2026 Find Prop");
    await userEvent.type(screen.getByRole("textbox", { name: /Phone/ }), "+91 90000 00000");
    await userEvent.type(screen.getByRole("textbox", { name: /Address/ }), "Chennai");
    const text = picture("site-footer-preview")?.textContent ?? "";
    expect(text.indexOf("Chennai")).toBeLessThan(text.indexOf("+91 90000 00000"));
    await userEvent.type(screen.getByRole("textbox", { name: /Copyright line/ }), "© Kadal");
    expect(picture("site-footer-preview")?.textContent).toContain("© Kadal");
  });

  it("sends the contact lines together and says so after a save", async () => {
    const save = open();
    await userEvent.type(screen.getByRole("textbox", { name: /Email/ }), "hello@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(save).toHaveBeenCalledWith({
      about: "",
      contact: { address: "", email: "hello@example.com", phone: "" },
      links: [{ label: "Contact us", href: "/contact" }],
      copyright: "",
    });
    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith(words.footer.saved.title, {
        description: words.footer.saved.text,
      }),
    );
  });

  it("puts a bad email and a link problem on their boxes", async () => {
    const save = vi.fn().mockResolvedValue({
      ok: false,
      code: "VALIDATION",
      fieldErrors: {
        "contact.email": [{ key: "validation.emailInvalid" }],
        "links.0.label": [{ key: "validation.required" }],
      },
    } satisfies ActionResult<unknown>);
    open(save);
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("2 things need attention");
    expect(screen.getByRole("textbox", { name: /Email/ })).toBeInvalid();
    expect(screen.getByRole("textbox", { name: "Label 1" })).toBeInvalid();
    expect(screen.getByText(en.validation.emailInvalid)).toBeInTheDocument();
  });
});
