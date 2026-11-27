"use client";

import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PriceTrendsEditor,
  type PriceTrendRow,
  type PriceTrendsWords,
} from "@/components/domain/price-trends-editor";
import type { PlacePickerComponent } from "@/components/domain/place-picker";
import {
  ProjectFields,
  type ProjectFieldName,
  type ProjectFieldValues,
  type ProjectFieldsWords,
} from "@/components/domain/project-fields";
import { FormField } from "@/components/patterns/form-field";
import { Input } from "@/components/ui/input";
import { ProjectFormLayout } from "@/components/domain/project-form-layout";
import { ProjectMedia, type ProjectMediaGroupName } from "@/components/domain/project-media";
import { ProjectSaveBar } from "@/components/domain/project-save-bar";
import { ProjectSectionNav, type ProjectSectionId } from "@/components/domain/project-section-nav";
import { Alert } from "@/components/patterns/alert";
import type { MediaItem } from "@/components/patterns/media-group-field";
import { Select } from "@/components/ui/select";
import { Heading } from "@/components/ui/heading";
import { Text } from "@/components/ui/text";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { QUALITY_FLOOR_DETAILED } from "@/lib/image-reduce";
import { notify } from "@/lib/notify";
import { useImageReduce } from "@/lib/use-image-reduce";
import { publicEnv } from "@/lib/public-env";
import type { ActionResult } from "@/types/action";
import { MEDIA_MAX, TREND_MONTHS_MAX } from "./constants";
import {
  boxesFor,
  EXTRA_VALUE_MAX,
  missingExtras,
  type ExtraAnswers,
  type ExtraBox,
} from "./extra-fields";
import { priceTypesFor, propertyTypesFor } from "./rules";
import {
  EMPTY_PROJECT_VALUES,
  MEDIA_GROUPS,
  MEDIA_MAX_BYTES,
  MEDIA_MAX_MEGABYTES,
  appliesOf,
  errorFieldOf,
  fileProblem,
  itemOfPath,
  mediaOf,
  payloadOf,
  projectProblems,
  reconcile,
  sectionOfError,
  sectionStatesOf,
  slugFromName,
  trendProblems,
  trendRowsOf,
  uploadPath,
  valuesOf,
  type ProjectErrorField,
  type ProjectFormScope,
} from "./form";
import { createMediaStorage, type MediaStorage } from "./media-storage";
import type { ProjectDone } from "./project-service";
import type { BuilderOption, FormOption, ProjectEditView } from "./view";

type Failure = Extract<ActionResult<unknown>, { ok: false }>;

/** What becomes of a chosen picture before it is sent: the file to send, left out by the admin, or not a picture the site takes. */
type PreparedAnswer = { kind: "file"; file: File } | { kind: "skipped" } | { kind: "refused" };

export type ProjectFormProps = {
  /** Who is editing: the admin (the Builder and Enquiry form boxes, price trends) or a builder (the approval warning). */
  scope: ProjectFormScope;
  /** The project to change; none for a new one. */
  project: ProjectEditView | null;
  /** The builders to choose from (the admin only). */
  builders?: BuilderOption[];
  /** The forms to choose from for the project page (the admin only). */
  forms?: FormOption[];
  /** Creates the project (when `project` is none) or saves it; the page passes the matching action. */
  save: (input: Record<string, unknown>) => Promise<ActionResult<ProjectDone>>;
  /** Where Cancel goes. */
  backHref: string;
  /** Where a new project's edit page is: the new id is added to the end. */
  editBase: string;
  /** The media bucket; the tests give their own. */
  storage?: MediaStorage;
  /** The address of the storage service, for the small pictures; defaults to the project's own. */
  mediaBaseUrl?: string;
  /** The place search box of the Location section; the page gives it, because it is another feature (ADR-140). */
  placePicker?: PlacePickerComponent;
  /** The extra boxes the super admin added to the form (ADR-168); none until some are defined. */
  extraBoxes?: ExtraBox[];
};

type Errors = Partial<Record<ProjectErrorField, string>>;

/** The label words of each box, by the name an error carries, for the line that names what needs attention. */
const LABEL_OF: Record<ProjectFieldName, keyof ProjectFieldsWords> = {
  name: "name",
  builderId: "builder",
  projectType: "projectType",
  propertyType: "propertyType",
  offerType: "offerType",
  plotStatus: "plotStatus",
  villaType: "villaType",
  projectStatus: "projectStatus",
  price: "price",
  priceType: "priceType",
  securityDeposit: "securityDeposit",
  maintenancePerMonth: "maintenancePerMonth",
  areaMinSqft: "areaMin",
  areaMaxSqft: "areaMax",
  bhkOptions: "bhk",
  landAreaAcres: "landArea",
  possessionDate: "possession",
  contactPhone: "contactPhone",
  city: "city",
  locality: "locality",
  address: "address",
  latitude: "latitude",
  longitude: "longitude",
  advantages: "advantages",
  nearby: "nearby",
  reraApplicable: "reraApplicable",
  reraNumber: "reraNumber",
  reraNotApplicableReason: "reraReason",
  description: "description",
  specifications: "specifications",
  amenities: "amenities",
  seoTitle: "seoTitle",
  slug: "slug",
  seoDescription: "seoDescription",
};

const SECTION_ORDER: ProjectSectionId[] = ["basics", "location", "rera", "details", "media", "seo"];

let counter = 0;
const nextId = () => `upload-${(counter += 1)}`;

/**
 * The project form as a page (S7-T02, part C, FR-ADM-04, FR-BLD-02): the sections, the section list that follows the
 * scroll, the admin's side boxes (the enquiry form and the price trends), the save bar, the media upload and the
 * messages. It calls the one save action it is given and keeps nothing the server does not also know: after a save
 * the page is read again. A new project is saved first, then opens its edit page, because the media folder is named
 * for the project's id. A builder's form is the same parts with the approval warning on top and no admin boxes;
 * the builder's own pages come with the builder portal.
 */
export function ProjectForm({
  scope,
  project,
  builders = [],
  forms = [],
  save,
  backHref,
  editBase,
  storage: givenStorage,
  mediaBaseUrl = publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  placePicker,
  extraBoxes = [],
}: ProjectFormProps) {
  const translate = useTranslations("admin.projectForm");
  const everything = useTranslations() as unknown as Translator;
  const router = useRouter();
  const storageRef = useRef<MediaStorage | null>(givenStorage ?? null);
  const storage = () => (storageRef.current ??= createMediaStorage());
  // A picture over the limit is not refused: the admin may lower its quality to fit (the hidden data is taken out first).
  const reducer = useImageReduce({ limitBytes: MEDIA_MAX_BYTES });
  const planReducer = useImageReduce({
    limitBytes: MEDIA_MAX_BYTES,
    qualityFloor: QUALITY_FLOOR_DETAILED,
  });
  const [deciding, setDeciding] = useState<ProjectMediaGroupName | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const waiting = useRef<{
    source: typeof reducer;
    resolve: (answer: PreparedAnswer) => void;
  } | null>(null);

  const projectId = project?.id ?? null;
  const admin = scope === "admin";

  const [values, setValues] = useState<ProjectFieldValues>(
    project ? valuesOf(project) : EMPTY_PROJECT_VALUES,
  );
  const [extras, setExtras] = useState<ExtraAnswers>(project?.extraFields ?? {});
  const [extraErrors, setExtraErrors] = useState<Record<string, string>>({});
  const [formId, setFormId] = useState(project?.formId ?? "");
  const [videos, setVideos] = useState<string[]>(project?.videos ?? []);
  const [media, setMedia] = useState(() => mediaOf(mediaBaseUrl, project));
  const [trends, setTrends] = useState<PriceTrendRow[]>(() => trendRowsOf(project));
  const [errors, setErrors] = useState<Errors>({});
  const [trendErrors, setTrendErrors] = useState<ReturnType<typeof trendProblems>>({});
  const [saving, setSaving] = useState(false);
  const [current, setCurrent] = useState<ProjectSectionId>("basics");
  // Once the person types in the page address, the name stops suggesting one.
  const [slugTouched, setSlugTouched] = useState(project !== null);
  // Paths that were saved with the project and have since been taken out of a group; removed from the bucket after the next save.
  const removedSaved = useRef<Set<string>>(new Set());
  const savedPaths = useRef<Set<string>>(
    new Set(MEDIA_GROUPS.flatMap((group) => media[group].map((item) => item.id))),
  );

  // The section list follows the scroll: the section nearest the top of the screen is the current one.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const seen = new Set<ProjectSectionId>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = entry.target.id as ProjectSectionId;
          if (entry.isIntersecting) seen.add(id);
          else seen.delete(id);
        }
        const first = SECTION_ORDER.find((id) => seen.has(id));
        if (first) setCurrent(first);
      },
      { rootMargin: "-15% 0px -70% 0px" },
    );
    for (const id of SECTION_ORDER) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  const change = <Name extends ProjectFieldName>(name: Name, value: ProjectFieldValues[Name]) => {
    setValues((now) => {
      // A choice can make other boxes stop applying (a plot has no bedrooms): they are cleared, not left to be sent.
      const next = reconcile({ ...now, [name]: value });
      if (name === "name" && !slugTouched) next.slug = slugFromName(String(value));
      return next;
    });
    if (name === "slug") setSlugTouched(true);
    setErrors((now) => ({ ...now, [name]: undefined }));
  };

  // --- the media ---------------------------------------------------------------------------------------------

  const patchItem = (group: ProjectMediaGroupName, id: string, next: MediaItem | null) =>
    setMedia((now) => ({
      ...now,
      [group]: now[group].flatMap((item) => (item.id === id ? (next ? [next] : []) : [item])),
    }));

  /**
   * A picture goes through two steps before it is sent: its hidden data comes out, and one still over the limit is
   * not refused but waits for the admin's answer to "lower the quality to fit?". Floor plans keep a higher quality floor
   * so their text stays readable. The answer is the file to send, "skipped" (the admin chose another), or "refused".
   */
  const prepare = (group: ProjectMediaGroupName, file: File): Promise<PreparedAnswer> => {
    const run = () =>
      new Promise<PreparedAnswer>((resolve) => {
        const source = group === "floorPlans" ? planReducer : reducer;
        waiting.current = { source, resolve };
        setDeciding(group);
        void source
          .choose(file, (ready) => {
            waiting.current = null;
            setDeciding(null);
            resolve({ kind: "file", file: ready });
          })
          .then((refused) => {
            if (refused === null) return;
            waiting.current = null;
            setDeciding(null);
            resolve({ kind: "refused" });
          });
      });
    // One picture is decided at a time, also when files are chosen in two groups together: the next waits its turn.
    const turn = queue.current.then(run);
    queue.current = turn.then(
      () => undefined,
      () => undefined,
    );
    return turn;
  };

  const addFiles = async (group: ProjectMediaGroupName, files: File[]) => {
    if (projectId === null) return;
    const max = group === "brochure" ? 1 : MEDIA_MAX;
    const used = media[group].filter((item) => item.stage !== "error").length;
    for (const picked of files.slice(0, Math.max(0, max - used))) {
      let file = picked;
      if (group !== "brochure") {
        const answer = await prepare(group, picked);
        if (answer.kind === "skipped") continue;
        if (answer.kind === "refused") {
          setMedia((now) => ({
            ...now,
            [group]: [
              ...now[group],
              {
                id: nextId(),
                name: picked.name,
                kind: "image",
                stage: "error",
                error: translate("media.errors.type"),
              },
            ],
          }));
          continue;
        }
        file = answer.file;
      }
      const id = nextId();
      const kind = file.type.startsWith("image/") ? "image" : "file";
      const problem = fileProblem(file, group);
      if (problem) {
        const error =
          problem === "type"
            ? translate("media.errors.type")
            : translate("media.errors.size", { size: MEDIA_MAX_MEGABYTES });
        setMedia((now) => ({
          ...now,
          [group]: [...now[group], { id, name: file.name, kind, stage: "error", error }],
        }));
        continue;
      }
      const path = uploadPath(projectId, crypto.randomUUID(), file, group);
      setMedia((now) => ({
        ...now,
        [group]: [...now[group], { id, name: file.name, kind, stage: "uploading" }],
      }));
      const sent = await storage().upload(path, file);
      if (sent) patchItem(group, id, itemOfPath(mediaBaseUrl, path));
      else
        patchItem(group, id, {
          id,
          name: file.name,
          kind,
          stage: "error",
          error: translate("media.errors.upload"),
        });
    }
  };

  const removeFile = (group: ProjectMediaGroupName, id: string) => {
    const item = media[group].find((one) => one.id === id);
    if (!item) return;
    patchItem(group, id, null);
    if (item.stage !== "done") return;
    // A file saved with the project goes from the bucket after the next save (the page still shows it until then);
    // one added in this visit is not in any saved project, so it goes now.
    if (savedPaths.current.has(item.id)) removedSaved.current.add(item.id);
    else void storage().remove([item.id]);
  };

  const uploading = MEDIA_GROUPS.some((group) =>
    media[group].some((item) => item.stage === "uploading"),
  );

  // --- saving ------------------------------------------------------------------------------------------------

  /** A failure with no box to blame: said in a toast, and the page is read again so it shows the truth. */
  const reportFailure = (failure: Failure) => {
    notify.error(failureText(everything, failure));
    router.refresh();
  };

  const labels = (field: ProjectFieldName) => {
    const key = LABEL_OF[field];
    const words = fieldWords();
    const label = words[key];
    return typeof label === "string" ? label : field;
  };

  const showErrors = (found: Errors) => {
    setErrors(found);
    const sections = Object.keys(found)
      .map((field) => sectionOfError(field as ProjectErrorField))
      .filter((id): id is ProjectSectionId => id !== null);
    const first = SECTION_ORDER.find((id) => sections.includes(id));
    if (first && typeof document !== "undefined") {
      document.getElementById(first)?.scrollIntoView?.({ block: "start" });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const found: Errors = {};
    const problemsFound = projectProblems(values, { needsBuilder: admin && projectId === null });
    for (const [field, problem] of Object.entries(problemsFound)) {
      found[field as ProjectFieldName] = translate(`problems.${problem}`);
    }
    if (Object.keys(found).length > 0) {
      showErrors(found);
      return;
    }
    const lacking = missingExtras(extraBoxes, values.propertyType, extras);
    setExtraErrors(
      Object.fromEntries(
        lacking.map((id) => [id, fieldErrorText(everything, { key: "validation.required" })]),
      ),
    );
    if (lacking.length > 0) {
      document.getElementById("details")?.scrollIntoView?.({ block: "start" });
      return;
    }
    const trendProblemsFound = admin && projectId !== null ? trendProblems(trends) : {};
    setTrendErrors(trendProblemsFound);
    if (Object.keys(trendProblemsFound).length > 0) {
      setErrors({ priceTrends: translate("trends.fix") });
      return;
    }
    if (uploading) {
      notify.error(translate("media.wait"));
      return;
    }

    setSaving(true);
    try {
      const result = await save({
        extraFields: extras,
        ...payloadOf(
          {
            values,
            formId,
            videos,
            media: Object.fromEntries(
              MEDIA_GROUPS.map((group) => [
                group,
                media[group].filter((item) => item.stage === "done").map((item) => item.id),
              ]),
            ) as Record<ProjectMediaGroupName, string[]>,
            trends,
          },
          { scope, projectId },
        ),
      });
      if (!result.ok) {
        const mapped: Errors = {};
        const extraMapped: Record<string, string> = {};
        for (const [path, problems] of Object.entries(result.fieldErrors ?? {})) {
          const extraId = path.startsWith("extraFields.") ? path.slice(12) : null;
          if (extraId && problems[0])
            extraMapped[extraId] = fieldErrorText(everything, problems[0]);
          const field = errorFieldOf(path);
          const first = problems[0];
          if (field && first && mapped[field] === undefined) {
            mapped[field] = fieldErrorText(everything, first);
          }
        }
        setExtraErrors(extraMapped);
        if (Object.keys(mapped).length > 0) showErrors(mapped);
        else if (Object.keys(extraMapped).length > 0) {
          document.getElementById("details")?.scrollIntoView?.({ block: "start" });
        } else reportFailure(result);
        return;
      }
      setErrors({});
      if (projectId === null) {
        notify.success(translate("toast.created.title"), {
          description: admin
            ? translate("toast.created.text", { name: values.name.trim() })
            : translate("toast.createdBuilder.text", { name: values.name.trim() }),
        });
        router.replace(`${editBase}/${result.data.projectId}`);
        return;
      }
      // What the saved project holds now is what the form shows; files taken out of it can leave the bucket.
      const gone = [...removedSaved.current];
      removedSaved.current = new Set();
      savedPaths.current = new Set(
        MEDIA_GROUPS.flatMap((group) =>
          media[group].filter((item) => item.stage === "done").map((item) => item.id),
        ),
      );
      if (gone.length > 0) await storage().remove(gone);
      notify.success(
        admin ? translate("toast.saved.title") : translate("toast.savedBuilder.title"),
        {
          description: admin ? translate("toast.saved.text") : translate("toast.savedBuilder.text"),
        },
      );
      router.refresh();
    } finally {
      setSaving(false);
    }
  };

  // --- the words ---------------------------------------------------------------------------------------------

  function fieldWords(): ProjectFieldsWords {
    return {
      basics: {
        title: translate("sections.basics.title"),
        description: translate("sections.basics.text"),
      },
      location: {
        title: translate("sections.location.title"),
        description: translate("sections.location.text"),
      },
      rera: {
        title: translate("sections.rera.title"),
        description: translate("sections.rera.text"),
      },
      details: {
        title: translate("sections.details.title"),
        description: translate("sections.details.text"),
      },
      media: {
        title: translate("sections.media.title"),
        description: translate("sections.media.text"),
      },
      seo: { title: translate("sections.seo.title"), description: translate("sections.seo.text") },
      name: translate("fields.name"),
      builder: translate("fields.builder"),
      builderHint: translate("fields.builderHint"),
      unset: translate("fields.unset"),
      projectType: translate("fields.projectType"),
      propertyType: translate("fields.propertyType"),
      offerType: translate("fields.offerType"),
      plotStatus: translate("fields.plotStatus"),
      villaType: translate("fields.villaType"),
      projectStatus: translate("fields.projectStatus"),
      price: translate("fields.price"),
      priceType: translate("fields.priceType"),
      securityDeposit: translate("fields.securityDeposit"),
      securityDepositHint: translate("fields.securityDepositHint"),
      maintenancePerMonth: translate("fields.maintenancePerMonth"),
      maintenancePerMonthHint: translate("fields.maintenancePerMonthHint"),
      areaMin: translate("fields.areaMin"),
      areaMax: translate("fields.areaMax"),
      bhk: translate("fields.bhk"),
      landArea: translate("fields.landArea"),
      possession: translate("fields.possession"),
      contactPhone: translate("fields.contactPhone"),
      city: translate("fields.city"),
      locality: translate("fields.locality"),
      address: translate("fields.address"),
      latitude: translate("fields.latitude"),
      longitude: translate("fields.longitude"),
      advantages: translate("fields.advantages"),
      nearby: translate("fields.nearby"),
      reraApplicable: translate("fields.reraApplicable"),
      reraNumber: translate("fields.reraNumber"),
      reraReason: translate("fields.reraReason"),
      reraReasonHint: translate("fields.reraReasonHint"),
      description: translate("fields.description"),
      specifications: translate("fields.specifications"),
      amenities: translate("fields.amenities"),
      seoTitle: translate("fields.seoTitle"),
      slug: translate("fields.slug"),
      slugHint: translate("fields.slugHint"),
      slugLockedHint: translate("fields.slugLockedHint"),
      seoDescription: translate("fields.seoDescription"),
      optional: translate("fields.optional"),
      tags: {
        placeholder: translate("tags.placeholder"),
        add: translate("tags.add"),
        remove: translate("tags.remove"),
        suggestions: translate("tags.suggestions"),
        full: translate("tags.full"),
      },
    };
  }

  const trendWords: PriceTrendsWords = {
    title: translate("trends.title"),
    description: translate("trends.description"),
    month: translate("trends.month"),
    price: translate("trends.price"),
    monthFormat: translate("trends.monthFormat"),
    add: translate("trends.add"),
    remove: (month) => translate("trends.remove", { month }),
    empty: translate("trends.empty"),
    full: translate("trends.full"),
  };

  const trendMessages = Object.fromEntries(
    Object.entries(trendErrors).map(([id, problem]) => [
      id,
      {
        ...(problem.month === "missing" ? { month: translate("trends.errors.monthMissing") } : {}),
        ...(problem.month === "twice" ? { month: translate("trends.errors.monthTwice") } : {}),
        ...(problem.price === "missing" ? { price: translate("trends.errors.priceMissing") } : {}),
        ...(problem.price === "number" ? { price: translate("trends.errors.priceNumber") } : {}),
        ...(problem.price === "range" ? { price: translate("trends.errors.priceRange") } : {}),
      },
    ]),
  );

  const fieldErrors = Object.fromEntries(
    Object.entries(errors).filter(([field, message]) => message && field in LABEL_OF),
  ) as Partial<Record<ProjectFieldName, string>>;
  const errorFields = Object.keys(errors).filter((field) => errors[field as ProjectErrorField]);
  const errorSections = new Set(
    errorFields
      .map((field) => sectionOfError(field as ProjectErrorField))
      .filter((id): id is ProjectSectionId => id !== null),
  );
  const states = sectionStatesOf({
    values,
    errorSections,
    needsBuilder: admin && projectId === null,
    hasMedia:
      videos.length > 0 ||
      MEDIA_GROUPS.some((group) => media[group].some((item) => item.stage === "done")),
  });
  const sectionLabels: Record<ProjectSectionId, string> = {
    basics: translate("sections.basics.title"),
    location: translate("sections.location.title"),
    rera: translate("sections.rera.title"),
    details: translate("sections.details.title"),
    media: translate("sections.media.title"),
    seo: translate("sections.seo.title"),
  };

  const named = errorFields
    .map((field) => (field in LABEL_OF ? labels(field as ProjectFieldName) : null))
    .filter((label): label is string => label !== null);

  const alertParts = [
    named.length > 0 ? translate("alert.text", { fields: named.join(", ") }) : null,
    errors.priceTrends ?? null,
  ].filter((part): part is string => part !== null);
  const alertText = alertParts.length > 0 ? alertParts.join(" ") : translate("alert.generic");

  const top = (
    <>
      {errorFields.length > 0 ? (
        <Alert tone="danger" title={translate("alert.title", { count: errorFields.length })}>
          {alertText}
        </Alert>
      ) : null}
      {admin ? null : (
        <Alert tone="warning" title={translate("warning.title")}>
          {translate("warning.text")}
        </Alert>
      )}
    </>
  );

  // The property types and price types offered are the ones that fit what is chosen above them (ADR-148).
  const propertyTypeLabels: Record<string, string> = {
    apartment: translate("options.propertyType.apartment"),
    villa: translate("options.propertyType.villa"),
    plot: translate("options.propertyType.plot"),
    vacant_land: translate("options.propertyType.vacantLand"),
    flat: translate("options.propertyType.flat"),
    office: translate("options.propertyType.office"),
    co_working: translate("options.propertyType.coWorking"),
  };
  const priceTypeLabels: Record<string, string> = {
    per_sqft: translate("options.priceType.perSqft"),
    basic: translate("options.priceType.basic"),
    all_inclusive: translate("options.priceType.allInclusive"),
    rent_per_month: translate("options.priceType.rentPerMonth"),
    rent_per_sqft_month: translate("options.priceType.rentPerSqftMonth"),
  };
  const options = {
    projectTypes: [
      { value: "residential", label: translate("options.projectType.residential") },
      { value: "commercial", label: translate("options.projectType.commercial") },
    ],
    propertyTypes: propertyTypesFor(values.projectType).map((type) => ({
      value: type,
      label: propertyTypeLabels[type] ?? type,
    })),
    offerTypes: [
      { value: "sale", label: translate("options.offerType.sale") },
      { value: "rent", label: translate("options.offerType.rent") },
    ],
    plotStatuses: [
      { value: "investment", label: translate("options.plotStatus.investment") },
      { value: "ready_to_build", label: translate("options.plotStatus.readyToBuild") },
    ],
    villaTypes: [
      { value: "duplex", label: translate("options.villaType.duplex") },
      { value: "row_house", label: translate("options.villaType.rowHouse") },
      { value: "individual", label: translate("options.villaType.individual") },
    ],
    priceTypes: priceTypesFor(values.projectType, values.offerType).map((type) => ({
      value: type,
      label: priceTypeLabels[type] ?? type,
    })),
    statuses: [
      { value: "new_launch", label: translate("options.status.newLaunch") },
      { value: "under_construction", label: translate("options.status.underConstruction") },
      { value: "ready_to_move", label: translate("options.status.readyToMove") },
    ],
    // A saved project's builder cannot change (the database refuses it), so its box offers that one builder only.
    ...(admin
      ? {
          builders: builders
            .filter((builder) => projectId === null || builder.id === values.builderId)
            .map((builder) => ({ value: builder.id, label: builder.name })),
        }
      : {}),
  };

  const mediaWords = {
    locked: translate("media.locked"),
    groups: {
      images: {
        label: translate("media.groups.images.label"),
        hint: translate("media.groups.images.hint"),
      },
      floorPlans: { label: translate("media.groups.floorPlans.label") },
      elevations: { label: translate("media.groups.elevations.label") },
      plotImages: { label: translate("media.groups.plotImages.label") },
      brochure: { label: translate("media.groups.brochure.label") },
    },
    files: {
      add: translate("media.files.add"),
      remove: (name: string) => translate("media.files.remove", { name }),
      uploading: translate("media.files.uploading"),
      removing: translate("media.files.removing"),
      full: translate("media.files.full"),
    },
    videos: {
      label: translate("media.videos.label"),
      hint: translate("media.videos.hint"),
      tags: {
        placeholder: translate("media.videos.placeholder"),
        add: translate("tags.add"),
        remove: translate("tags.remove"),
        suggestions: translate("tags.suggestions"),
        full: translate("tags.full"),
      },
    },
  };

  const slugLocked = !admin && project?.moderation === "approved";

  return (
    <form
      noValidate
      onSubmit={(event) => void submit(event)}
      className="flex flex-col gap-6 pb-6"
      aria-label={projectId === null ? translate("newTitle") : values.name}
    >
      <div className="flex flex-col gap-2">
        <Heading as="h1" size="1">
          {projectId === null ? translate("newTitle") : values.name}
        </Heading>
        <Text tone="muted">
          {projectId === null ? translate("newIntro") : translate("editIntro")}
        </Text>
      </div>
      <ProjectFormLayout
        top={top}
        nav={
          <ProjectSectionNav
            sections={SECTION_ORDER.map((id) => ({
              id,
              label: sectionLabels[id],
              state: states[id],
            }))}
            current={current}
            words={{
              nav: translate("nav.label"),
              done: translate("nav.done"),
              error: translate("nav.error"),
            }}
            onSelect={setCurrent}
          />
        }
        {...(admin
          ? {
              aside: (
                <>
                  <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 md:p-6">
                    <h2 className="text-title font-bold text-ink">{translate("enquiry.title")}</h2>
                    <p className="text-small text-muted">{translate("enquiry.text")}</p>
                    <Select
                      aria-label={translate("enquiry.title")}
                      value={formId}
                      disabled={saving}
                      onChange={(event) => setFormId(event.target.value)}
                    >
                      <option value="">{translate("enquiry.standard")}</option>
                      {forms.map((form) => (
                        <option key={form.id} value={form.id}>
                          {form.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {projectId === null ? null : (
                    <PriceTrendsEditor
                      rows={trends}
                      errors={trendMessages}
                      max={TREND_MONTHS_MAX}
                      disabled={saving}
                      words={trendWords}
                      onAdd={() =>
                        setTrends((now) => [...now, { id: nextId(), month: "", price: "" }])
                      }
                      onRemove={(id) => setTrends((now) => now.filter((row) => row.id !== id))}
                      onChange={(id, field, value) =>
                        setTrends((now) =>
                          now.map((row) => (row.id === id ? { ...row, [field]: value } : row)),
                        )
                      }
                    />
                  )}
                </>
              ),
            }
          : {})}
        footer={
          <ProjectSaveBar
            note={admin ? translate("save.noteAdmin") : translate("save.noteBuilder")}
            words={{
              cancel: translate("save.cancel"),
              save: translate("save.save"),
              saving: translate("save.saving"),
            }}
            saving={saving}
            onCancel={() => router.push(backHref)}
          />
        }
      >
        <ProjectFields
          values={values}
          errors={fieldErrors}
          onChange={change}
          options={options}
          applies={appliesOf(values)}
          amenitySuggestions={[
            translate("amenitySuggestions.clubhouse"),
            translate("amenitySuggestions.swimmingPool"),
            translate("amenitySuggestions.gym"),
            translate("amenitySuggestions.security"),
            translate("amenitySuggestions.powerBackup"),
            translate("amenitySuggestions.lift"),
          ]}
          slugLocked={slugLocked}
          disabled={saving}
          extras={boxesFor(extraBoxes, values.propertyType).map((box) => (
            <FormField
              key={box.id}
              label={box.label}
              required={box.required}
              optionalLabel={translate("extras.optional")}
              {...(box.hint ? { hint: box.hint } : {})}
              {...(extraErrors[box.id] ? { error: extraErrors[box.id] as string } : {})}
            >
              <Input
                value={extras[box.id] ?? ""}
                maxLength={EXTRA_VALUE_MAX}
                disabled={saving}
                onChange={(event) => setExtras({ ...extras, [box.id]: event.target.value })}
              />
            </FormField>
          ))}
          {...(placePicker ? { placePicker } : {})}
          words={fieldWords()}
          media={
            <ProjectMedia
              groups={{
                images: { items: media.images, ...(errors.images ? { error: errors.images } : {}) },
                floorPlans: {
                  items: media.floorPlans,
                  ...(errors.floorPlans ? { error: errors.floorPlans } : {}),
                },
                elevations: {
                  items: media.elevations,
                  ...(errors.elevations ? { error: errors.elevations } : {}),
                },
                plotImages: {
                  items: media.plotImages,
                  ...(errors.plotImages ? { error: errors.plotImages } : {}),
                },
                brochure: {
                  items: media.brochure,
                  ...(errors.brochure ? { error: errors.brochure } : {}),
                },
              }}
              videos={videos}
              {...(errors.videos ? { videosError: errors.videos } : {})}
              locked={projectId === null}
              disabled={saving}
              words={mediaWords}
              {...(deciding
                ? {
                    reduce: {
                      group: deciding,
                      flow: {
                        prompt: (deciding === "floorPlans" ? planReducer : reducer).prompt,
                        onReduce: () =>
                          void (deciding === "floorPlans" ? planReducer : reducer).reduce(),
                        onUse: (deciding === "floorPlans" ? planReducer : reducer).use,
                        onChooseAnother: () => {
                          // The picture is left out; the group's own picker opens again.
                          const open = waiting.current;
                          waiting.current = null;
                          open?.source.dismiss();
                          open?.resolve({ kind: "skipped" });
                          setDeciding(null);
                        },
                      },
                    },
                  }
                : {})}
              onFiles={(group, files) => void addFiles(group, files)}
              onRemove={removeFile}
              onVideosChange={setVideos}
            />
          }
        />
      </ProjectFormLayout>
    </form>
  );
}
