// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// The unite shared component system (UI.1 — docs UI-uplift §4.3). A small,
// consistent, theme-aware set of presentational primitives extracted from the
// markup that had been copy-pasted across ~8 views: surfaces (Card / Panel /
// SectionHeader / ViewHeader), status (Badge / ScopeStatusBadge), stats
// (StatTile / StatGrid), states (EmptyState / LockedGate / LoadingRows /
// Notice), controls (Segmented), and the shared reception DistributionBar.
//
// Every primitive renders the canonical CSS classes in styles.css (light/dark
// aware via the app-shell OKLCH token layer), so a view built from these reads
// identically to the hand-written views that use the same classes — the point
// is to kill the copy-paste and the ad-hoc inline styling, not to fork the look.
// Pure presentation: no lib imports beyond the ClusterDistribution shape.

import type { CSSProperties, ReactNode } from "react";
import type { ClusterDistribution } from "../lib/ranking.js";

// ── Surfaces ─────────────────────────────────────────────────────────────────

/** A raised content card. */
export function Card({
  children,
  className,
  style,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  as?: "div" | "li";
}): React.JSX.Element {
  return (
    <Tag className={className ? `card ${className}` : "card"} style={style}>
      {children}
    </Tag>
  );
}

/** A framed section panel (more padding than a card). */
export function Panel({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}): React.JSX.Element {
  return (
    <section className={className ? `panel ${className}` : "panel"} style={style}>
      {children}
    </section>
  );
}

/**
 * A titled sub-section header (an h3) with an optional sub-line and trailing
 * actions — replaces the `<h3 className="view-title" style={{fontSize…}}>`
 * inline-styled pattern that was repeated in every panel.
 */
export function SectionHeader({
  title,
  sub,
  actions,
  id,
}: {
  title: ReactNode;
  sub?: ReactNode;
  actions?: ReactNode;
  id?: string;
}): React.JSX.Element {
  return (
    <div className="u-section-head">
      <div className="u-section-head-text">
        <h3 className="u-section-title" id={id}>
          {title}
        </h3>
        {sub && <p className="u-section-sub">{sub}</p>}
      </div>
      {actions && <div className="u-section-actions">{actions}</div>}
    </div>
  );
}

/**
 * A top-of-view header: the h2 title + an optional lede paragraph, with
 * optional trailing actions laid out in a wrapping row.
 */
export function ViewHeader({
  title,
  lede,
  actions,
  children,
}: {
  title: ReactNode;
  lede?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <header className="u-view-head">
      <div className="u-view-head-main">
        <div>
          <h2 className="view-title">{title}</h2>
          {lede && <p className="view-lede">{lede}</p>}
        </div>
        {actions && <div className="u-view-head-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}

// ── Badges / chips ───────────────────────────────────────────────────────────

export type BadgeTone = "neutral" | "petrol" | "gold" | "res" | "con" | "demo";

const BADGE_TONE_CLASS: Record<BadgeTone, string> = {
  neutral: "badge",
  petrol: "badge concept",
  gold: "badge gold",
  res: "badge res",
  con: "badge con",
  demo: "badge demo",
};

/** A pill status/label. `tone` maps to the design's stance/accent palette. */
export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: BadgeTone;
  children: ReactNode;
  title?: string;
}): React.JSX.Element {
  return (
    <span className={BADGE_TONE_CLASS[tone]} title={title}>
      {children}
    </span>
  );
}

/** The honest scope-maturity badge (design/04 status field). */
export function ScopeStatusBadge({ status }: { status: "live" | "preview" }): React.JSX.Element {
  return status === "live" ? (
    <span className="badge res u-status-badge" title="the working Stage-1 deliberation client">
      <span className="u-dot" aria-hidden="true" /> Live
    </span>
  ) : (
    <span
      className="badge gold u-status-badge"
      title="the scope's machinery is progressively unlocking"
    >
      <span className="u-dot" aria-hidden="true" /> Preview
    </span>
  );
}

// ── Stats ────────────────────────────────────────────────────────────────────

/** A grid of stat tiles. */
export function StatGrid({
  children,
  label,
}: {
  children: ReactNode;
  label?: string;
}): React.JSX.Element {
  return (
    <section className="kpis" aria-label={label}>
      {children}
    </section>
  );
}

/** One headline number + its label. */
export function StatTile({
  value,
  label,
  accent,
}: {
  value: ReactNode;
  label: ReactNode;
  accent?: boolean;
}): React.JSX.Element {
  return (
    <div className={accent ? "kpi kpi-accent" : "kpi"}>
      <div className="kpi-n">{value}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}

// ── States: empty / locked / loading / notice ────────────────────────────────

/** The designed empty state — a title + explanatory body, optionally with a badge. */
export function EmptyState({
  title,
  badge,
  children,
}: {
  title: ReactNode;
  badge?: ReactNode;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="empty">
      {badge}
      <span className="empty-title">{title}</span>
      {children}
    </div>
  );
}

/** The Phase-2 trust-gate locked state — a solid gold accent, not an error. */
export function LockedGate({
  title,
  children,
}: {
  title: ReactNode;
  children?: ReactNode;
}): React.JSX.Element {
  return (
    <div className="empty locked">
      <span className="empty-title">{title}</span>
      {children}
    </div>
  );
}

/** A shimmering skeleton list while an aggregate loads. */
export function LoadingRows({ count = 2 }: { count?: number }): React.JSX.Element {
  return (
    <ul className="cards" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative skeleton, order is the identity.
        <li key={i} className="skel" />
      ))}
    </ul>
  );
}

export type NoticeTone = "info" | "ok" | "error";

/** An inline status notice (info / ok / error). */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: NoticeTone;
  children: ReactNode;
}): React.JSX.Element {
  return <p className={`notice ${tone}`}>{children}</p>;
}

// ── Controls ─────────────────────────────────────────────────────────────────

/** A segmented single-choice control (generalises the opinion-groups selector). */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  format,
}: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  format?: (o: T) => ReactNode;
}): React.JSX.Element {
  return (
    <fieldset className="segmented" aria-label={label}>
      {options.map((o) => (
        <button
          type="button"
          key={String(o)}
          aria-pressed={value === o}
          onClick={() => onChange(o)}
        >
          {format ? format(o) : o}
        </button>
      ))}
    </fieldset>
  );
}

// ── Step wizard (the multi-step compose stepper) ─────────────────────────────

/** One step in a {@link StepWizard} — an id + its rendered chip label. */
export interface WizardStep<Id extends string = string> {
  readonly id: Id;
  readonly label: ReactNode;
}

/**
 * The shared compose stepper — generalises the S4 NarrativeCompose 4-step nav
 * (the best-structured flow in the app) into the pattern every multi-step
 * compose form uses. It renders ONLY the numbered step chips; the step panels
 * stay in the owning view. `canReach(index, currentIndex)` decides which steps
 * are navigable (default: any earlier step + the immediate next one); a step
 * past the reachable frontier renders `disabled`, exactly like the hand-written
 * `chip-row` step nav it replaces — so a migrated form reads identically.
 */
export function StepWizard<Id extends string>({
  steps,
  current,
  onStep,
  canReach,
  label = "steps",
}: {
  steps: readonly WizardStep<Id>[];
  current: Id;
  onStep: (id: Id) => void;
  /** Which steps are navigable from `currentIndex`; defaults to backward + next. */
  canReach?: (index: number, currentIndex: number) => boolean;
  label?: string;
}): React.JSX.Element {
  const currentIndex = steps.findIndex((s) => s.id === current);
  const reachable = canReach ?? ((i, cur) => i <= cur + 1);
  return (
    <nav className="chip-row" aria-label={label}>
      {steps.map((s, i) => (
        <button
          type="button"
          key={s.id}
          className="chip"
          aria-pressed={s.id === current}
          disabled={!reachable(i, currentIndex)}
          onClick={() => onStep(s.id)}
        >
          {s.label}
        </button>
      ))}
    </nav>
  );
}

// ── Shared reception distribution bar (also imported by the Room via Bridging) ─

/** Stable opinion-group display names. */
export const GROUP_NAMES = ["Group A", "Group B", "Group C", "Group D"] as const;

/** The colour of opinion group `g` (the validated categorical cluster ramp). */
export function clusterColor(g: number): string {
  return `var(--u-cluster-${g % 4})`;
}

/** The plain-language name of opinion group `g`. */
export function groupName(g: number): string {
  return GROUP_NAMES[g] ?? `Group ${g + 1}`;
}

/**
 * One opinion group's reception bar: a stacked resonates / conflicts / unsure
 * bar with the raw counts. Shared by Common ground and the Convergence Room —
 * a single source of truth for how a statement's per-group reception reads.
 */
export function DistributionBar({
  dist,
  index,
}: {
  dist: ClusterDistribution;
  index: number;
}): React.JSX.Element {
  const total = Math.max(dist.seen, 1);
  const pct = (n: number) => `${(n / total) * 100}%`;
  return (
    <div className="dist">
      <span className="dist-label">
        <span className="swatch" style={{ background: clusterColor(index) }} aria-hidden="true" />
        {groupName(index)}
      </span>
      <div
        className="dist-bar"
        title={`resonates ${dist.resonates} · conflicts ${dist.conflicts} · unsure ${dist.unsure} · seen ${dist.seen} of ${dist.size}`}
      >
        <span className="seg seg-res" style={{ width: pct(dist.resonates) }} />
        <span className="seg seg-con" style={{ width: pct(dist.conflicts) }} />
        <span className="seg seg-uns" style={{ width: pct(dist.unsure) }} />
      </div>
      <span className="dist-counts">
        {dist.resonates}✓ {dist.conflicts}✕ {dist.unsure}? · {dist.seen}/{dist.size}
      </span>
    </div>
  );
}
