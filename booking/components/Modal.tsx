'use client';

import { useEffect, useRef } from 'react';

/**
 * Built on the native <dialog> with showModal(), which brings the parts
 * people usually rebuild badly: focus is trapped inside, Escape closes,
 * the rest of the page goes inert to screen readers, and focus returns
 * to whatever opened it.
 *
 * React state stays the single source of truth. The dialog is never
 * closed directly; Escape and backdrop clicks ask the caller to flip
 * `open`, and an effect does the closing. Otherwise the two disagree
 * and the dialog will not reopen.
 */
export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  error,
  busy = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Shown pinned above the actions, never inside the scrolling body. */
  error?: string | null;
  busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      className="modal"
      ref={ref}
      aria-labelledby="modal-title"
      onCancel={(e) => {
        // Always take over the default close so React drives it. While a
        // save is in flight, swallow it entirely rather than leaving the
        // caller wondering whether the write happened.
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        // A click that lands on the dialog itself rather than its
        // contents is a click on the backdrop.
        if (e.target === ref.current && !busy) onClose();
      }}
    >
      <div className="modal-head">
        <h2 className="q" id="modal-title">{title}</h2>
        <button
          type="button"
          className="modal-x"
          onClick={onClose}
          disabled={busy}
          aria-label="Close"
        >
          <span aria-hidden="true">&times;</span>
        </button>
      </div>

      <div className="modal-body">{children}</div>

      {/* The error sits with the button that caused it. Left in the body it
          renders below the fold on a long form, so a rejected save looks
          like nothing happened at all. */}
      {(footer || error) && (
        <div className="modal-foot">
          {error && <p className="field-error" role="alert">{error}</p>}
          {footer}
        </div>
      )}
    </dialog>
  );
}
