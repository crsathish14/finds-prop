"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SponsorFields } from "@/components/domain/sponsor-fields";
import type { SponsorImageSlotProps } from "@/components/domain/sponsor-image-slot";
import { SponsorsManager, type SponsorRow } from "@/components/domain/sponsors-manager";
import { ConfirmDialog } from "@/components/patterns/confirm-dialog";
import { ManagerDrawer } from "@/components/patterns/manager-drawer";
import { Icon } from "@/components/ui/icon";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { notify } from "@/lib/notify";
import type { ActionResult } from "@/types/action";
import {
  SLOT_KEYS,
  canAddSponsor,
  chosenFilesOf,
  countsOf,
  draftProblems,
  draftsOf,
  emptyDraft,
  formatReady,
  hasProblems,
  payloadOf,
  serverProblemsOf,
  slotOf,
  statusOf,
  withSponsorAdded,
  withSponsorMoved,
  withSponsorRemoved,
  withSponsorReplaced,
  type DraftBox,
  type SlotKey,
  type SponsorDraft,
} from "./sponsor-draft";
import {
  SLOT_SIZES,
  SPONSOR_IMAGE_MAX_SIDE,
  slotFit,
  type ImageInfo,
  type SlotProblem,
} from "./sponsor-rules";
import { createSponsorStorage, type SponsorStorage } from "./sponsor-storage";
import { checkPicture, chosenPictureOf, newSponsorId, uploadChosen } from "./sponsor-upload";
import type { SponsorEditView } from "./sponsor-view";
import { useSponsorWords } from "./sponsor-words.client";

/**
 * The sponsor manager of the Hero page (S7-T11, FR-ADM-11): the list, the Add and Edit drawer, the Delete question.
 * Every change to the list (add, edit, delete, move, active) is saved at once as the whole list in its order, with the
 * toast "Sponsor saved"; the Hero text and layout keep their own Save changes bar. A picture is checked in the browser
 * when it is chosen and sent to the public bucket when the sponsor is saved; if the save is refused the files just sent
 * are taken away again and the drawer stays open with the problem on the box or the picture it belongs to.
 */

export type SaveSponsors = (input: Record<string, unknown>) => Promise<ActionResult<unknown>>;

type Panel = { kind: "add" } | { kind: "edit"; id: string } | null;

/** A line under a slot: what is wrong, already in words. */
type Note = { title: string; text: string };
type Problems = { boxes: Partial<Record<DraftBox, string>>; slots: Partial<Record<SlotKey, Note>> };
const NO_PROBLEMS: Problems = { boxes: {}, slots: {} };

/** A file the browser refused for its slot, and what to say about it. */
type Rejection = {
  problem: SlotProblem;
  info: ImageInfo | null;
  bytes: number;
  fileName: string;
  /** The browser's own address of the file, kept only for a wrong shape (the person can see why). */
  url?: string;
};

type Revoke = (url: string) => void;
const revokeUrl: Revoke = (url) => {
  if (url.startsWith("blob:")) URL.revokeObjectURL(url);
};

/** The same record without one slot's entry. */
function without<Value>(
  record: Partial<Record<SlotKey, Value>>,
  key: SlotKey,
): Partial<Record<SlotKey, Value>> {
  return Object.fromEntries(Object.entries(record).filter(([name]) => name !== key));
}

const typeLabel = (type: string): string => (type.split("/")[1] ?? type).toUpperCase();
const kilobytes = (bytes: number): number => Math.max(1, Math.round(bytes / 1024));

export function useSponsors({
  sponsors,
  save,
  storage,
}: {
  sponsors: readonly SponsorEditView[];
  save: SaveSponsors;
  storage?: SponsorStorage;
}) {
  const words = useSponsorWords();
  const router = useRouter();
  const everything = useTranslations() as unknown as Translator;
  const bucket = useRef<SponsorStorage | null>(storage ?? null);
  const files = () => (bucket.current ??= createSponsorStorage());

  // The list opens on what is saved and starts over from it whenever the page is read again.
  const [seen, setSeen] = useState(sponsors);
  const [drafts, setDrafts] = useState(() => draftsOf(sponsors));
  if (sponsors !== seen) {
    setSeen(sponsors);
    setDrafts(draftsOf(sponsors));
  }

  const [saving, setSaving] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [work, setWork] = useState<SponsorDraft | null>(null);
  const [problems, setProblems] = useState<Problems>(NO_PROBLEMS);
  const [rejections, setRejections] = useState<Partial<Record<SlotKey, Rejection>>>({});
  const [checking, setChecking] = useState<readonly SlotKey[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);

  /* ---- sending ---- */

  const fieldWords = (result: Extract<ActionResult<unknown>, { ok: false }>) => {
    const found: Record<string, string> = {};
    for (const [path, list] of Object.entries(result.fieldErrors ?? {})) {
      const first = list[0];
      if (first && found[path] === undefined) found[path] = fieldErrorText(everything, first);
    }
    return found;
  };

  const send = async (next: readonly SponsorDraft[]) => {
    try {
      const result = await save(payloadOf(next));
      if (result.ok) return { ok: true as const };
      return {
        ok: false as const,
        fields: fieldWords(result),
        text: failureText(everything, result),
      };
    } catch {
      return {
        ok: false as const,
        fields: {},
        text: failureText(everything, { code: "INTERNAL" }),
      };
    }
  };

  const succeeded = (next: SponsorDraft[]) => {
    notify.success(words.saved.title, { description: words.saved.text });
    setDrafts(next);
    router.refresh();
  };

  /* ---- the drawer ---- */

  const forget = (draft: SponsorDraft | null, rejected: typeof rejections) => {
    if (draft) chosenFilesOf(draft).forEach((picture) => revokeUrl(picture.url));
    Object.values(rejected).forEach((one) => (one?.url ? revokeUrl(one.url) : undefined));
  };

  const closePanel = (release: boolean) => {
    if (release) forget(work, rejections);
    setPanel(null);
    setWork(null);
    setProblems(NO_PROBLEMS);
    setRejections({});
    setChecking([]);
  };

  const openAdd = () => {
    if (saving || !canAddSponsor(drafts)) return;
    setWork(emptyDraft(newSponsorId()));
    setProblems(NO_PROBLEMS);
    setRejections({});
    setPanel({ kind: "add" });
  };

  const openEdit = (id: string, opening: Problems = NO_PROBLEMS) => {
    const draft = drafts.find((one) => one.id === id);
    if (!draft || saving) return;
    setWork({ ...draft, pictures: { ...draft.pictures } });
    setProblems(opening);
    setRejections({});
    setPanel({ kind: "edit", id });
  };

  const textOf = (found: ReturnType<typeof draftProblems>): Problems => {
    const boxes: Problems["boxes"] = {};
    for (const [box, key] of Object.entries(found.boxes)) {
      boxes[box as DraftBox] = fieldErrorText(everything, { key });
    }
    const slots: Problems["slots"] = {};
    for (const key of Object.keys(found.slots) as SlotKey[]) {
      slots[key] = { title: words.slotStatus.neededTitle, text: words.slotStatus.neededText };
    }
    return { boxes, slots };
  };

  const serverNotes = (mine: ReturnType<typeof serverProblemsOf>[string] | undefined): Problems => {
    const slots: Problems["slots"] = {};
    for (const [key, text] of Object.entries(mine?.slots ?? {})) {
      slots[key as SlotKey] = { title: words.slotStatus.otherTitle, text };
    }
    return { boxes: { ...mine?.boxes }, slots };
  };

  const saveWork = async () => {
    if (!work || !panel || saving) return;
    const found = draftProblems(work);
    if (hasProblems(found)) {
      setProblems(textOf(found));
      return;
    }
    setSaving(true);
    let uploaded: string[] = [];
    try {
      const up = await uploadChosen(work, files());
      uploaded = up.uploaded;
      if (!up.ok) {
        await files().remove(up.uploaded);
        setProblems({
          boxes: {},
          slots: {
            [up.slot]: { title: words.slotStatus.uploadTitle, text: words.slotStatus.uploadText },
          },
        });
        return;
      }
      const next =
        panel.kind === "add"
          ? withSponsorAdded(drafts, up.draft)
          : withSponsorReplaced(drafts, up.draft);
      const sent = await send(next);
      if (sent.ok) {
        closePanel(false);
        succeeded(next);
        return;
      }
      await files().remove(uploaded);
      const mapped = serverProblemsOf(next, sent.fields);
      const mine = mapped[work.id];
      if (mine) {
        setProblems(serverNotes(mine));
      } else {
        notify.error(sent.text);
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  /** A change that needs no drawer: move or delete. A sponsor the server finds fault with is opened to be put right. */
  const change = async (next: SponsorDraft[]) => {
    if (saving) return;
    setSaving(true);
    try {
      const sent = await send(next);
      if (sent.ok) {
        succeeded(next);
        return;
      }
      const mapped = serverProblemsOf(next, sent.fields);
      const first = next.find((one) => mapped[one.id] !== undefined);
      notify.error(sent.text);
      if (first) {
        const opened = drafts.find((one) => one.id === first.id);
        if (opened) {
          setWork({ ...opened, pictures: { ...opened.pictures } });
          setProblems(serverNotes(mapped[first.id]));
          setRejections({});
          setPanel({ kind: "edit", id: first.id });
        }
      } else {
        router.refresh();
      }
    } finally {
      setSaving(false);
    }
  };

  const move = (id: string, direction: "up" | "down") =>
    void change(withSponsorMoved(drafts, id, direction));

  const confirmDelete = () => {
    const id = deleting;
    setDeleting(null);
    if (id) void change(withSponsorRemoved(drafts, id));
  };

  /* ---- the pictures ---- */

  const dropPicture = (key: SlotKey) =>
    setWork((previous) => {
      if (!previous) return previous;
      const gone = previous.pictures[key];
      if (gone?.kind === "chosen") revokeUrl(gone.url);
      return { ...previous, pictures: without(previous.pictures, key) };
    });

  const clearNote = (key: SlotKey) => {
    setRejections((previous) => {
      const gone = previous[key];
      if (gone?.url) revokeUrl(gone.url);
      return without(previous, key);
    });
    setProblems((previous) => {
      if (!previous.slots[key]) return previous;
      return { ...previous, slots: without(previous.slots, key) };
    });
  };

  const pick = async (key: SlotKey, file: File) => {
    setChecking((previous) => [...previous, key]);
    try {
      const check = await checkPicture(file, key);
      clearNote(key);
      dropPicture(key);
      if (check.ok) {
        const url = URL.createObjectURL(file);
        const chosen = chosenPictureOf(file, check, url);
        setWork((previous) =>
          previous ? { ...previous, pictures: { ...previous.pictures, [key]: chosen } } : previous,
        );
        return;
      }
      const url = check.problem === "shape" ? URL.createObjectURL(file) : undefined;
      setRejections((previous) => ({
        ...previous,
        [key]: {
          problem: check.problem,
          info: check.info,
          bytes: check.bytes,
          fileName: file.name,
          ...(url ? { url } : {}),
        },
      }));
    } finally {
      setChecking((previous) => previous.filter((one) => one !== key));
    }
  };

  const rejectionNote = (key: SlotKey, rejection: Rejection): Note => {
    const status = words.slotStatus;
    const { shown, minimum } = SLOT_SIZES[slotOf(key).format][slotOf(key).device];
    const info = rejection.info;
    switch (rejection.problem) {
      case "type":
        return { title: status.typeTitle, text: status.typeText };
      case "size":
        return { title: status.sizeTitle(kilobytes(rejection.bytes)), text: status.sizeText };
      case "small":
        if (info && (info.width > SPONSOR_IMAGE_MAX_SIDE || info.height > SPONSOR_IMAGE_MAX_SIDE)) {
          return {
            title: status.largeTitle,
            text: status.large(info.width, info.height, SPONSOR_IMAGE_MAX_SIDE),
          };
        }
        return {
          title: status.smallTitle,
          text: status.small(info?.width ?? 0, info?.height ?? 0, minimum.width, minimum.height),
        };
      case "shape": {
        const slotRatio = shown.width / shown.height;
        const imageRatio = info ? info.width / info.height : slotRatio;
        return {
          title: status.shapeTitle,
          text: status.shape(
            imageRatio > slotRatio ? "wider" : "taller",
            imageRatio.toFixed(1),
            slotRatio.toFixed(1),
          ),
        };
      }
    }
  };

  const slots: (SponsorImageSlotProps & { key: string })[] = SLOT_KEYS.map((key) => {
    const where = slotOf(key);
    const { shown, minimum } = SLOT_SIZES[where.format][where.device];
    const picture = work?.pictures[key];
    const rejection = rejections[key];
    const note = problems.slots[key];
    const base = {
      key,
      title: words.slotTitles[key],
      note: words.say.slotNote(shown, minimum),
      ratio: shown,
      words: words.slotWords,
      onFile: (file: File) => void pick(key, file),
    };
    if (checking.includes(key)) return { ...base, state: "checking" as const };
    if (rejection) {
      return {
        ...base,
        state: "rejected" as const,
        fileName: rejection.fileName,
        ...(rejection.url ? { image: { src: rejection.url } } : {}),
        status: rejectionNote(key, rejection),
      };
    }
    if (note) {
      return {
        ...base,
        state: "rejected" as const,
        ...(picture ? { image: { src: picture.url } } : {}),
        status: note,
      };
    }
    if (picture) {
      const near = (picture.kind === "chosen" ? picture.fit : slotFit(where, picture)) !== "cover";
      return {
        ...base,
        state: near ? ("near" as const) : ("filled" as const),
        image: { src: picture.url },
        status: near
          ? {
              title: words.slotStatus.nearTitle,
              text: words.slotStatus.near(minimum.width, minimum.height),
            }
          : {
              title: words.slotStatus.fills,
              text: words.say.details(
                picture.width,
                picture.height,
                typeLabel(picture.type),
                picture.bytes === null ? null : kilobytes(picture.bytes),
              ),
            },
        onRemove: () => {
          clearNote(key);
          dropPicture(key);
        },
      };
    }
    return { ...base, state: "empty" as const };
  });

  const rows: SponsorRow[] = drafts.map((draft) => {
    const label = draft.advertiser.trim() || words.manager.words.unnamed;
    return {
      id: draft.id,
      advertiser: draft.advertiser.trim(),
      status: statusOf(draft),
      strip: formatReady(draft, "strip"),
      panel: formatReady(draft, "panel"),
      moveUpLabel: words.say.moveUp(label),
      moveDownLabel: words.say.moveDown(label),
      editLabel: words.manager.edit,
      editFor: label,
      onEdit: () => openEdit(draft.id),
      deleteLabel: words.say.deleteLabel(label),
      onDelete: () => setDeleting(draft.id),
      ...(saving ? { pending: true } : {}),
    };
  });

  const deletingDraft = drafts.find((one) => one.id === deleting);

  return {
    drafts,
    saving,
    rows,
    full: !canAddSponsor(drafts),
    openAdd,
    move,
    panel,
    work,
    setWork,
    problems,
    slots,
    saveWork,
    closePanel,
    deleting: deletingDraft ?? null,
    cancelDelete: () => setDeleting(null),
    confirmDelete,
    words,
  };
}

export type SponsorsState = ReturnType<typeof useSponsors>;

/** The sponsors section for the Hero page's `after` slot: the list, the drawer and the Delete question. */
export function SponsorsPanel({ state }: { state: SponsorsState }) {
  const { words, work, panel } = state;
  const counts = countsOf(state.drafts);
  const label = state.deleting?.advertiser.trim() || words.manager.words.unnamed;
  const note = state.full ? `${words.manager.note} ${words.manager.full}` : words.manager.note;

  return (
    <div>
      <SponsorsManager
        title={words.manager.title}
        intro={words.manager.intro}
        addLabel={words.manager.addLabel}
        onAdd={state.openAdd}
        addDisabled={state.saving || state.full}
        columns={words.manager.columns}
        caption={words.manager.caption}
        rows={state.rows}
        countText={words.say.count(counts.total, counts.active)}
        note={note}
        words={words.manager.words}
        empty={words.manager.empty}
        onMove={state.move}
        headingLevel="h3"
      />
      <ManagerDrawer
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open && !state.saving) state.closePanel(true);
        }}
        title={panel?.kind === "edit" ? words.drawer.editTitle : words.drawer.addTitle}
        closeLabel={words.drawer.close}
        cancelLabel={words.drawer.cancel}
        submitLabel={words.drawer.save}
        formId="sponsor-form"
        pending={state.saving}
      >
        {work === null ? null : (
          <form
            id="sponsor-form"
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              // The drawer sits inside the Hero page's own form in the React tree: its submit must not reach that form.
              event.stopPropagation();
              void state.saveWork();
            }}
          >
            <SponsorFields
              values={{
                advertiser: work.advertiser,
                alt: work.alt,
                href: work.href,
                active: work.active,
              }}
              errors={state.problems.boxes}
              onChange={(values) => state.setWork({ ...work, ...values })}
              slots={state.slots}
              disabled={state.saving}
              words={words.fields}
            />
          </form>
        )}
      </ManagerDrawer>
      <ConfirmDialog
        open={state.deleting !== null}
        onOpenChange={(open) => {
          if (!open) state.cancelDelete();
        }}
        icon={<Icon icon={Trash2} size="lg" />}
        title={words.say.deleteTitle(label)}
        description={words.confirmDelete.text}
        confirmLabel={words.confirmDelete.confirm}
        cancelLabel={words.confirmDelete.cancel}
        onConfirm={state.confirmDelete}
      />
    </div>
  );
}
