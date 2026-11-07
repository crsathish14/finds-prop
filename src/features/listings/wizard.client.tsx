"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { SessionEndedAlert } from "@/components/domain/session-ended-alert";
import { WizardFooter } from "@/components/domain/wizard-footer";
import { WizardShell } from "@/components/domain/wizard-shell";
import { Alert } from "@/components/patterns/alert";
import type { Step } from "@/components/patterns/stepper";
import { failureText, fieldErrorText, type Translator } from "@/i18n/failure-text";
import { dropDraft, saveDraft, type DraftValues } from "@/lib/form-draft";
import { notify } from "@/lib/notify";
import { isSessionEnded, sessionEndedHref } from "@/lib/session-ended";
import { useRestoredDraft, useRestoredNotice } from "@/lib/use-restored-draft";
import {
  PhotoUploaderConnected,
  type PhotoActions,
  type PhotoUploaderStatus,
  type SavedPhoto,
} from "@/features/media";
import type { ActionFailure, ActionResult, FieldError } from "@/types/action";
import {
  BasicsStep,
  DescriptionStep,
  DetailsStep,
  PhotosStepFrame,
  ReviewStep,
} from "./wizard-steps";
import {
  checkDraft,
  draftInput,
  EMPTY_VALUES,
  stepOfField,
  stepsWithErrors,
  validateStep,
  type StepErrors,
  type WizardStep,
  type WizardValues,
} from "./wizard-state";

/** The wizard's four actions as the page hands them over (a server action cannot be imported here). */
export type WizardActions = {
  createDraft: (input: {
    fields: Record<string, unknown>;
    idempotencyKey: string;
  }) => Promise<ActionResult<{ listingId: string; shortId: string }>>;
  saveDraft: (input: {
    listingId: string;
    fields: Record<string, unknown>;
  }) => Promise<ActionResult<{ listingId: string }>>;
  submit: (input: {
    listingId: string;
    idempotencyKey: string;
  }) => Promise<ActionResult<{ listingId: string; shortId: string }>>;
  photos: PhotoActions;
};

export type PostingWizardProps = {
  /** The draft being continued, or null for a new listing. */
  listingId: string | null;
  values?: WizardValues;
  photos?: SavedPhoto[];
  actions: WizardActions;
  /** Where "Submit for review" leads (My listings). */
  doneHref: string;
};

const FORM_NAME = "post-property";
const STEP_ORDER = [1, 2, 3, 4, 5] as const;
const ALL_BOX_STEPS = [1, 2, 4] as const;

/** The key under `fields.` that the server's schema names; the wizard's own field names. */
function fieldOfServerPath(path: string): string {
  return path.startsWith("fields.") ? path.slice("fields.".length) : path;
}

function toDraftValues(values: WizardValues): DraftValues {
  return { ...values };
}

/** The answers kept before signing in again, laid over the defaults; anything that is not a known box is ignored. */
function mergeRestored(base: WizardValues, kept: DraftValues | null): WizardValues {
  if (!kept) return base;
  const merged: WizardValues = { ...base, amenities: [...base.amenities] };
  for (const key of Object.keys(EMPTY_VALUES) as (keyof WizardValues)[]) {
    const value = kept[key];
    if (key === "amenities") {
      if (Array.isArray(value)) merged.amenities = value;
    } else if (typeof value === "string") {
      merged[key] = value;
    }
  }
  return merged;
}

/**
 * The post-property wizard, connected (S6-T02, FR-ACC-06, FR-ACC-08). It keeps what the boxes hold; Continue
 * checks only the current step with the same rules the server applies, then saves the step to the draft
 * (the first Continue starts the draft, so photos have a listing to belong to). Back never loses anything.
 * "Save draft" keeps an unfinished listing. Submit asks the server to send the draft for review; a refusal
 * names the steps to fix. Every refusal keeps what was typed. An ended session keeps the answers for the way
 * back in. Nothing here says who is posting: the owner is the signed-in account.
 */
export function PostingWizard(props: PostingWizardProps) {
  // The answers kept before signing in again are laid over the starting values once the page is in the browser;
  // a new key starts the wizard again with them, as the other connected forms do.
  const restored = useRestoredDraft(FORM_NAME);
  const words = useTranslations("postProperty");
  useRestoredNotice(FORM_NAME, restored, words("notices.restored"));
  const start = mergeRestored(props.values ?? EMPTY_VALUES, restored);
  return <WizardBody key={restored ? "restored" : "fresh"} {...props} values={start} />;
}

function WizardBody({
  listingId: initialListingId,
  values: initialValues,
  photos: savedPhotos = [],
  actions,
  doneHref,
}: PostingWizardProps & { values: WizardValues }) {
  const words = useTranslations("postProperty");
  const translate = useTranslations() as unknown as Translator;
  const router = useRouter();
  const [step, setStep] = useState<WizardStep>(1);
  const [values, setValues] = useState<WizardValues>(initialValues);
  const [errors, setErrors] = useState<StepErrors>({});
  const [listingId, setListingId] = useState<string | null>(initialListingId);
  const [photoStatus, setPhotoStatus] = useState<PhotoUploaderStatus>({
    count: savedPhotos.length,
    busy: false,
  });
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [alert, setAlert] = useState<null | { kind: "failed" | "save" | "limit"; text?: string }>(
    null,
  );
  const [sessionEnded, setSessionEnded] = useState<{ href: string } | null>(null);
  const [pending, startTransition] = useTransition();
  const [busyAction, setBusyAction] = useState<"next" | "draft" | "submit" | null>(null);
  const [createKey] = useState(() => crypto.randomUUID());
  const [submitKey] = useState(() => crypto.randomUUID());
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const [focusTick, setFocusTick] = useState(0);
  const firstRender = useRef(true);

  // A new step takes focus on its heading, so a screen reader hears where it is.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  // A step that is refused moves focus to its first field with a problem.
  useEffect(() => {
    if (focusTick === 0) return;
    const target = cardRef.current?.querySelector<HTMLElement>(
      '[aria-invalid="true"], fieldset[aria-describedby] input',
    );
    target?.focus();
  }, [focusTick]);

  const onStatus = useCallback((status: PhotoUploaderStatus) => setPhotoStatus(status), []);

  const change = <Field extends keyof WizardValues>(field: Field, value: WizardValues[Field]) => {
    setValues((now) => ({ ...now, [field]: value }));
    setErrors((now) =>
      now[field] ? Object.fromEntries(Object.entries(now).filter(([name]) => name !== field)) : now,
    );
  };

  const photosAt = () => (listingId ? `/post-property/${listingId}` : "/post-property");

  /** What a refused action leaves on screen. Returns true when it was something the screen could show. */
  function showFailure(failure: ActionFailure, creating = false) {
    if (isSessionEnded(failure)) {
      setSessionEnded({ href: sessionEndedHref(window.location.pathname) });
      return;
    }
    if (failure.code === "RATE_LIMITED") {
      setAlert({
        kind: "limit",
        text: creating ? words("notices.tooMany") : failureText(translate, failure),
      });
      return;
    }
    if (failure.code === "VALIDATION" && failure.fieldErrors) {
      const found: StepErrors = {};
      let limit: FieldError | undefined;
      for (const [path, list] of Object.entries(failure.fieldErrors)) {
        const first = list?.[0];
        if (!first) continue;
        const field = fieldOfServerPath(path);
        if (field === "listing") limit = first;
        else if (field === "photos") setPhotoError(fieldErrorText(translate, first));
        else if (stepOfField(field)) found[field] = first;
      }
      if (limit) {
        setAlert({ kind: "limit", text: fieldErrorText(translate, limit) });
        return;
      }
      const steps = stepsWithErrors(found);
      const photosRefused = failure.fieldErrors["photos"] !== undefined;
      if (Object.keys(found).length > 0 || photosRefused) {
        setErrors(found);
        const first = steps[0] ?? (photosRefused ? 3 : step);
        setStep(first);
        setFocusTick((tick) => tick + 1);
        return;
      }
    }
    setAlert({ kind: "failed" });
  }

  /** Saves the boxes of the given steps to the draft; starts the draft if there is none. True when it was saved. */
  async function persist(steps: readonly WizardStep[]): Promise<boolean> {
    const fields = draftInput(values, steps);
    try {
      if (!listingId) {
        const result = await actions.createDraft({ fields, idempotencyKey: createKey });
        if (!result.ok) {
          showFailure(result, true);
          return false;
        }
        setListingId(result.data.listingId);
        // The address now names the draft, so a reload or a shared link comes back to it. No navigation:
        // the wizard keeps what it holds.
        window.history.replaceState(null, "", `/post-property/${result.data.listingId}`);
        return true;
      }
      const result = await actions.saveDraft({ listingId, fields });
      if (!result.ok) {
        showFailure(result);
        return false;
      }
      return true;
    } catch {
      // The request did not get through (offline, server down): say so, keep what was typed.
      setAlert({ kind: "save" });
      return false;
    }
  }

  function clearNotices() {
    setAlert(null);
    setSessionEnded(null);
    setPhotoError(null);
  }

  function refuse(found: StepErrors) {
    setErrors(found);
    setFocusTick((tick) => tick + 1);
  }

  function next() {
    clearNotices();
    if (step === 3) {
      if (photoStatus.count === 0) {
        setPhotoError(translate("validation.photoRequired"));
        return;
      }
      setStep(4);
      return;
    }
    if (step === 5) return;
    const found = validateStep(step, values);
    if (Object.keys(found).length > 0) return refuse(found);
    setErrors({});
    setBusyAction("next");
    startTransition(async () => {
      const saved = await persist(STEP_ORDER.filter((each) => each <= step && each !== 3));
      setBusyAction(null);
      if (saved) setStep((now) => (now < 5 ? ((now + 1) as WizardStep) : now));
    });
  }

  function back() {
    clearNotices();
    setStep((now) => (now > 1 ? ((now - 1) as WizardStep) : now));
  }

  function keepDraft() {
    clearNotices();
    const input = draftInput(values, ALL_BOX_STEPS);
    const found = checkDraft(input);
    if (Object.keys(found).length > 0) {
      const first = stepsWithErrors(found)[0] ?? step;
      refuse(found);
      setStep(first);
      return;
    }
    setErrors({});
    setBusyAction("draft");
    startTransition(async () => {
      const saved = await persist(ALL_BOX_STEPS);
      setBusyAction(null);
      if (saved) {
        notify.success(words("notices.draftSavedTitle"), {
          description: words("notices.draftSavedBody"),
        });
      }
    });
  }

  function submit() {
    clearNotices();
    if (!listingId) return;
    setBusyAction("submit");
    startTransition(async () => {
      try {
        const result = await actions.submit({ listingId, idempotencyKey: submitKey });
        if (result.ok) {
          dropDraft(FORM_NAME, window.location.pathname);
          notify.success(words("notices.submitted"));
          router.push(doneHref);
          return;
        }
        showFailure(result);
      } catch {
        setAlert({ kind: "failed" });
      } finally {
        setBusyAction(null);
      }
    });
  }

  const errorSteps = stepsWithErrors(errors);
  const stepNames = [
    words("steps.basics.label"),
    words("steps.details.label"),
    words("steps.photos.label"),
    words("steps.description.label"),
    words("steps.review.label"),
  ];
  const descriptions = [
    words("steps.basics.description"),
    words("steps.details.description"),
    words("steps.photos.description"),
    words("steps.description.description"),
    words("steps.review.description"),
  ];
  const steps: Step[] = STEP_ORDER.map((number, index) => {
    const hasError = errorSteps.includes(number) || (number === 3 && photoError !== null);
    return {
      label: stepNames[index] ?? "",
      description: descriptions[index] ?? "",
      state: hasError ? "error" : number < step ? "done" : number === step ? "current" : "upcoming",
      ...(hasError ? { stateLabel: words("steps.needsAttention") } : {}),
    };
  });

  const working = pending || busyAction !== null;
  const bodyProps = {
    values,
    errors,
    onChange: change,
    headingRef,
    disabled: working,
  };

  let body: ReactNode;
  if (step === 1) body = <BasicsStep {...bodyProps} />;
  else if (step === 2) body = <DetailsStep {...bodyProps} />;
  else if (step === 3) {
    // The first Continue started the draft, so the photos always have a listing to belong to.
    body = listingId ? (
      <PhotosStepFrame headingRef={headingRef} error={photoError ?? undefined}>
        <PhotoUploaderConnected
          listingId={listingId}
          saved={savedPhotos}
          actions={actions.photos}
          returnPath={photosAt()}
          onStatus={onStatus}
        />
      </PhotosStepFrame>
    ) : null;
  } else if (step === 4) body = <DescriptionStep {...bodyProps} />;
  else {
    body = (
      <ReviewStep
        values={values}
        photoCount={photoStatus.count}
        headingRef={headingRef}
        onEdit={(target) => {
          clearNotices();
          setStep(target);
        }}
      />
    );
  }

  const alerts: ReactNode =
    sessionEnded || alert ? (
      <div className="flex flex-col gap-3">
        {sessionEnded ? (
          <SessionEndedAlert
            href={sessionEnded.href}
            onSignIn={() => saveDraft(FORM_NAME, window.location.pathname, toDraftValues(values))}
          />
        ) : null}
        {alert?.kind === "failed" ? (
          <Alert tone="danger" title={words("notices.failedTitle")}>
            {words("notices.failedBody")}
          </Alert>
        ) : null}
        {alert?.kind === "save" ? <Alert tone="danger">{words("notices.saveFailed")}</Alert> : null}
        {alert?.kind === "limit" ? <Alert tone="danger">{alert.text}</Alert> : null}
      </div>
    ) : null;

  return (
    <WizardShell
      title={words("title")}
      emphasis={words("titleEmphasis")}
      description={words("description")}
      steps={steps}
      progressLabel={words("progress", {
        current: step,
        total: 5,
        name: stepNames[step - 1] ?? "",
      })}
      alert={alerts}
      footer={
        <WizardFooter
          {...(step > 1
            ? { back: { label: words("actions.back"), onClick: back, disabled: working } }
            : {})}
          saveDraft={{
            label: words("actions.saveDraft"),
            onClick: keepDraft,
            disabled: working || photoStatus.busy,
          }}
          next={
            step === 5
              ? {
                  label:
                    busyAction === "submit" ? words("actions.submitting") : words("actions.submit"),
                  onClick: submit,
                  kind: "submit",
                  loading: busyAction === "submit",
                  disabled: working && busyAction !== "submit",
                }
              : {
                  label: words("actions.continue"),
                  onClick: next,
                  kind: "continue",
                  loading: busyAction === "next",
                  disabled: (working && busyAction !== "next") || (step === 3 && photoStatus.busy),
                }
          }
        />
      }
    >
      <div ref={cardRef} className="flex flex-col gap-5">
        {body}
      </div>
    </WizardShell>
  );
}
