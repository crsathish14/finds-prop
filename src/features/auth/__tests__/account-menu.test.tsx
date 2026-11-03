// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Heart } from "lucide-react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Icon } from "@/components/ui/icon";
import { notify } from "@/lib/notify";
import { AccountMenu, type AccountMenuProps } from "../account-menu.client";
import { SignOutButton } from "../sign-out-button.client";
import { useSignOut } from "../use-sign-out.client";

// Signing out reaches the server; the tests stand in for the hook and for the toast area.
vi.mock("../use-sign-out.client", () => ({ useSignOut: vi.fn() }));
vi.mock("@/lib/notify", () => ({ notify: { error: vi.fn() } }));

const signOut = vi.fn();
const hook = vi.mocked(useSignOut);

function signOutState(state: { failed?: boolean; pending?: boolean } = {}) {
  hook.mockReturnValue({ signOut, failed: state.failed ?? false, pending: state.pending ?? false });
}

const props: AccountMenuProps = {
  triggerLabel: "Account menu",
  name: "Priya Raman",
  email: "priya@example.com",
  initials: "PR",
  groups: [
    {
      label: "Dashboard",
      entries: [
        { label: "Saved homes", href: "/dashboard?tab=saved", icon: <Icon icon={Heart} /> },
      ],
    },
  ],
  signOut: { label: "Sign out", failedText: "We could not sign you out.", destination: "/" },
};

beforeEach(() => {
  vi.clearAllMocks();
  signOutState();
});

describe("AccountMenu: the header's account menu with Sign out (S3-T09, ADD-05/06)", () => {
  it("lists the account links and ends with a Sign out entry", async () => {
    render(<AccountMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByText("Dashboard")).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: /Saved homes/ })).toHaveAttribute(
      "href",
      "/dashboard?tab=saved",
    );
    const items = within(menu).getAllByRole("menuitem");
    expect(items.at(-1)).toHaveTextContent("Sign out");
  });

  it("asks to sign out when the entry is chosen", async () => {
    render(<AccountMenu {...props} />);
    await userEvent.click(screen.getByRole("button", { name: "Account menu" }));
    await userEvent.click(screen.getByRole("menuitem", { name: /Sign out/ }));
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("signs out towards the page it was given, so staff land on their own sign-in", () => {
    render(
      <AccountMenu {...props} signOut={{ ...props.signOut, destination: "/builder/login" }} />,
    );
    expect(hook).toHaveBeenCalledWith("/builder/login");
  });

  it("tells the person when the session could not be ended", () => {
    signOutState({ failed: true });
    render(<AccountMenu {...props} />);
    expect(notify.error).toHaveBeenCalledWith("We could not sign you out.");
  });

  it("says nothing while signing out has not failed", () => {
    render(<AccountMenu {...props} />);
    expect(notify.error).not.toHaveBeenCalled();
  });
});

describe("SignOutButton: Sign out in the menu drawer", () => {
  const buttonProps = {
    label: "Sign out",
    failedText: "We could not sign you out.",
    destination: "/",
  };

  it("signs out when pressed", async () => {
    render(<SignOutButton {...buttonProps} />);
    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(hook).toHaveBeenCalledWith("/");
  });

  it("shows it is busy while the server is working", () => {
    signOutState({ pending: true });
    render(<SignOutButton {...buttonProps} />);
    expect(screen.getByRole("button", { name: /Sign out/ })).toHaveAttribute("aria-busy", "true");
  });

  it("tells the person when the session could not be ended", () => {
    signOutState({ failed: true });
    render(<SignOutButton {...buttonProps} />);
    expect(notify.error).toHaveBeenCalledWith("We could not sign you out.");
  });
});
