// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { BuilderProfileActions } from "../builder-profile.client";
import type { LogoStorage } from "../logo-storage";
import type { MyProfileView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));

const { BuilderProfile } = await import("../builder-profile.client");

const words = en.builderPortal.profile;

const PROFILE: MyProfileView = {
  id: "00000000-0000-4000-b000-000000000001",
  name: "Kadal Homes",
  email: "sales@kadalhomes.example",
  kind: "builder",
  contactPerson: "Rajesh K",
  phone: "+919000022222",
  logoUrl: null,
  website: "https://kadalhomes.example",
  description: "Mid-rise apartment communities along the OMR corridor.",
  tagline: null,
  establishedYear: null,
  projectsDelivered: null,
  logoPath: null,
  liveProjects: 4,
};

function fakeStorage(kept = true): LogoStorage & { uploaded: string[]; removed: string[] } {
  const uploaded: string[] = [];
  const removed: string[] = [];
  return {
    uploaded,
    removed,
    upload: vi.fn(async (path: string) => {
      uploaded.push(path);
      return kept;
    }),
    remove: vi.fn(async (paths: readonly string[]) => {
      removed.push(...paths);
    }),
  };
}

function open(
  save?: BuilderProfileActions["save"],
  options: { profile?: MyProfileView; storage?: LogoStorage } = {},
) {
  const actions: BuilderProfileActions = {
    save: save ?? vi.fn(async () => ({ ok: true as const, data: { builderId: PROFILE.id } })),
  };
  renderWithMessages(
    <BuilderProfile
      profile={options.profile ?? PROFILE}
      actions={actions}
      logoStorage={options.storage ?? fakeStorage()}
    />,
  );
  return actions;
}

const picture = (type: string, size = 2000) => {
  const file = new File(["x"], "logo", { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const chooseFile = (file: File) => {
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) throw new Error("no file input");
  fireEvent.change(input, { target: { files: [file] } });
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BuilderProfile: the builder's Company profile page (S7-T03)", () => {
  it("shows the heading, the details on record, and the login email that cannot be changed", () => {
    open();
    expect(screen.getByRole("heading", { level: 1, name: words.title })).toBeVisible();
    expect(screen.getByLabelText(/^Company name/)).toHaveValue("Kadal Homes");
    expect(screen.getByLabelText(/^Contact person/)).toHaveValue("Rajesh K");
    const email = screen.getByLabelText(/^Login email/);
    expect(email).toHaveValue("sales@kadalhomes.example");
    expect(email).toHaveAttribute("readonly");
    expect(screen.getByText(words.emailLockedHint)).toBeVisible();
    expect(screen.getByText(words.note)).toBeVisible();
    expect(screen.queryByLabelText(/^Type/)).toBeNull();
  });

  it("shows the card buyers see, with the number of live projects, and follows what is typed", () => {
    open();
    const preview = screen.getByRole("region", { name: words.preview.label });
    expect(preview).toHaveTextContent("Kadal Homes");
    expect(preview).toHaveTextContent("4 projects");
    expect(preview).toHaveTextContent("Mid-rise apartment communities");
    fireEvent.change(screen.getByLabelText(/^Company name/), { target: { value: "Kadal Group" } });
    expect(preview).toHaveTextContent("Kadal Group");
    expect(screen.getByText(words.preview.note)).toBeVisible();
  });

  it("saves the boxes as typed, without the email or the type, and says so", async () => {
    const actions = open();
    fireEvent.change(screen.getByLabelText(/^Phone/), { target: { value: "+919841055512" } });
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith({
        name: "Kadal Homes",
        contactPerson: "Rajesh K",
        phone: "+919841055512",
        logoUrl: "",
        website: "https://kadalhomes.example",
        description: "Mid-rise apartment communities along the OMR corridor.",
        tagline: "",
        establishedYear: "",
        projectsDelivered: "",
        logoPath: "",
      }),
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith(words.toast.title));
    expect(router.refresh).toHaveBeenCalled();
  });

  it("puts a refusal on its box and does not say the profile was saved", async () => {
    open(
      vi.fn(async () => ({
        ok: false as const,
        code: "VALIDATION" as const,
        message: "Check the form",
        fieldErrors: { name: [{ key: "validation.nameTooShort" }] },
      })),
    );
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() =>
      expect(screen.getByLabelText(/^Company name/)).toHaveAttribute("aria-invalid", "true"),
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("says a failure with no box to blame in words, and reads the page again", async () => {
    open(
      vi.fn(async () => ({
        ok: false as const,
        code: "NOT_FOUND" as const,
        message: "The builder was not found",
      })),
    );
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(toast.success).not.toHaveBeenCalled();
    expect(router.refresh).toHaveBeenCalled();
  });
});

describe("BuilderProfile: the Developer Spotlight fields and the logo (ADR-179)", () => {
  it("asks for a tagline, the year started and the projects delivered, and no logo link", () => {
    open();
    expect(screen.getByLabelText(/^Tagline/)).toHaveValue("");
    expect(screen.getByLabelText(/^Year started/)).toHaveValue("");
    expect(screen.getByLabelText(/^Projects delivered/)).toHaveValue("");
    expect(screen.queryByLabelText(/^Logo link/)).toBeNull();
    expect(screen.getByRole("button", { name: words.logo.choose })).toBeVisible();
  });

  it("uploads a chosen logo to the builder's own folder and saves its path", async () => {
    const storage = fakeStorage();
    const actions = open(undefined, { storage });
    chooseFile(picture("image/png"));
    await waitFor(() => expect(screen.getByRole("img", { name: words.logo.alt })).toBeVisible());
    expect(storage.uploaded).toHaveLength(1);
    expect(storage.uploaded[0]).toMatch(new RegExp(`^${PROFILE.id}/logo-.+\.png$`));
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        expect.objectContaining({ logoPath: storage.uploaded[0] }),
      ),
    );
  });

  it("refuses a picture of the wrong type or too heavy before uploading it", async () => {
    const storage = fakeStorage();
    open(undefined, { storage });
    chooseFile(picture("image/svg+xml"));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.logo.wrongType);
    chooseFile(picture("image/webp", 2 * 1048576));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.logo.tooHeavy);
    expect(storage.uploaded).toEqual([]);
  });

  it("says so when the upload fails, and keeps no logo", async () => {
    open(undefined, { storage: fakeStorage(false) });
    chooseFile(picture("image/jpeg"));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.logo.failed);
    expect(screen.queryByRole("img", { name: words.logo.alt })).toBeNull();
  });

  it("removes the old logo from the bucket after a save that replaced it", async () => {
    const storage = fakeStorage();
    const old = `${PROFILE.id}/logo-old.webp`;
    open(undefined, { storage, profile: { ...PROFILE, logoPath: old } });
    fireEvent.click(screen.getByRole("button", { name: words.logo.remove }));
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() => expect(storage.removed).toEqual([old]));
  });

  it("takes away a logo uploaded and then replaced before saving", async () => {
    const storage = fakeStorage();
    open(undefined, { storage });
    chooseFile(picture("image/png"));
    await waitFor(() => expect(storage.uploaded).toHaveLength(1));
    await screen.findByRole("img", { name: words.logo.alt });
    chooseFile(picture("image/png"));
    await waitFor(() => expect(storage.uploaded).toHaveLength(2));
    await waitFor(() => expect(storage.removed).toEqual([storage.uploaded[0]]));
  });
});
