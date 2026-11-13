import type { ReactNode } from 'react';

/** What a page shows when there is nothing to show yet. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-ui border border-dashed border-muted px-4 py-6">
      <h2 className="mb-2">{title}</h2>
      {children && <div className="text-muted">{children}</div>}
    </div>
  );
}
