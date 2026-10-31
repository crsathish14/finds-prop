// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Settings, Trash2 } from "lucide-react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ConfirmDialog } from "../confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";
import { Sheet, SheetContent, SheetTrigger } from "../sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";

describe("Tabs", () => {
  function Example({ onValueChange }: { onValueChange?: (value: string) => void }) {
    return (
      <Tabs defaultValue="listings" {...(onValueChange ? { onValueChange } : {})}>
        <TabsList aria-label="Dashboard">
          <TabsTrigger value="listings">Listings</TabsTrigger>
          <TabsTrigger value="enquiries" count={3} countTone="new">
            Enquiries
          </TabsTrigger>
          <TabsTrigger value="saved">Saved</TabsTrigger>
        </TabsList>
        <TabsContent value="listings">Your listings</TabsContent>
        <TabsContent value="enquiries">Your enquiries</TabsContent>
        <TabsContent value="saved">Your saved homes</TabsContent>
      </Tabs>
    );
  }

  it("shows the selected panel and announces the selected tab", () => {
    render(<Example />);
    expect(screen.getByRole("tablist", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Listings" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Your listings")).toBeVisible();
  });

  it("moves between tabs with the arrow keys and switches the panel", async () => {
    const onValueChange = vi.fn();
    render(<Example onValueChange={onValueChange} />);
    await userEvent.tab();
    await userEvent.keyboard("{ArrowRight}");
    expect(screen.getByRole("tab", { name: /Enquiries/ })).toHaveFocus();
    expect(onValueChange).toHaveBeenCalledWith("enquiries");
    expect(screen.getByText("Your enquiries")).toBeVisible();
  });

  it("includes the count in the tab name", () => {
    render(<Example />);
    expect(screen.getByRole("tab", { name: "Enquiries 3" })).toBeInTheDocument();
  });
});

describe("DropdownMenu", () => {
  function Example({ onSettings }: { onSettings?: () => void }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button>Account</Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Workspace</DropdownMenuLabel>
          <DropdownMenuItem
            icon={<Icon icon={Settings} />}
            meta={2}
            metaTone="new"
            onSelect={onSettings}
          >
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem destructive icon={<Icon icon={Trash2} />}>
            Delete account
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  it("opens from the keyboard, lists its items, and runs the chosen one", async () => {
    const onSettings = vi.fn();
    render(<Example onSettings={onSettings} />);
    screen.getByRole("button", { name: "Account" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getAllByRole("menuitem")).toHaveLength(2);
    await userEvent.keyboard("{Enter}");
    expect(onSettings).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape and returns focus to the button", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Account" });
    trigger.focus();
    await userEvent.keyboard("{Enter}");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("shows a count and colours a destructive item", async () => {
    render(<Example />);
    screen.getByRole("button", { name: "Account" }).focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByText("2")).toHaveClass("bg-cta");
    expect(screen.getByRole("menuitem", { name: "Delete account" })).toHaveClass("text-danger");
  });
});

describe("Popover", () => {
  it("opens with a click, moves focus in, and closes with Escape back to the button", async () => {
    render(
      <Popover>
        <PopoverTrigger asChild>
          <Button>Why this price?</Button>
        </PopoverTrigger>
        <PopoverContent>
          <p>Prices come from the owner.</p>
          <Button>Got it</Button>
        </PopoverContent>
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Why this price?" });
    await userEvent.click(trigger);
    expect(screen.getByRole("dialog")).toHaveTextContent("Prices come from the owner.");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});

describe("ConfirmDialog", () => {
  const base = {
    title: "Delete this listing?",
    description: "It will be removed from search at once.",
    confirmLabel: "Delete listing",
    cancelLabel: "Keep listing",
  };

  it("is an alert dialog named by its title and described by its consequence", () => {
    render(<ConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} {...base} />);
    const dialog = screen.getByRole("alertdialog", { name: "Delete this listing?" });
    expect(dialog).toHaveAccessibleDescription("It will be removed from search at once.");
  });

  it("focuses the safe button first when the action is destructive", () => {
    render(<ConfirmDialog open onOpenChange={vi.fn()} onConfirm={vi.fn()} {...base} />);
    expect(screen.getByRole("button", { name: "Keep listing" })).toHaveFocus();
  });

  it("focuses the confirm button first for a plain confirmation", () => {
    render(<ConfirmDialog open tone="info" onOpenChange={vi.fn()} onConfirm={vi.fn()} {...base} />);
    expect(screen.getByRole("button", { name: "Delete listing" })).toHaveFocus();
  });

  it("calls onConfirm, and cancels with Cancel or Escape", async () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<ConfirmDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} {...base} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.keyboard("{Escape}");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("opens from its trigger and closes itself when uncontrolled", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog trigger={<Button>Delete</Button>} onConfirm={onConfirm} {...base} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  });

  it("keeps a confirm in progress from being pressed twice", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmDialog open loading onOpenChange={vi.fn()} onConfirm={onConfirm} {...base} />);
    await userEvent.click(screen.getByRole("button", { name: "Delete listing" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe("Sheet", () => {
  function Example({ side }: { side?: "bottom" | "right" }) {
    const [open, setOpen] = useState(false);
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button>Filters</Button>
        </SheetTrigger>
        <SheetContent
          {...(side ? { side } : {})}
          title="Filters"
          closeLabel="Close filters"
          description="Narrow the homes you see"
          footer={<Button>Show 24 homes</Button>}
        >
          <p>Filter controls</p>
        </SheetContent>
      </Sheet>
    );
  }

  it("opens as a dialog named by its title, with the body and the sticky footer", async () => {
    render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    const dialog = screen.getByRole("dialog", { name: "Filters" });
    expect(dialog).toHaveAccessibleDescription("Narrow the homes you see");
    expect(screen.getByText("Filter controls")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show 24 homes" })).toBeInTheDocument();
  });

  it("closes with the close button and returns focus to the trigger", async () => {
    render(<Example />);
    const trigger = screen.getByRole("button", { name: "Filters" });
    await userEvent.click(trigger);
    await userEvent.click(screen.getByRole("button", { name: "Close filters" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it("closes on Escape", async () => {
    render(<Example side="right" />);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a grabber on the bottom sheet only", async () => {
    const { unmount } = render(<Example />);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog").querySelector("span[aria-hidden]")).toBeInTheDocument();
    unmount();
    render(<Example side="right" />);
    await userEvent.click(screen.getByRole("button", { name: "Filters" }));
    expect(screen.getByRole("dialog").querySelector("span[aria-hidden]")).not.toBeInTheDocument();
  });
});
