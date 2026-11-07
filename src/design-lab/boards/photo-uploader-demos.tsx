"use client";

import { useRef, useState } from "react";
import { PhotoUploader, type PhotoUploaderPhoto } from "@/components/domain/photo-uploader";
import { SessionEndedAlert } from "@/components/domain/session-ended-alert";
import { inspectImage } from "@/features/media/inspect-image";
import { PhotoUploaderConnected, type PhotoActions } from "@/features/media/photo-uploader.client";
import { PHOTO_MAX_EDGE, PHOTO_MIN_EDGE } from "@/features/media/constants";
import type { ActionResult } from "@/types/action";
import { Specimen } from "../frame";

const NOTHING = () => undefined;
const PICTURES = "/design-lab/listings";

const SAVED: PhotoUploaderPhoto[] = [
  { id: "a", name: "living-room.webp", previewUrl: `${PICTURES}/home-a.svg`, stage: "done" },
  { id: "b", name: "kitchen.webp", previewUrl: `${PICTURES}/home-b.svg`, stage: "done" },
  { id: "c", name: "balcony.webp", previewUrl: `${PICTURES}/home-c.svg`, stage: "done" },
];

const SIX: PhotoUploaderPhoto[] = [
  ...SAVED,
  { id: "d", name: "bedroom-1.webp", previewUrl: `${PICTURES}/home-a.svg`, stage: "done" },
  { id: "e", name: "bedroom-2.webp", previewUrl: `${PICTURES}/home-b.svg`, stage: "done" },
  { id: "f", name: "bathroom.webp", previewUrl: `${PICTURES}/home-c.svg`, stage: "done" },
];

function View({ photos, notice }: { photos: PhotoUploaderPhoto[]; notice?: React.ReactNode }) {
  return (
    <PhotoUploader
      photos={photos}
      max={6}
      onFiles={NOTHING}
      onRemove={NOTHING}
      {...(notice ? { notice } : {})}
      className="w-full"
    />
  );
}

type Stored = { blob: Blob; path: string };

/**
 * A stand-in for the server that runs the REAL checks (`inspectImage`) on the file the real browser step
 * made, so the live specimen shows what would be accepted. It is the only specimen that does anything.
 */
function useStandIn() {
  const stored = useRef(new Map<string, Stored>());
  const saved = useRef(0);
  const [last, setLast] = useState("");

  const actions: PhotoActions = {
    requestUpload: async ({
      mime,
    }): Promise<ActionResult<{ bucket: string; path: string; token: string }>> => {
      const path = `demo/${crypto.randomUUID()}.${mime === "image/webp" ? "webp" : mime === "image/png" ? "png" : "jpg"}`;
      return { ok: true, data: { bucket: "listing-photos", path, token: "demo-token" } };
    },
    finalize: async ({ path }) => {
      const found = stored.current.get(path);
      if (!found) return { ok: false, code: "NOT_FOUND" };
      const inspected = inspectImage(new Uint8Array(await found.blob.arrayBuffer()));
      const refuse = (key: string): ActionResult<never> => ({
        ok: false,
        code: "VALIDATION",
        fieldErrors: { photo: [{ key }] },
      });
      if (!inspected.ok) {
        setLast(`refused: ${inspected.reason}`);
        return refuse(
          inspected.reason === "metadata" ? "validation.photoNotPrepared" : "validation.photoType",
        );
      }
      const longest = Math.max(inspected.width, inspected.height);
      const shortest = Math.min(inspected.width, inspected.height);
      if (shortest < PHOTO_MIN_EDGE || longest > PHOTO_MAX_EDGE) {
        setLast("refused: size");
        return refuse("validation.photoDimensions");
      }
      saved.current += 1;
      setLast(`accepted: ${inspected.mime} ${inspected.width}x${inspected.height}, no camera data`);
      return { ok: true, data: { photoId: `demo-${saved.current}`, path, shortId: "demo0000" } };
    },
    remove: async () => ({ ok: true, data: { shortId: "demo0000" } }),
  };

  const upload = async (target: { path: string }, blob: Blob) => {
    stored.current.set(target.path, { blob, path: target.path });
    return { ok: true };
  };

  return { actions, upload, last };
}

/**
 * The photo step of posting a property (S6-T01): empty, photos saved with the first as the cover, one photo
 * at each step, refusals, full, and a notice. The last specimen is live: choose a photo and the browser makes it
 * smaller and strips its camera data, then the same checks the server runs are run on the result. Nothing is
 * uploaded anywhere. The words are not approved yet.
 */
export function PhotoUploaderDemo() {
  const { actions, upload, last } = useStandIn();
  return (
    <div className="flex flex-col gap-14">
      <Specimen label="Empty: no photos yet" className="w-full max-w-xl">
        <View photos={[]} />
      </Specimen>
      <Specimen
        label="Three photos saved: the first one is the cover; each has a small picture and a remove button"
        className="w-full max-w-xl"
      >
        <View photos={SAVED} />
      </Specimen>
      <Specimen
        label="Photos on their way: preparing, uploading and saving, one each, after a saved cover"
        className="w-full max-w-xl"
      >
        <View
          photos={[
            SAVED[0] as PhotoUploaderPhoto,
            { id: "p", name: "hall.jpg", stage: "preparing" },
            {
              id: "u",
              name: "bedroom.jpg",
              previewUrl: `${PICTURES}/home-b.svg`,
              stage: "uploading",
            },
            { id: "s", name: "terrace.jpg", previewUrl: `${PICTURES}/home-c.svg`, stage: "saving" },
            {
              id: "r",
              name: "old-kitchen.webp",
              previewUrl: `${PICTURES}/home-a.svg`,
              stage: "removing",
            },
          ]}
        />
      </Specimen>
      <Specimen
        label="Refused photos stay in the list with the reason: not a photo, too large, cannot be read, could not upload, limit reached"
        className="w-full max-w-xl"
      >
        <View
          photos={[
            SAVED[0] as PhotoUploaderPhoto,
            { id: "e1", name: "brochure.pdf", stage: "error", error: "This file is not a photo." },
            {
              id: "e2",
              name: "panorama.jpg",
              stage: "error",
              error: "This photo is larger than 20 MB.",
            },
            {
              id: "e3",
              name: "IMG_2041.heic",
              stage: "error",
              error: "This photo cannot be read here. Use a JPEG, PNG or WebP photo.",
            },
            {
              id: "e4",
              name: "garden.jpg",
              stage: "error",
              error: "We couldn't upload this photo. Remove it and try again.",
            },
            { id: "e5", name: "pool.jpg", stage: "error", error: "You can add up to 6 photos." },
          ]}
        />
      </Specimen>
      <Specimen
        label="Full: six photos, the drop area is turned off and the count says so"
        className="w-full max-w-xl"
      >
        <View photos={SIX} />
      </Specimen>
      <Specimen
        label="The session ended while photos were being added: the warning sits above the list"
        className="w-full max-w-xl"
      >
        <View
          photos={[
            SAVED[0] as PhotoUploaderPhoto,
            { id: "x", name: "hall.jpg", stage: "error", error: "Your session has ended." },
          ]}
          notice={<SessionEndedAlert href="#" />}
        />
      </Specimen>
      <Specimen
        label="Live: choose a photo. This browser makes it smaller and removes its camera data, then the server's checks run on it. Nothing is uploaded."
        className="w-full max-w-xl"
      >
        <div className="w-full">
          <PhotoUploaderConnected
            listingId="00000000-0000-4000-9000-000000000001"
            actions={actions}
            upload={upload}
            returnPath="/post-property"
            className="w-full"
          />
          <p data-testid="photo-demo-result" className="mt-3 text-caption text-muted">
            {last}
          </p>
        </div>
      </Specimen>
    </div>
  );
}
