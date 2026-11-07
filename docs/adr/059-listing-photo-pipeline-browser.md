# ADR-059 · The listing photo pipeline, browser side (S6-T01, part 2)

- Status: Accepted
- Date: 2026-11-07
- Related: ADR-058 (the server side, whose checks this must satisfy), ADR-015 (media), plan 07 section 7, S6-SPK-01 (resize and EXIF removal in browsers), FR-ACC-07
- Plan approved by the owner on 7 Nov 2026, "All recommended": keep the existing UploadZone and add a small picture to each row; progress by step, not by byte; hint "Up to 20 MB each"; a Design Lab entry on the Domain board; WebKit and Firefox installed for the spike; new wording flagged, not approved.

## Decision

- **Preparing happens in the browser** (`features/media/prepare-photo.ts`, with the browser's own calls in `browser-image.ts`): the file is decoded with the camera rotation applied (`createImageBitmap(..., { imageOrientation: "from-image" })`), scaled so the longest side is at most **2000 px** and never enlarged, drawn on a blank canvas and encoded as **WebP at quality 0.8**, or as **JPEG at 0.8 on a white background** when the browser cannot make WebP (older Safari hands back a PNG when asked for WebP, so only a result of the asked-for type counts). Drawing again carries pixels only: the EXIF block and its GPS position are left behind. The server refuses any file that still has one (ADR-058), so this step is the owner's privacy protection and the server is its check.
- **What is turned away before anything is uploaded:** an original over **20 MB**, an empty file, a type that is not JPEG, PNG, WebP, HEIC or HEIF (an SVG, a PDF, a GIF), and a file the browser cannot decode (a HEIC on most browsers). Each has its own message. HEIC is tried because Safari can decode it; the file picker's `accept` lists only JPEG, PNG and WebP on purpose, because a phone then converts a HEIC to a JPEG before handing it over.
- **The sequence for each file** (`PhotoUploaderConnected`, `photo-uploader.client.tsx`): prepare, `requestPhotoUpload`, send the file to the issued address, `finalizePhoto`. Files go one after another, in the order they were chosen, so the server's six-photo limit is never raced and the first photo is the cover. A failure stays on its own row with the reason and the rest carry on. The server's reasons arrive as message keys (`validation.photo*`) and are shown through `fieldErrorText`; an ended session shows the existing "Sign in again" warning, back to the page that hosts the uploader.
- **Sending the file** (`upload-to-target.ts`) is the same request the Supabase client makes for a signed upload, a PUT of the file to `/storage/v1/object/upload/sign/<bucket>/<path>?token=...`, written out so the browser does not load the whole Supabase client for one request. The token is the permission, so no sign-in is sent. `x-upsert: false` means an existing file is never overwritten. The integration test sends a file this way to the real storage service.
- **Progress is by step** (preparing, uploading, saving, removing), not by byte: a `fetch` reports no byte progress, and reaching into the storage client's internals for it was not worth the risk. The bar and a text line name the step.
- **The look** is the existing `UploadZone`, a list of rows, with two optional additions: a small picture of the photo (`previewUrl`) and a line of step text (`status`). Rows without them look exactly as before, so the older Design Lab pictures do not change. The approved UX draws a grid of pictures (post-property, step 3); the list is this task's choice and is to be revisited with the wizard (S6-T02).
- **Removing a photo** asks the server first and takes the row out when it agrees; if the server refuses, the photo stays with a "could not remove" line. A photo removed while it is still being prepared or uploaded is stopped where it is; one removed while the server is saving it is taken off again as soon as it has a row.
- **Nothing hosts the uploader yet.** The wizard (S6-T02) hands it the three actions, the photos the listing already has and the page's address. The component tells the page the count and whether it is busy (`onStatus`) so the wizard can hold "Next" while a photo is on its way.

## S6-SPK-01 result (run here, not on phones)

The Design Lab's live specimen runs the real browser step and then the server's own `inspectImage` on the result. `e2e/design-lab/photo-uploader.spec.ts` checks, in Chromium in CI and in WebKit and Firefox on the developer's machine (both engines, run twice each, all passing):

- a 4000 x 3000 JPEG with a camera data block (refused by the server's reader) comes out as a **2000 x 1500 WebP that the server's reader accepts**, with no camera data;
- a photo stored 4000 x 3000 and marked "rotate a quarter turn" comes out **upright, 1500 x 2000**;
- an 800 x 600 photo is **not enlarged**;
- a PDF and a damaged JPEG get the right messages.

**Not yet done:** the check on real phones (iOS Safari, Android Chrome), which needs a page that hosts the uploader (the wizard, S6-T02). WebKit here is the Safari engine, not an iPhone; HEIC from a real iPhone library, very large camera originals and low-memory phones are the things to try there.

## Consequences

- New visitor-facing words, **not approved** (`domain.photoUploader` in `en.json`): "Drag photos here, or choose files", "JPG, PNG or WEBP. Up to 20 MB each." (the UX says "Up to 10 MB each"; the limit that matters to the owner is the original, since the page makes it smaller), "Cover", "Remove {name}", "{count} of {max} photos", the four step names (Preparing, Uploading, Saving, Removing), and the messages "This file is not a photo.", "This photo is larger than {maximum} MB.", "This photo cannot be read here. Use a JPEG, PNG or WebP photo.", "We couldn't upload this photo. Remove it and try again.", "We couldn't remove this photo. Try again."
- One new Design Lab entry ("Photo uploader", Domain board). Its first CI run is expected to fail only its three pictures (390, 820, 1440 px of the Domain board); the baselines follow in their own commit after the owner approves the CI pictures.
