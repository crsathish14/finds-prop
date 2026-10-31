import { expect, test } from "@playwright/test";
import en from "../../src/i18n/messages/en.json";
import { settle } from "./helpers";

// Keyboard and real-browser behaviour that jsdom cannot show (plan 04 section 8; ADR-037): the
// combobox keeps the cursor in its text box, menus and dialogs return focus, toasts appear.

test.describe("keyboard", () => {
  test("the skip link is the first thing Tab reaches on a Design Lab page", async ({ page }) => {
    await page.goto("/design-system/components");
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: en.common.skipToContent })).toBeFocused();
  });

  test("combobox: suggestions appear, the cursor stays in the box, arrows and Enter pick", async ({
    page,
  }) => {
    await page.goto("/design-system/components");
    await settle(page);
    const input = page.getByRole("combobox", { name: "Locality" });
    await input.click();
    await input.pressSequentially("vel", { delay: 60 });
    const list = page.getByRole("listbox");
    await expect(list).toBeVisible();
    await expect(list.getByRole("option")).toHaveCount(2);
    // cmdk used to move focus into its list here; the reader must be able to keep typing.
    await expect(input).toBeFocused();
    await input.pressSequentially("a", { delay: 60 });
    await expect(input).toHaveValue("vela");
    await expect(input).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(input).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(input).toHaveValue("Velappanchavadi");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(page.getByText("Picked: Velappanchavadi")).toBeVisible();
  });

  test("combobox: Escape closes the list and keeps what was typed", async ({ page }) => {
    await page.goto("/design-system/components");
    await settle(page);
    const input = page.getByRole("combobox", { name: "Locality" });
    await input.click();
    await input.pressSequentially("mylap", { delay: 60 });
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toBeHidden();
    await expect(input).toHaveValue("mylap");
    await expect(input).toBeFocused();
  });

  test("combobox: two letters ask for nothing, however long the reader pauses", async ({
    page,
  }) => {
    await page.clock.install();
    await page.goto("/design-system/components");
    await settle(page);
    const input = page.getByRole("combobox", { name: "Locality" });
    await input.click();
    await input.pressSequentially("ve");
    await page.clock.fastForward(5000);
    await expect(page.getByRole("listbox")).toBeHidden();
  });

  test("dropdown menu: opens from the keyboard, Escape returns focus to the button", async ({
    page,
  }) => {
    await page.goto("/design-system/navigation");
    await settle(page);
    const trigger = page.getByRole("button", { name: "Row actions" });
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menu")).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("tabs: arrow keys move between tabs and show the panel", async ({ page }) => {
    await page.goto("/design-system/navigation");
    await settle(page);
    const first = page.getByRole("tab", { name: /Listings/ });
    await first.focus();
    await page.keyboard.press("ArrowRight");
    await expect(page.getByRole("tab", { name: /Enquiries/ })).toBeFocused();
    await expect(page.getByText("Your enquiries appear here.")).toBeVisible();
  });

  test("segmented control: arrow keys move and select", async ({ page }) => {
    await page.goto("/design-system/components");
    await settle(page);
    const group = page.getByRole("radiogroup", { name: "Listing type" });
    await group.getByRole("radio", { name: "Buy" }).focus();
    await page.keyboard.press("ArrowRight");
    await expect(group.getByRole("radio", { name: "Rent" })).toBeFocused();
    await expect(group.getByRole("radio", { name: "Rent" })).toBeChecked();
  });

  test("sortable rows: Move up reorders without dragging", async ({ page }) => {
    await page.goto("/design-system/components");
    await settle(page);
    await page.getByRole("button", { name: "Move Master bedroom up" }).click();
    const rows = page.locator("[data-slot=sortable-row]");
    await expect(rows.nth(1)).toContainText("Master bedroom");
    await expect(rows.nth(2)).toContainText("Kitchen");
  });
});

test.describe("dialogs, sheets and toasts", () => {
  test("a destructive confirm dialog focuses the safe button, traps focus, and returns it on Escape", async ({
    page,
  }) => {
    await page.goto("/design-system/feedback");
    await settle(page);
    const trigger = page.getByRole("button", { name: "Delete listing" }).first();
    await trigger.click();
    const dialog = page.getByRole("alertdialog", { name: "Delete this listing?" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole("button", { name: "Keep listing" })).toBeFocused();
    for (let press = 0; press < 4; press++) {
      await page.keyboard.press("Tab");
      const inside = await page.evaluate(() =>
        Boolean(document.activeElement?.closest("[role=alertdialog]")),
      );
      expect(inside, "focus left the dialog").toBe(true);
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a bottom sheet opens as a dialog and Escape closes it, returning focus", async ({
    page,
  }) => {
    await page.goto("/design-system/feedback");
    await settle(page);
    const trigger = page.getByRole("button", { name: "Bottom sheet" });
    await trigger.click();
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog", { name: "Filters" })).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("a toast appears in the live region, can be closed, and an Undo button works", async ({
    page,
  }) => {
    await page.goto("/design-system/feedback");
    await settle(page);
    await page.getByRole("button", { name: "Success toast" }).click();
    const region = page.getByRole("region", { name: en.toast.container });
    await expect(region.getByText("Saved to your list")).toBeVisible();
    await region.getByRole("button", { name: en.common.close }).first().click();
    await expect(region.getByText("Saved to your list")).toBeHidden();

    await page.getByRole("button", { name: "Toast with Undo" }).click();
    await region.getByRole("button", { name: "Undo" }).click();
    await expect(region.getByText("Restored")).toBeVisible();
  });
});

test.describe("on a phone", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the menu button opens the drawer; Escape closes it and returns focus", async ({ page }) => {
    await page.goto("/design-system/preview/header-signed-out");
    await settle(page);
    const trigger = page.getByRole("button", { name: "Open menu" });
    await trigger.click();
    const drawer = page.getByRole("dialog", { name: "Menu" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByRole("link", { name: "Buy" })).toHaveAttribute("aria-current", "page");
    await page.keyboard.press("Escape");
    await expect(drawer).toBeHidden();
    await expect(trigger).toBeFocused();
  });

  test("the bottom bar shows five items and the main navigation is not in the header", async ({
    page,
  }) => {
    await page.goto("/design-system/preview/bottom-bar");
    await settle(page);
    await expect(page.getByRole("navigation", { name: "Primary" }).getByRole("link")).toHaveCount(
      5,
    );
    await page.goto("/design-system/preview/header-signed-out");
    await expect(page.getByRole("navigation", { name: "Main" })).toBeHidden();
  });

  test("the portal sidebar is a drawer on phones", async ({ page }) => {
    await page.goto("/design-system/preview/portal-admin");
    await settle(page);
    await expect(page.getByRole("navigation", { name: "Admin" })).toBeHidden();
    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(
      page.getByRole("dialog", { name: "Admin menu" }).getByRole("link", { name: /Overview/ }),
    ).toBeVisible();
  });
});

test.describe("on a desktop", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("the header shows the full navigation and no menu button; the bottom bar is hidden", async ({
    page,
  }) => {
    await page.goto("/design-system/preview/header-signed-out");
    await settle(page);
    await expect(page.getByRole("navigation", { name: "Main" }).getByRole("link")).toHaveCount(5);
    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
    await page.goto("/design-system/preview/bottom-bar");
    await expect(page.getByRole("navigation", { name: "Primary" })).toBeHidden();
  });

  test("the portal shows the full sidebar with its labels", async ({ page }) => {
    await page.goto("/design-system/preview/portal-admin");
    await settle(page);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: /Leads/ })).toBeVisible();
    await expect(nav.getByText("Leads")).toBeVisible();
  });

  test("the account menu lists the workspace links", async ({ page }) => {
    await page.goto("/design-system/preview/header-signed-in");
    await settle(page);
    await page.getByRole("button", { name: "Account menu" }).click();
    await expect(page.getByRole("menuitem", { name: /Saved homes/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toBeHidden();
  });
});

test.describe("on a tablet", () => {
  test.use({ viewport: { width: 820, height: 1180 } });

  test("the portal is an icon rail: each item keeps a name", async ({ page }) => {
    await page.goto("/design-system/preview/portal-admin");
    await settle(page);
    const nav = page.getByRole("navigation", { name: "Admin" });
    await expect(nav.getByRole("link", { name: /Leads/ })).toBeVisible();
    // Screen-reader-only text is kept (so the link has a name) but takes no room on screen.
    const box = await nav.getByText("Leads").boundingBox();
    expect(box?.width ?? 0).toBeLessThanOrEqual(1);
  });
});

test.describe("sponsor slot", () => {
  test("the fallback page has no sponsored label and no empty frame", async ({ page }) => {
    await page.goto("/design-system/preview/hero-none");
    await settle(page);
    await expect(page.getByText(en.sponsor.label)).toHaveCount(0);
    await expect(page.locator("[data-slot=sponsor-slot]")).toHaveCount(0);
  });

  test("a sponsor link opens safely, and the pager moves between ads", async ({ page }) => {
    await page.goto("/design-system/preview/hero-a-three-ads");
    await settle(page);
    const link = page.locator("[data-slot=sponsor-slot] a");
    await expect(link).toHaveAttribute("rel", "sponsored noopener");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("aria-label", /banner A/);
    await page.getByRole("button", { name: en.sponsor.next }).click();
    await expect(link).toHaveAttribute("aria-label", /banner B/);
  });

  test("the picture does not shift the page when it loads", async ({ page }) => {
    await page.goto("/design-system/preview/hero-a-one-ad");
    const frame = page.locator("[data-slot=sponsor-slot] a");
    await expect(frame).toBeVisible();
    const before = await frame.boundingBox();
    await settle(page);
    const after = await frame.boundingBox();
    expect(after?.height).toBeCloseTo(before?.height ?? 0, 0);
  });

  test("About this ad opens a popover", async ({ page }) => {
    await page.goto("/design-system/preview/hero-a-one-ad");
    await settle(page);
    await page.getByRole("button", { name: en.sponsor.about }).click();
    await expect(page.getByText(en.sponsor.aboutTitle)).toBeVisible();
  });
});
