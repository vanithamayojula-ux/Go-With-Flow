import React, { useSyncExternalStore } from 'react';

export interface ToastItem {
  id: number;
  msg: string;
  /** How many times this exact message fired while it was on screen/queued. */
  count: number;
  /**
   * Fired during active play. Run toasts wait (hidden) while a menu or modal
   * is up and are dropped at game over / run start; the rest are feedback
   * for an action taken in the open screen and show over it.
   */
  run: boolean;
}

/** Phones (portrait or short landscape): matches the `compact:` CSS variant in index.css. */
export const COMPACT_HUD_QUERY = '(max-width: 639px), (max-height: 500px)';

function subscribeCompact(cb: () => void): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia(COMPACT_HUD_QUERY);
  mql.addEventListener('change', cb);
  return () => mql.removeEventListener('change', cb);
}
function getCompact(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(COMPACT_HUD_QUERY).matches
    : false;
}

/** True on phone-sized viewports; re-renders only when that flips. */
export function useCompactHud(): boolean {
  return useSyncExternalStore(subscribeCompact, getCompact, () => false);
}

interface ToastStackProps {
  /** Toasts to show, oldest first (App caps this at the visible limit). */
  toasts: ToastItem[];
  /**
   * 'run': during play, in a band clear of the road ahead (right side under
   * the toolbar on desktop, one line under the HUD row on phones).
   * 'overlay': a menu/modal is up; a small pill at the top edge, above it.
   */
  placement: 'run' | 'overlay';
}

/**
 * Stacked notification toasts. LEVEL UP / ACHIEVEMENT / ENTERING used to share
 * a single slot and overwrite each other; now each gets its own row.
 */
export const ToastStack: React.FC<ToastStackProps> = ({ toasts, placement }) => {
  if (toasts.length === 0) return null;

  const position =
    placement === 'overlay'
      ? // Above modals (z-50), hugging the top edge.
        'z-[60] top-[max(0.5rem,env(safe-area-inset-top))] left-1/2 -translate-x-1/2 items-center w-[min(92vw,24rem)]'
      : // Below every modal/menu (z-40+), never over the vanishing point.
        'z-30 items-end right-[max(1.25rem,env(safe-area-inset-right))] w-[min(20rem,40vw)] ' +
        'top-[calc(max(1.25rem,env(safe-area-inset-top))+7.5rem)] lg:top-[calc(max(1.25rem,env(safe-area-inset-top))+3.25rem)] ' +
        'compact:items-center compact:left-[max(0.75rem,env(safe-area-inset-left))] compact:right-[max(0.75rem,env(safe-area-inset-right))] compact:w-auto ' +
        'compact:top-[calc(max(0.5rem,env(safe-area-inset-top))+3.75rem)]';

  return (
    <div
      className={`fixed flex flex-col gap-1 pointer-events-none font-mono ${position}`}
      data-toast-stack={placement}
      role="status"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className="gwf-pill-in max-w-full truncate px-2.5 py-0.5 rounded-md bg-black/80 border border-cyan-500/50 text-cyan-200 text-[11px] leading-[1.35rem] font-semibold shadow-md shadow-cyan-950/40"
        >
          {t.msg}
          {t.count > 1 && <span className="ml-1.5 text-white/70">x{t.count}</span>}
        </div>
      ))}
    </div>
  );
};
