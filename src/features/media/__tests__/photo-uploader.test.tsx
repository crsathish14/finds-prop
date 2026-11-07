// @vitest-environment jsdom
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/i18n/messages/en.json";
import type { ActionResult } from "@/types/action";
import { renderWithMessages } from "../../../../tests/render-intl";
import { PhotoUploaderConnected, type PhotoActions } from "../photo-uploader.client";
import { PrepareError, type PreparedPhoto } from "../prepare-photo";

const words = messages.domain.photoUploader;
const LISTING = "00000000-0000-4000-9000-000000000001";
const PATH =
  "00000000-0000-4000-8000-0000000000a1/00000000-0000-4000-9000-000000000001/00000000-0000-4000-8000-0000000000f1.webp";

beforeEach(() => {
  let count = 0;
  URL.createObjectURL = vi.fn(() => `blob:picture-${(count += 1)}`);
  URL.revokeObjectURL = vi.fn();
});

const prepared = (): PreparedPhoto => ({
  blob: new Blob(["picture"], { type: "image/webp" }),
  mime: "image/webp",
  width: 1600,
  height: 1200,
  bytes: 7,
});

type Request = PhotoActions["requestUpload"];
type Finalize = PhotoActions["finalize"];
type Remove = PhotoActions["remove"];

function goodActions() {
  return {
    requestUpload: vi.fn<Request>(async () => ({
      ok: true,
      data: { bucket: "listing-photos", path: PATH, token: "token-for-tests" },
    })),
    finalize: vi.fn<Finalize>(async () => ({
      ok: true,
      data: { photoId: "photo-1", path: PATH, shortId: "abcd2345" },
    })),
    remove: vi.fn<Remove>(async () => ({ ok: true, data: { shortId: "abcd2345" } })),
  };
}

const refused = (overrides: Record<string, unknown> = {}) =>
  ({ ok: false, code: "INTERNAL", ...overrides }) as ActionResult<never>;

type Status = { count: number; busy: boolean };

function show(
  options: {
    actions?: PhotoActions;
    prepare?: (file: File) => Promise<PreparedPhoto>;
    upload?: (target: unknown, blob: Blob) => Promise<{ ok: boolean }>;
    saved?: { id: string; name: string; previewUrl: string }[];
    onStatus?: (status: Status) => void;
  } = {},
) {
  const actions = options.actions ?? goodActions();
  const prepare = options.prepare ?? vi.fn(async () => prepared());
  const upload = options.upload ?? vi.fn(async () => ({ ok: true }));
  const view = renderWithMessages(
    <PhotoUploaderConnected
      listingId={LISTING}
      actions={actions}
      returnPath="/post-property/abc"
      prepare={prepare}
      upload={upload}
      {...(options.saved ? { saved: options.saved } : {})}
      {...(options.onStatus ? { onStatus: options.onStatus } : {})}
    />,
  );
  return { actions, prepare, upload, unmount: view.unmount };
}

const chooser = () => screen.getByLabelText(new RegExp(words.title));
const picture = (name = "hall.jpg") => new File(["raw"], name, { type: "image/jpeg" });
const row = (name: string) => screen.getByText(name).closest("li") as HTMLElement;
const saved = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `s${index + 1}`,
    name: `Photo ${index + 1}`,
    previewUrl: "/design-lab/listings/home-a.svg",
  }));

describe("PhotoUploaderConnected: from a chosen file to a saved photo (S6-T01)", () => {
  it("prepares, asks for an address, uploads, saves, and shows the photo as the cover", async () => {
    const { actions, upload, prepare } = show();
    await userEvent.upload(chooser(), picture());

    await waitFor(() => expect(within(row("hall.jpg")).getByText(words.cover)).toBeVisible());
    expect(prepare).toHaveBeenCalledTimes(1);
    expect(actions.requestUpload).toHaveBeenCalledWith({
      listingId: LISTING,
      mime: "image/webp",
      bytes: 7,
    });
    expect(upload).toHaveBeenCalledWith(
      { bucket: "listing-photos", path: PATH, token: "token-for-tests" },
      expect.any(Blob),
    );
    expect(actions.finalize).toHaveBeenCalledWith({ listingId: LISTING, path: PATH });
    expect(screen.getByRole("status")).toHaveTextContent("1 of 6 photos");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
  });

  it("shows the prepared picture from this browser, and frees it when the page goes away", async () => {
    const { unmount } = show();
    await userEvent.upload(chooser(), picture());
    await waitFor(() => expect(row("hall.jpg").querySelector("img")).not.toBeNull());
    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:picture-1");
  });

  it("does the files one after another, in the order they were chosen", async () => {
    const order: string[] = [];
    const actions = goodActions();
    actions.requestUpload.mockImplementation(async () => {
      order.push("request");
      return { ok: true, data: { bucket: "listing-photos", path: PATH, token: "t" } };
    });
    actions.finalize.mockImplementation(async () => {
      order.push("finalize");
      return { ok: true, data: { photoId: `p-${order.length}`, path: PATH, shortId: "abcd2345" } };
    });
    show({ actions });
    await userEvent.upload(chooser(), [picture("one.jpg"), picture("two.jpg")]);
    await waitFor(() => expect(order).toHaveLength(4));
    expect(order).toEqual(["request", "finalize", "request", "finalize"]);
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    expect(screen.getAllByText(words.cover)).toHaveLength(1);
    expect(within(row("one.jpg")).getByText(words.cover)).toBeVisible();
  });

  it("starts from the photos the listing already has, the first as the cover", () => {
    show({ saved: saved(2) });
    expect(within(row("Photo 1")).getByText(words.cover)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("2 of 6 photos");
  });

  it.each([
    ["not_image", words.errors.notImage],
    ["too_large", "This photo is larger than 20 MB."],
    ["unreadable", words.errors.unreadable],
  ] as const)("says why a file cannot be prepared (%s), on its own row", async (problem, text) => {
    const { actions } = show({
      prepare: vi.fn(async () => {
        throw new PrepareError(problem);
      }),
    });
    await userEvent.upload(chooser(), picture("holiday.jpg"));
    expect(await screen.findByText(text)).toBeVisible();
    expect(actions.requestUpload).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 6 photos");
  });

  it("shows the server's reason for a refusal, from its message key", async () => {
    const actions = goodActions();
    actions.requestUpload.mockResolvedValue(
      refused({
        code: "VALIDATION",
        fieldErrors: { photo: [{ key: "validation.photoLimit", values: { maximum: 6 } }] },
      }),
    );
    const { upload } = show({ actions });
    await userEvent.upload(chooser(), picture());
    expect(await screen.findByText("You can add up to 6 photos.")).toBeVisible();
    expect(upload).not.toHaveBeenCalled();
  });

  it("shows the server's reason when it refuses the file after reading it", async () => {
    const actions = goodActions();
    actions.finalize.mockResolvedValue(
      refused({
        code: "VALIDATION",
        fieldErrors: { photo: [{ key: "validation.photoNotPrepared" }] },
      }),
    );
    show({ actions });
    await userEvent.upload(chooser(), picture());
    expect(await screen.findByText(messages.validation.photoNotPrepared)).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("0 of 6 photos");
  });

  it("says a rate limit in words when the server asks to wait", async () => {
    const actions = goodActions();
    actions.requestUpload.mockResolvedValue(refused({ code: "RATE_LIMITED", retryAfter: 1800 }));
    show({ actions });
    await userEvent.upload(chooser(), picture());
    expect(await screen.findByText(/30 minutes/)).toBeVisible();
  });

  it("says the upload failed, and does not ask the server to save, when the file cannot be sent", async () => {
    const { actions } = show({ upload: vi.fn(async () => ({ ok: false })) });
    await userEvent.upload(chooser(), picture());
    expect(await screen.findByText(words.errors.uploadFailed)).toBeVisible();
    expect(actions.finalize).not.toHaveBeenCalled();
  });

  it("keeps going with the next file after one fails", async () => {
    const prepare = vi
      .fn<(file: File) => Promise<PreparedPhoto>>()
      .mockRejectedValueOnce(new PrepareError("unreadable"))
      .mockResolvedValue(prepared());
    show({ prepare });
    await userEvent.upload(chooser(), [picture("bad.heic"), picture("good.jpg")]);
    expect(await screen.findByText(words.errors.unreadable)).toBeVisible();
    await waitFor(() => expect(within(row("good.jpg")).getByText(words.cover)).toBeVisible());
  });

  it("offers Sign in again, back to this page, when the session has ended", async () => {
    const actions = goodActions();
    actions.requestUpload.mockResolvedValue(refused({ code: "UNAUTHENTICATED" }));
    show({ actions });
    await userEvent.upload(chooser(), picture());
    const link = await screen.findByRole("link", { name: messages.domain.sessionEnded.action });
    expect(link).toHaveAttribute("href", "/auth?gate=expired&redirect=%2Fpost-property%2Fabc");
  });

  it("takes only as many files as there is room for and turns the rest away with the limit message", async () => {
    const { prepare } = show({ saved: saved(5) });
    await userEvent.upload(chooser(), [
      picture("one.jpg"),
      picture("two.jpg"),
      picture("three.jpg"),
    ]);
    await waitFor(() => expect(screen.getAllByText("You can add up to 6 photos.")).toHaveLength(2));
    expect(prepare).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("6 of 6 photos"));
    expect(chooser()).toBeDisabled();
  });
});

describe("PhotoUploaderConnected: removing photos", () => {
  it("takes a saved photo off through the server, then out of the list", async () => {
    const { actions } = show({ saved: saved(2) });
    await userEvent.click(screen.getByRole("button", { name: "Remove Photo 1" }));
    await waitFor(() => expect(screen.queryByText("Photo 1")).not.toBeInTheDocument());
    expect(actions.remove).toHaveBeenCalledWith({ listingId: LISTING, photoId: "s1" });
    expect(screen.getByRole("status")).toHaveTextContent("1 of 6 photos");
  });

  it("keeps the photo, with a reason, when the server could not remove it", async () => {
    const actions = goodActions();
    actions.remove.mockResolvedValue(refused());
    show({ actions, saved: saved(2) });
    await userEvent.click(screen.getByRole("button", { name: "Remove Photo 2" }));
    expect(await screen.findByText(words.errors.removeFailed)).toBeVisible();
    expect(screen.getByText("Photo 2")).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent("2 of 6 photos");
  });

  it("removes a refused photo from the list without calling the server", async () => {
    const { actions } = show({
      prepare: vi.fn(async () => {
        throw new PrepareError("unreadable");
      }),
    });
    await userEvent.upload(chooser(), picture("bad.heic"));
    await screen.findByText(words.errors.unreadable);
    await userEvent.click(screen.getByRole("button", { name: "Remove bad.heic" }));
    expect(screen.queryByText("bad.heic")).not.toBeInTheDocument();
    expect(actions.remove).not.toHaveBeenCalled();
  });

  it("stops a photo that is removed while it is still being prepared: nothing is asked of the server", async () => {
    let finish: (value: PreparedPhoto) => void = () => undefined;
    const prepare = vi.fn(() => new Promise<PreparedPhoto>((resolve) => (finish = resolve)));
    const { actions } = show({ prepare });
    await userEvent.upload(chooser(), picture());
    await userEvent.click(await screen.findByRole("button", { name: "Remove hall.jpg" }));
    expect(screen.queryByText("hall.jpg")).not.toBeInTheDocument();
    finish(prepared());
    await waitFor(() => expect(prepare).toHaveBeenCalled());
    expect(actions.requestUpload).not.toHaveBeenCalled();
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });

  it("takes a photo off again if it is removed while the server is saving it", async () => {
    let saveIt: () => void = () => undefined;
    const actions = goodActions();
    actions.finalize.mockImplementation(
      () =>
        new Promise((resolve) => {
          saveIt = () =>
            resolve({ ok: true, data: { photoId: "photo-9", path: PATH, shortId: "abcd2345" } });
        }),
    );
    show({ actions });
    await userEvent.upload(chooser(), picture());
    await waitFor(() => expect(actions.finalize).toHaveBeenCalled());
    await userEvent.click(screen.getByRole("button", { name: "Remove hall.jpg" }));
    saveIt();
    await waitFor(() =>
      expect(actions.remove).toHaveBeenCalledWith({ listingId: LISTING, photoId: "photo-9" }),
    );
    expect(screen.queryByText("hall.jpg")).not.toBeInTheDocument();
  });
});

describe("PhotoUploaderConnected: telling the page what is going on", () => {
  it("reports the count, and that it is busy while a photo is on its way", async () => {
    const seen: Status[] = [];
    let finish: (value: PreparedPhoto) => void = () => undefined;
    show({
      prepare: () => new Promise<PreparedPhoto>((resolve) => (finish = resolve)),
      onStatus: (status) => seen.push(status),
    });
    expect(seen.at(-1)).toEqual({ count: 0, busy: false });
    await userEvent.upload(chooser(), picture());
    await waitFor(() => expect(seen.at(-1)).toEqual({ count: 1, busy: true }));
    finish(prepared());
    await waitFor(() => expect(seen.at(-1)).toEqual({ count: 1, busy: false }));
  });
});
