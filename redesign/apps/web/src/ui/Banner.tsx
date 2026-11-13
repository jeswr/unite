import type { ReactNode } from 'react';

/** A full-width notice. `warn` for things that need attention; `info` otherwise. */
export function Banner({ tone = 'info', children, className = '' }: { tone?: 'info' | 'warn'; children: ReactNode; className?: string }) {
  const style = tone === 'warn' ? 'border-warn text-ink bg-white' : 'border-accent bg-accent-soft text-ink';
  return (
    <div role={tone === 'warn' ? 'alert' : 'note'} className={`rounded-ui border-l-4 border px-4 py-3 ${style} ${className}`}>
      {children}
    </div>
  );
}
