// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pictureFile } from "../../../../tests/image-files";
import { renderWithMessages } from "../../../../tests/render-intl";
import en from "@/i18n/messages/en.json";
import type { BuilderProfileActions } from "../builder-profile.client";
import type { LogoStorage } from "../logo-storage";
import type { MyProfileView } from "../view";

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), info: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("@/lib/notify", () => ({ notify: toast }));
// A stand-in for the browser's own decoding and encoding: a picture "weighs" 100,000 bytes times the quality.
vi.mock("@/lib/image-browser", () => ({
  browserImageDeps: {
    decode: async () => ({ width: 100, height: 100, close: () => undefined }),
    encode: async (_picture: unknown, _size: unknown, type: string, quality: number) =>
      new Blob([new Uint8Array(Math.round(quality * 100_000))], { type }),
  },
}));

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

const picture = (type: "image/png" | "image/jpeg" | "image/webp", dataBytes = 2000) =>
  pictureFile(type, dataBytes, "logo");

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

  it("refuses a picture of the wrong type before uploading it", async () => {
    const storage = fakeStorage();
    open(undefined, { storage });
    chooseFile(new File(["<svg/>"], "logo.svg", { type: "image/svg+xml" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.logo.wrongType);
    expect(storage.uploaded).toEqual([]);
  });

  it("refuses a file that says it is a picture but is not one", async () => {
    const storage = fakeStorage();
    open(undefined, { storage });
    chooseFile(new File(["<svg/>"], "logo.png", { type: "image/png" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(words.logo.wrongType);
    expect(storage.uploaded).toEqual([]);
  });

  it("takes the hidden data out of a logo before uploading it", async () => {
    const storage = fakeStorage();
    open(undefined, { storage });
    const withComment = pictureFile("image/jpeg", 2000, "logo.jpg");
    const bytes = new Uint8Array(await withComment.arrayBuffer());
    const secret = new TextEncoder().encode("GPS-SECRET");
    const comment = new Uint8Array([0xff, 0xfe, 0x00, secret.length + 2, ...secret]);
    const marked = new File([bytes.slice(0, 2), comment, bytes.slice(2)], "logo.jpg", {
      type: "image/jpeg",
    });
    chooseFile(marked);
    await waitFor(() => expect(storage.upload).toHaveBeenCalled());
    const sent = vi.mocked(storage.upload).mock.calls[0]?.[1] as File;
    expect(sent.size).toBe(withComment.size);
    expect(new TextDecoder().decode(await sent.arrayBuffer())).not.toContain("GPS-SECRET");
  });

  it("offers to lower the quality of a logo that is still too heavy, and uploads nothing yet", async () => {
    const storage = fakeStorage();
    open(undefined, { storage });
    chooseFile(picture("image/png", 2 * 1048576));
    expect(await screen.findByText(en.imageReduce.offer.title)).toBeVisible();
    expect(screen.getByText(/but it is 2 MB and the limit is 1 MB/)).toBeVisible();
    expect(storage.uploaded).toEqual([]);
  });

  it("lowers the quality when asked, shows the result, and uploads it as a WebP once the person uses it", async () => {
    const storage = fakeStorage();
    const actions = open(undefined, { storage });
    chooseFile(picture("image/png", 2 * 1048576));
    fireEvent.click(await screen.findByRole("button", { name: en.imageReduce.reduce }));
    expect(await screen.findByText(en.imageReduce.ready.title)).toBeVisible();
    expect(storage.uploaded).toEqual([]);
    fireEvent.click(screen.getByRole("button", { name: en.imageReduce.use }));
    await waitFor(() => expect(storage.uploaded).toHaveLength(1));
    expect(storage.uploaded[0]).toMatch(new RegExp(`^${PROFILE.id}/logo-.+\.webp$`));
    expect(screen.queryByText(en.imageReduce.ready.title)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: words.save }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        expect.objectContaining({ logoPath: storage.uploaded[0] }),
      ),
    );
  });

  it("uploads nothing when the person chooses another file instead", async () => {
    const storage = fakeStorage();
    open(undefined, { storage });
    chooseFile(picture("image/jpeg", 2 * 1048576));
    fireEvent.click(await screen.findByRole("button", { name: en.imageReduce.chooseAnother }));
    expect(screen.queryByText(en.imageReduce.offer.title)).toBeNull();
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
