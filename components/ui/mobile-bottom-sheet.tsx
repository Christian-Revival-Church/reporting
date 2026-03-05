"use client";

import { useEffect } from "react";

type MobileBottomSheetProps = {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
};

export function MobileBottomSheet({ open, title, onClose, children }: MobileBottomSheetProps) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-slate-900/40 p-3 md:hidden">
      <button
        type="button"
        aria-label="Close details"
        className="absolute inset-0"
        onClick={onClose}
      />
      <div className="relative max-h-[85vh] w-full overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] shadow-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-base font-semibold text-slate-900">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 px-3 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Close
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
