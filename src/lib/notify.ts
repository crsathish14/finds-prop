/**
 * Show a short message in the Toaster (src/components/patterns/toaster.tsx). Text is passed in
 * already translated (R-FE-21). Use it for confirmations ("Saved", "Removed from saved") and an
 * Undo; never as the only place an error appears, because a toast disappears.
 */
import { toast } from "sonner";

type NotifyOptions = { description?: string };

type UndoOptions = NotifyOptions & {
  /** The Undo button text, already translated. */
  actionLabel: string;
  onUndo: () => void;
};

export const notify = {
  success(message: string, options: NotifyOptions = {}) {
    return toast.success(message, options);
  },
  error(message: string, options: NotifyOptions = {}) {
    return toast.error(message, options);
  },
  info(message: string, options: NotifyOptions = {}) {
    return toast.info(message, options);
  },
  /** A confirmation with an Undo button, for example after removing a saved home. */
  undo(message: string, { actionLabel, onUndo, ...options }: UndoOptions) {
    return toast(message, { ...options, action: { label: actionLabel, onClick: () => onUndo() } });
  },
  dismiss(id?: string | number) {
    toast.dismiss(id);
  },
};
