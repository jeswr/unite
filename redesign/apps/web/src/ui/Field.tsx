import { cloneElement, isValidElement, useId, type ReactElement, type ReactNode } from 'react';

interface Props {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  /** One input, textarea or select. It is given an id and aria-describedby. */
  children: ReactElement<Record<string, unknown>>;
}

export const inputClass = 'block w-full rounded-ui border border-muted bg-white px-3 py-2 text-base text-ink';

/** A labelled control with an optional hint and error. */
export function Field({ label, hint, error, children }: Props) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;
  const control = isValidElement(children)
    ? cloneElement(children, { id, 'aria-describedby': describedBy, 'aria-invalid': error ? true : undefined })
    : children;
  return (
    <div className="mb-5">
      <label htmlFor={id} className="block font-bold mb-1">
        {label}
      </label>
      {hint && (
        <p id={hintId} className="text-muted mb-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="text-warn font-bold mb-2">
          {error}
        </p>
      )}
      {control}
    </div>
  );
}
