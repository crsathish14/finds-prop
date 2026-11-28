/**
 * The on-screen keyboard of a phone, as the chat page treats it (owner, 28 Nov 2026: the keyboard stayed open after
 * Send and had to be closed by hand).
 *
 * After a message is sent the cursor used to be put back in the message box, which is right for a laptop keyboard
 * (focus must not fall onto a Send button that turns off) and wrong on a touch screen, where it keeps the keyboard up.
 * On a touch screen the cursor now leaves the box when a message is sent, and the keyboard closes by itself.
 */

/** How long after a send the page waits for the screen to grow back, in milliseconds. */
const SETTLE_WINDOW_MS = 1000;

/** How long the screen has to stay still before the page scrolls to the newest words, in milliseconds. */
const QUIET_MS = 100;

/**
 * True when the main way of pointing is a finger: a phone, or a tablet without a mouse. A laptop with a touch screen
 * and a mouse reports a fine pointer, so it keeps its cursor in the box.
 */
export function isTouchScreen(): boolean {
  return window.matchMedia?.("(pointer: coarse)").matches ?? false;
}

/** The part of `window.visualViewport` this file uses (kept small so a test can stand in for it). */
type ViewportEvents = Pick<EventTarget, "addEventListener" | "removeEventListener">;

/**
 * Runs `onSettled` once after the screen has changed size and stayed still for a moment: the keyboard closing makes
 * the visible area taller, and the chat then scrolls to the newest words again so they are not left behind. It
 * gives up after a second if the size never changes (no keyboard was open). Returns a function that cancels it.
 */
export function afterKeyboardCloses(
  onSettled: () => void,
  viewport: ViewportEvents | null | undefined = window.visualViewport,
): () => void {
  // An old browser, or a test page, has no visual viewport: nothing to wait for.
  if (viewport === null || viewport === undefined) return () => undefined;
  let quiet: ReturnType<typeof setTimeout> | undefined;
  const stop = () => {
    viewport.removeEventListener("resize", onResize);
    clearTimeout(quiet);
    clearTimeout(giveUp);
  };
  const onResize = () => {
    clearTimeout(quiet);
    quiet = setTimeout(() => {
      stop();
      onSettled();
    }, QUIET_MS);
  };
  const giveUp = setTimeout(stop, SETTLE_WINDOW_MS);
  viewport.addEventListener("resize", onResize);
  return stop;
}
