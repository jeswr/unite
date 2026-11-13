import type { ReactNode } from 'react';

/** A hairline box. No shadow. */
export function Card({ children, className = '', as: As = 'div' }: { children: ReactNode; className?: string; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <As className={`rounded-ui border border-line bg-white p-4 ${className}`}>{children}</As>;
}
