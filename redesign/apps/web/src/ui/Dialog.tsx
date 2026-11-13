import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from './Button';

/** A modal dialog on the native <dialog> element. */
export function Dialog({ open, title, onClose, children }: { open: boolean; title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
    }
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={onClose}
      className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-ui border border-line p-0 text-ink backdrop:bg-black/40"
    >
      {open && (
        <div className="p-5">
          <h2 id={titleId} className="mb-3">
            {title}
          </h2>
          <div>{children}</div>
          <div className="mt-5">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
