import { Container } from "@/components/layout/container";
import { getEmailState } from "@/features/account";
import { addEmail, resendEmailLink } from "@/features/auth";
import {
  finalizePhoto,
  PhotoUploaderConnected,
  PHOTO_BUCKET,
  removePhoto,
  requestPhotoUpload,
  type SavedPhoto,
} from "@/features/media";
import { getTranslate } from "@/features/site";
import { formatDate } from "@/lib/format";
import { publicEnv } from "@/lib/public-env";
import { publicStorageUrl } from "@/lib/storage-url";
import {
  createListingDraft,
  deleteListingDraft,
  saveListingChanges,
  saveListingDraft,
  submitListing,
} from "./actions";
import { YourDrafts, type DraftRowView } from "./drafts.client";
import { PostingGate } from "./posting-gate.client";
import { isSignedIn, listMyDrafts } from "./queries";
import type { DraftView } from "./view";
import { PostingWizard, type WizardActions, type WizardEdit } from "./wizard.client";
import { valuesFromDraft } from "./wizard-state";

/** Where a submitted listing is followed (the dashboard's My listings tab). */
export const MY_LISTINGS_HREF = "/dashboard?tab=listings";

/** The wizard's actions, handed to the client wizard from here because it cannot import a server action. */
const ACTIONS: WizardActions = {
  createDraft: createListingDraft,
  saveDraft: saveListingDraft,
  submit: submitListing,
  saveChanges: saveListingChanges,
  photos: { requestUpload: requestPhotoUpload, finalize: finalizePhoto, remove: removePhoto },
};

type PostPropertyScreenProps = {
  /**
   * The listing being continued or edited (`/post-property/[id]`), or none for a new listing (`/post-property`).
   * A draft is continued; a listing in review, Live or not approved is edited (S6-T05).
   */
  draft?: DraftView | null;
};

/** How a listing that is already sent is edited, or null for a draft (and for a state that cannot be edited). */
function editOf(draft: DraftView | null): WizardEdit | null {
  if (!draft) return null;
  if (draft.status === "approved" || draft.status === "pending") {
    return { state: draft.status, reason: null };
  }
  if (draft.status === "rejected") return { state: "rejected", reason: draft.rejectionReason };
  return null;
}

/**
 * The post-property page (S6-T02, FR-ACC-06, FR-ACC-08). A signed-in person without a verified email sees the
 * gate instead of the wizard (ADD-03); a person whose email state could not be read goes on to the wizard,
 * because the database does not need an email to hold a draft. A new listing shows "Your drafts" above the
 * wizard when there are any. The page only composes: the rules are in the actions and the database.
 */
export async function PostPropertyScreen({ draft = null }: PostPropertyScreenProps) {
  const editing = editOf(draft);
  // Nobody signed in: the layout's gate is already sending them to sign in; read nothing for them.
  if (!(await isSignedIn())) return null;
  const email = await getEmailState();
  if (email.kind === "none" || email.kind === "pending") {
    return (
      <main id="main" className="flex-1">
        <Container className="py-10">
          <PostingGate
            pendingEmail={email.kind === "pending" ? email.email : null}
            send={addEmail}
            resend={resendEmailLink}
            browseHref="/"
          />
        </Container>
      </main>
    );
  }

  const translate = await getTranslate();
  const drafts: DraftRowView[] = draft
    ? []
    : (await listMyDrafts()).map((item) => ({
        id: item.id,
        title: item.title,
        place: item.locality,
        kind: item.listingType,
        propertyType: item.propertyType,
        saved: formatDate("en", item.updatedAt),
      }));
  const photos: SavedPhoto[] = (draft?.photos ?? []).map((photo, index) => ({
    id: photo.id,
    name: translate("postProperty.photos.photoName", { number: index + 1 }),
    previewUrl: publicStorageUrl(publicEnv.NEXT_PUBLIC_SUPABASE_URL, PHOTO_BUCKET, photo.path),
  }));

  return (
    <main id="main" className="flex-1">
      {drafts.length > 0 ? (
        <Container className="pt-6 md:pt-10">
          <YourDrafts drafts={drafts} remove={deleteListingDraft} />
        </Container>
      ) : null}
      <PostingWizard
        listingId={draft?.id ?? null}
        {...(draft ? { values: valuesFromDraft(draft), photos } : {})}
        actions={ACTIONS}
        uploader={PhotoUploaderConnected}
        doneHref={MY_LISTINGS_HREF}
        {...(editing ? { edit: editing } : {})}
      />
    </main>
  );
}
