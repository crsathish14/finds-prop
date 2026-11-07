"use client";

import { useTranslations } from "next-intl";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { PhotoUploader } from "@/components/domain/photo-uploader";
import { SessionEndedAlert } from "@/components/domain/session-ended-alert";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { isSessionEnded, sessionEndedHref } from "@/lib/session-ended";
import type { ActionFailure, ActionResult } from "@/types/action";
import { browserImage } from "./browser-image";
import { PHOTO_MAX_COUNT, type PhotoMime } from "./constants";
import { photoListReducer, photosInUse, type PhotoItem } from "./photo-list";
import {
  ORIGINAL_MAX_MEGABYTES,
  PrepareError,
  preparePhoto,
  type PreparedPhoto,
} from "./prepare-photo";
import { uploadToTarget, type UploadTarget } from "./upload-to-target";

/** The three photo actions, as the page hands them over (a server action cannot be imported here). */
export type PhotoActions = {
  requestUpload: (input: {
    listingId: string;
    mime: PhotoMime;
    bytes: number;
  }) => Promise<ActionResult<UploadTarget>>;
  finalize: (input: {
    listingId: string;
    path: string;
  }) => Promise<ActionResult<{ photoId: string; path: string; shortId: string }>>;
  remove: (input: {
    listingId: string;
    photoId: string;
  }) => Promise<ActionResult<{ shortId: string }>>;
};

/** A photo the listing already has, as the page reads it: its id, a picture of it and what to call it. */
export type SavedPhoto = { id: string; name: string; previewUrl: string };

export type PhotoUploaderStatus = {
  /** Photos that count toward the limit now. */
  count: number;
  /** Something is still being prepared, uploaded, saved or removed. */
  busy: boolean;
};

type PhotoUploaderConnectedProps = {
  listingId: string;
  /** The photos the listing already has, in order (the first is the cover). */
  saved?: SavedPhoto[];
  actions: PhotoActions;
  /** The page the uploader is on, for "Sign in again" to come back to. */
  returnPath: string;
  max?: number;
  /** Swapped in by tests and the Design Lab; the real ones run in the browser. */
  prepare?: (file: File) => Promise<PreparedPhoto>;
  upload?: (target: UploadTarget, file: Blob) => Promise<{ ok: boolean }>;
  /** Told whenever the count or the busy state changes (the wizard holds Next while busy). */
  onStatus?: (status: PhotoUploaderStatus) => void;
  className?: string;
};

const realPrepare = (file: File) => preparePhoto(file, browserImage);

let counter = 0;
const madeUpId = () => {
  counter += 1;
  return `upload-${Date.now().toString(36)}-${counter}`;
};

/**
 * The photo step with the whole sequence behind it (S6-T01): each chosen file is prepared in this browser
 * (made smaller, camera data left behind), the server issues a one-time address, the file is sent to it,
 * and the server reads it back and records it. Files go one after another, so the order is the order they
 * were chosen and the server's limit is never raced. A failure stays on its own row, with the reason,
 * and the rest carry on.
 */
export function PhotoUploaderConnected({
  listingId,
  saved = [],
  actions,
  returnPath,
  max = PHOTO_MAX_COUNT,
  prepare = realPrepare,
  upload = uploadToTarget,
  onStatus,
  className,
}: PhotoUploaderConnectedProps) {
  const translate = useTranslations("domain.photoUploader");
  const translateAll = useTranslations() as unknown as Translator;
  const [items, dispatch] = useReducer(photoListReducer, saved, (start): PhotoItem[] =>
    start.map((photo) => ({
      id: photo.id,
      name: photo.name,
      previewUrl: photo.previewUrl,
      stage: "done",
      photoId: photo.id,
    })),
  );
  const [sessionEnded, setSessionEnded] = useState(false);
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  });
  const queue = useRef<Promise<void>>(Promise.resolve());
  const cancelled = useRef(new Set<string>());
  const pictures = useRef(new Set<string>());

  // Pictures made in this browser are freed when the uploader goes away.
  useEffect(() => {
    const made = pictures.current;
    return () => {
      for (const url of made) URL.revokeObjectURL(url);
    };
  }, []);

  useEffect(() => {
    if (!onStatus) return;
    const busy = items.some((item) => !["done", "error"].includes(item.stage));
    onStatus({ count: photosInUse(items), busy });
  }, [items, onStatus]);

  /** The words for a refused action: the first field problem if there is one, else the general text. */
  const refusal = useCallback(
    (failure: ActionFailure): string => {
      if (isSessionEnded(failure)) setSessionEnded(true);
      const field = failure.fieldErrors?.["photo"]?.[0];
      return field ? fieldErrorText(translateAll, field) : failureText(translateAll, failure);
    },
    [translateAll],
  );

  const prepareProblem = useCallback(
    (error: unknown): string => {
      if (error instanceof PrepareError) {
        if (error.problem === "not_image") return translate("errors.notImage");
        if (error.problem === "too_large") {
          return translate("errors.tooLarge", { maximum: ORIGINAL_MAX_MEGABYTES });
        }
        return translate("errors.unreadable");
      }
      return translate("errors.uploadFailed");
    },
    [translate],
  );

  const run = useCallback(
    async (id: string, file: File) => {
      const fail = (text: string) => dispatch({ type: "failed", id, error: text });
      try {
        const prepared = await prepare(file);
        if (cancelled.current.has(id)) return dispatch({ type: "removed", id });
        const picture = URL.createObjectURL(prepared.blob);
        pictures.current.add(picture);
        dispatch({ type: "preview", id, previewUrl: picture });
        dispatch({ type: "stage", id, stage: "uploading" });

        const asked = await actions.requestUpload({
          listingId,
          mime: prepared.mime,
          bytes: prepared.bytes,
        });
        if (!asked.ok) return fail(refusal(asked));
        if (cancelled.current.has(id)) return dispatch({ type: "removed", id });

        const sent = await upload(asked.data, prepared.blob);
        if (!sent.ok) return fail(translate("errors.uploadFailed"));

        dispatch({ type: "stage", id, stage: "saving" });
        const done = await actions.finalize({ listingId, path: asked.data.path });
        if (!done.ok) return fail(refusal(done));
        if (cancelled.current.has(id)) {
          // Removed while it was being saved: take it off again now that it has a row.
          await actions.remove({ listingId, photoId: done.data.photoId });
          return dispatch({ type: "removed", id });
        }
        dispatch({ type: "saved", id, photoId: done.data.photoId });
      } catch (error) {
        fail(prepareProblem(error));
      }
    },
    [actions, listingId, prepare, prepareProblem, refusal, translate, upload],
  );

  const onFiles = useCallback(
    (chosen: File[]) => {
      const room = Math.max(0, max - photosInUse(itemsRef.current));
      const taking = chosen.slice(0, room);
      const over = chosen.slice(room);
      const added: PhotoItem[] = taking.map((file) => ({
        id: madeUpId(),
        name: file.name,
        stage: "preparing",
      }));
      const turnedAway: PhotoItem[] = over.map((file) => ({
        id: madeUpId(),
        name: file.name,
        stage: "error",
        error: fieldErrorText(translateAll, {
          key: "validation.photoLimit",
          values: { maximum: max },
        }),
      }));
      if (added.length + turnedAway.length === 0) return;
      dispatch({ type: "add", items: [...added, ...turnedAway] });
      taking.forEach((file, index) => {
        const item = added[index];
        if (!item) return;
        queue.current = queue.current.then(() => run(item.id, file));
      });
    },
    [max, run, translateAll],
  );

  const onRemove = useCallback(
    async (id: string) => {
      const item = itemsRef.current.find((candidate) => candidate.id === id);
      if (!item) return;
      if (item.stage === "error") {
        dispatch({ type: "removed", id });
        return;
      }
      if (item.photoId) {
        dispatch({ type: "stage", id, stage: "removing" });
        const result = await actions.remove({ listingId, photoId: item.photoId });
        if (result.ok) dispatch({ type: "removed", id });
        else {
          refusal(result); // notes an ended session; the row says it could not be removed
          dispatch({ type: "kept", id, error: translate("errors.removeFailed") });
        }
        return;
      }
      // Still on its way: stop it where it is. If it is already being saved, the run takes it off again.
      cancelled.current.add(id);
      dispatch({ type: "removed", id });
    },
    [actions, listingId, refusal, translate],
  );

  return (
    <PhotoUploader
      photos={items}
      max={max}
      onFiles={onFiles}
      onRemove={(id) => void onRemove(id)}
      {...(sessionEnded
        ? { notice: <SessionEndedAlert href={sessionEndedHref(returnPath)} /> }
        : {})}
      {...(className ? { className } : {})}
    />
  );
}
