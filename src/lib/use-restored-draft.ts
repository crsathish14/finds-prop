import { useEffect, useSyncExternalStore } from "react";
import { announceDraftOnce, takeDraft, type DraftValues } from "./form-draft";
import { notify } from "./notify";

const never = () => () => undefined;
const nothing = (): DraftValues | null => null;

/**
 * The answers a visitor typed before signing in again (S5-T07), for the form named `form` on this page, or
 * `null`. It is `null` on the server and on the first paint, then the kept answers once the page is in
 * the browser, so the form can start again with them (give it a new `key` when they appear). The same
 * object comes back on every draw, so it is safe to use as a dependency.
 */
export function useRestoredDraft(form: string): DraftValues | null {
  return useSyncExternalStore(never, () => takeDraft(form, window.location.pathname), nothing);
}

/**
 * Says "we kept what you typed" once, in the first form on the page that restored answers (the card and the
 * phone's sheet may both have them). `message` is the words, already translated.
 */
export function useRestoredNotice(form: string, restored: DraftValues | null, message: string) {
  useEffect(() => {
    if (restored && announceDraftOnce(form, window.location.pathname)) notify.info(message);
  }, [form, restored, message]);
}
