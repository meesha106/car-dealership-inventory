import { useLayoutEffect, useRef, type KeyboardEvent } from "react";

export interface ActionModalState {
  title: string;
  message: string;
  kind: "success" | "error";
}

interface ActionModalProps {
  modal: ActionModalState;
  onClose: () => void;
  fallbackFocusRef: { current: HTMLElement | null };
}

export function ActionModal({
  modal,
  onClose,
  fallbackFocusRef,
}: ActionModalProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useLayoutEffect(() => {
    const previousFocus = document.activeElement;
    closeButtonRef.current?.focus();
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      } else {
        fallbackFocusRef.current?.focus();
      }
    };
  }, [fallbackFocusRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }

    if (event.key === "Tab") {
      event.preventDefault();
      closeButtonRef.current?.focus();
    }
  }

  const isSuccess = modal.kind === "success";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-[2px]"
      onKeyDown={handleKeyDown}
    >
      <section
        aria-labelledby="action-modal-title"
        aria-modal="true"
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl sm:p-7"
        role="dialog"
      >
        <div className="flex items-start gap-4">
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
              isSuccess
                ? "bg-emerald-100 text-emerald-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {isSuccess ? "✓" : "!"}
          </span>
          <div className="min-w-0 flex-1">
            <h2
              className="text-lg font-semibold tracking-tight text-slate-950"
              id="action-modal-title"
            >
              {modal.title}
            </h2>
            <p className="mt-2 break-words text-sm leading-6 text-slate-600">
              {modal.message}
            </p>
          </div>
        </div>
        <div className="mt-6 flex justify-end">
          <button
            className="min-h-10 rounded-lg bg-slate-950 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            Close
          </button>
        </div>
      </section>
    </div>
  );
}
