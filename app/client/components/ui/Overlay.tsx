"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

/**
 * The app's stacking order, in one place.
 *
 * **A z-index only orders siblings inside the same stacking context.** A page
 * header with its own gradient and transform, a sticky bar, a card that sets
 * `z-10` — each creates a context of its own, and anything rendered *inside*
 * one can never paint above a sibling of that context however large its number
 * is. That is why dialogs used to be covered by the search field and the status
 * select on half the pages, and why raising `z-50` to `z-[9999]` fixed nothing.
 *
 * So: every overlay portals out to `document.body` (`Overlay` below), where the
 * root stacking context is the only one in play, and reads its layer from here.
 * **Do not write a bare `z-*` class or a literal `zIndex` anywhere else.**
 *
 * The snackbar sits above dialogs deliberately: a save error raised by an open
 * form has to be readable over that form.
 */
export const Z_LAYERS = {
  sidebar: 20,
  stickyHeader: 30,
  /** Select menus and any other anchored popover. */
  dropdown: 40,
  dialog: 50,
  snackbar: 60,
} as const;

/* ---------------------------------------------------------------------------
 * Body scroll lock — module state, counted, deliberately not React state.
 *
 * A ConfirmDialog opened on top of a FormDialog is two overlays at once. With a
 * boolean, closing the inner one restored page scrolling while the form was
 * still open. The count is what makes the *outermost* close the one that
 * unlocks. It lives out here because it is one fact about the document, shared
 * by every instance, and nothing renders from it.
 * ------------------------------------------------------------------------ */

let lockCount = 0;
let restoreOverflow = "";

function lockBodyScroll() {
  if (lockCount === 0) {
    restoreOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  }
  lockCount += 1;
}

function unlockBodyScroll() {
  lockCount = Math.max(0, lockCount - 1);
  if (lockCount === 0) document.body.style.overflow = restoreOverflow;
}

/**
 * Open overlays, innermost last. Escape and the Tab trap act only for the
 * topmost one, so Escape over a stack closes the dialog on top rather than
 * every dialog at once.
 */
const overlayStack: string[] = [];

/** What Tab may land on inside a dialog. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/* ---------------------------------------------------------------------------
 * Overlay
 * ------------------------------------------------------------------------ */

const subscribeToNothing = () => () => {};

/**
 * True once rendering on the client. `createPortal` needs a real `document`,
 * which the server render has none of — and this answers false on the server
 * and true in the browser without an effect or a ref write, so it cannot
 * mismatch during hydration (CLAUDE.md §8 item 18).
 */
function useIsClient(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false,
  );
}

interface OverlayProps {
  open: boolean;
  /** Names the dialog for screen readers. */
  label: string;
  /**
   * Escape always calls this. A backdrop click calls it too unless
   * `closeOnBackdrop` is false — which is what a dialog holding unsaved work
   * wants.
   */
  onClose: () => void;
  closeOnBackdrop?: boolean;
  /**
   * `center` is the normal panel. `stretch` fills the screen below `md` and
   * centres above it, for a form too tall to float at 390px.
   */
  align?: "center" | "stretch";
  children: React.ReactNode;
}

/**
 * The one modal surface: a portal, a full-viewport backdrop, centred content,
 * a counted scroll lock, and focus that goes in on open and comes back out on
 * close.
 *
 * Everything modal goes through this — `ConfirmDialog`, `ViewDialog`,
 * `FormDialog` and the feature dialogs that used to hand-roll the same
 * `fixed inset-0 z-50` wrapper inline in the page. Inline is exactly the
 * problem: see `Z_LAYERS` above.
 *
 * The backdrop covers the sidebar as well as the page, so nothing behind it is
 * clickable — that is the whole of "modal", and it is not something a z-index
 * alone was ever going to give.
 */
export default function Overlay({
  open,
  label,
  onClose,
  closeOnBackdrop = true,
  align = "center",
  children,
}: OverlayProps) {
  const isClient = useIsClient();
  const id = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  // What to give focus back to. Captured on the render that *opens* the
  // dialog, which is the only moment it is still true: by commit time the
  // panel has mounted and a child's `autoFocus` (ConfirmDialog's Cancel) has
  // already taken focus, so an effect reading `document.activeElement` would
  // record that Cancel button and later "restore" focus to a node that is
  // about to be destroyed. This is the *adjusting state when a value changes*
  // pattern — a mirrored `wasOpen` compared in the render body, the same shape
  // `use-evaluation-template.ts` uses, and one of the two seeding points this
  // ruleset allows (CLAUDE.md §8 item 18). A ref would be the obvious tool and
  // is exactly what `react-hooks/refs` forbids here.
  const [wasOpen, setWasOpen] = useState(false);
  const [trigger, setTrigger] = useState<HTMLElement | null>(null);
  if (open !== wasOpen) {
    setWasOpen(open);
    setTrigger(
      open && document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null,
    );
  }

  // Scroll lock, focus and the overlay stack. Deliberately NOT keyed on
  // `onClose`: a parent re-rendering with a new inline callback must not
  // re-run this and re-steal focus. The listener below takes that dependency
  // instead, where re-attaching costs nothing.
  useEffect(() => {
    if (!open) return;
    const container = containerRef.current;
    if (!container) return;

    overlayStack.push(id);
    lockBodyScroll();

    // `autoFocus` inside the panel has already been applied by now (React sets
    // it at commit, before effects), so a dialog that named its own starting
    // element — ConfirmDialog's Cancel — keeps it. Otherwise focus goes to the
    // first thing in the panel, and failing that to the panel itself.
    if (!container.contains(document.activeElement)) {
      const first = container.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? container).focus();
    }

    return () => {
      unlockBodyScroll();
      const index = overlayStack.lastIndexOf(id);
      if (index !== -1) overlayStack.splice(index, 1);
      trigger?.focus();
    };
  }, [open, id, trigger]);

  // Escape, and keeping Tab inside the dialog.
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Only the dialog on top of the stack answers.
      if (overlayStack[overlayStack.length - 1] !== id) return;

      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const container = containerRef.current;
      if (!container) return;
      // offsetParent weeds out anything display:none — a collapsed section of
      // a form should not be a Tab stop.
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) {
        e.preventDefault();
        container.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || !container.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (active === last || !container.contains(active))
      ) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, id, onClose]);

  if (!open || !isClient) return null;

  const alignment =
    align === "stretch"
      ? "items-stretch md:items-center md:p-4"
      : "items-center p-4";

  return createPortal(
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      tabIndex={-1}
      style={{ zIndex: Z_LAYERS.dialog }}
      // mousedown, not click: a text selection that starts inside the panel and
      // ends on the backdrop would otherwise register as a backdrop click and
      // throw the dialog away.
      onMouseDown={(e) => {
        if (closeOnBackdrop && e.target === e.currentTarget) onClose();
      }}
      className={`fixed inset-0 flex justify-center bg-black/50 outline-none ${alignment}`}
    >
      {children}
    </div>,
    document.body,
  );
}
