# ADR-202 · Every picture is cleaned before it is kept; one still too heavy may be lowered in quality, by choice

- Status: Accepted. Flow and answers agreed with the owner in chat on 25 Nov 2026 (the prompt and its words were approved by merging #402).
- Date: 2026-11-25
- Related: ADR-015 and ADR-058 (the listing photo pipeline), ADR-144 and ADR-173 (blog pictures), ADR-179 (builder logos), ADR-182 and ADR-189 (sponsor pictures), ADR-086 (project media), R-SEC-04
- Class: C2 (uploads, personal data in files). No migration, no dependency. New words: the prompt's (`imageReduce.*`) and three refusals (`validation.blogImageHidden`, `validation.sponsorImageHidden`, `validation.logoHidden`).

## Context

Only listing photos were cleaned: the browser redraws them (which drops the camera block and the GPS position) and the server refuses any file that still has one. Every other upload (builder logos, blog covers and pictures, sponsor banners and photos, project images) was stored exactly as chosen, with whatever the file carried: the camera and phone model, the date, where it was taken, a small copy of the picture, comments. A heavy picture was simply refused. The owner asked that every picture is cleaned, that nothing is lowered in quality without the person choosing it, and that no limit changes.

## Decision

- **Step 1, always, with no loss of quality.** The browser takes the hidden data out of the file's bytes (`src/lib/image-hidden-data.ts`): it reads the structure (JPEG segments, PNG chunks, WebP chunks) and copies only what makes the picture. The pixels are never decoded or encoded again, so they are exactly the ones chosen. Taken out: the camera block (EXIF, GPS), XMP, IPTC, comments, embedded thumbnails, multi-picture data, other makers' blocks, PNG text chunks and time, and anything after the end of the picture. **Kept** because removing it changes how the picture looks: the colour profile (a Display P3 photo looks dull without it), the other colour and transparency data, and **the turn** of the picture: the camera block is replaced by one that holds only the turn, so a portrait photo does not lie on its side and no GPS or camera model survives. Animations and files cut short are refused.
- **Step 2, only for a picture still over its limit, and only if the person says yes.** The upload box shows the approved prompt (`ImageReducePrompt`, fed by `ImageReduceFlow` and `useImageReduce`): "lower its quality to fit?". The browser lowers the quality to the highest that fits (`src/lib/image-reduce.ts`), never changes the pixel size, and stops at a floor: 0.75, or 0.85 for floor plans (their text). The result is shown with its new weight; the person uses it or chooses another file; if even the floor is too heavy, or the browser cannot make that kind of picture, the prompt says so and asks for another file. A JPEG stays a JPEG; a PNG or WebP is saved as WebP (transparency kept); where the browser cannot make a WebP a PNG cannot be reduced, because a JPEG would turn its transparent parts white. The lowered picture goes through step 1 again.
- **No limit changes.** Builder logo 1 MB, blog pictures 500 KB, sponsor banners 150 KB and photo 480 KB, project images 10 MB. The buckets are unchanged (no migration).
- **Where it applies:** builder logo; blog cover, picture blocks and the Markdown paste screen; the four sponsor banner slots and the ad photo; project images, floor plans, elevations and plot images. Sponsors check kind, pixel size and shape first, so a picture that is too small or the wrong shape is refused before anyone is asked to lower its quality. **Not changed:** listing photos (ADR-058: their own pipeline already redraws every photo and the server refuses metadata) and the project brochure (a PDF).
- **The server checks the result where it already reads a picture back** (`checkPictureClean`, the same function run on the stored bytes): a new blog picture, a new sponsor picture, and a **new builder logo on save** (read through the builder's own client, which may read its own folder of the logo bucket; the logo already on record is not read again). A picture is `clean` when cleaning it again would take nothing out, so every picture the site's own page sends passes; one that still has hidden data or is cut short is refused with a message under the picture. This refuses a bypass; it does not repair it.

## Consequences

- A picture over its limit costs one click and a short wait instead of a refusal. Lowering the quality is the person's decision each time; nothing is lowered silently.
- Hidden data is gone from every stored picture that goes through these pages. **Pictures stored before this change are not rewritten.** Doing so is a one-off script against the dev and production buckets that changes file names where a PNG becomes WebP; it is left for the owner to decide and run.
- **Gap, by decision:** project images are cleaned in the browser but not read back by the server (they go from the browser to the bucket and the saved paths are checked, not the bytes). A request that skips the page can still store one with hidden data. Closing it needs a read-back in the project save, which is a larger change; it is not done here.
- The 150 KB banner cap with a banner at least 1940 px wide is tight: the reduce step will often fail on photographic banners ("cannot be made light enough") and work on flat ones. A lower floor for banners or a higher cap would change that; neither is changed here.
- Browser encoding is not exercised by the unit tests (they use a stand-in browser); the owner looks at each box on the dev site.

## Tests

- `src/lib/__tests__/image-hidden-data.test.ts`: JPEG, PNG and WebP: what goes, what stays byte for byte, the turn kept alone, running it again changes nothing, refusals, and `checkPictureClean` (what the browser's own encoders make is `clean`).
- `src/lib/__tests__/image-reduce.test.ts`, `image-clean.test.ts`, `use-image-reduce.test.tsx`: the highest quality that fits, the floors, the pixel size kept, the types, every failure, the walk-through.
- `src/components/domain/__tests__/image-reduce-flow.test.tsx`, `src/components/patterns/__tests__/image-reduce-prompt.test.tsx`: the states and the words.
- Each upload box (`builder-profile`, `blog-admin-client`, `blog-markdown-flow`, `sponsors-panel`, `project-form`): hidden data out before sending, the question for a heavy picture, nothing sent until it is used, choose another.
- The server: `post-service`, `sponsor-service`, `profile-service` tests refuse a picture that still has hidden data and write nothing.
