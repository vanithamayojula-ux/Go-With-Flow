import React from 'react';

export interface ToastItem {
  id: number;
  msg: string;
  /** How many times this exact message fired while it was on screen/queued. */
  count: number;
}

interface ToastStackProps {
  /** Toasts to show, oldest first (App caps this at the visible limit). */
  toasts: ToastItem[];
}

/**
 * Stacked notification toasts. LEVEL UP / ACHIEVEMENT / ENTERING used to share
 * a single slot and overwrite each other; now each gets its own row.
 */
export const ToastStack: React.FC<ToastStackProps> = ({ toasts }) => {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed top-[22vh] left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-1.5 w-[min(92vw,28rem)] pointer-events-none font-mono"
      role="status"
      aria-live="polite"
    >
      {toasts.map(t => (
        <div
          key={t.id}
          className="max-w-full px-3.5 py-1 rounded-md bg-black/90 border border-cyan-500/60 text-cyan-300 text-xs font-bold text-center shadow-lg shadow-cyan-950/40"
        >
          {t.msg}
          {t.count > 1 && <span className="ml-1.5 text-white/70">x{t.count}</span>}
        </div>
      ))}
    </div>
  );
};
