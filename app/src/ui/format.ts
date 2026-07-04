// AUTHORED-BY Claude Fable 5 (PSS agent)
//
// Tiny presentation helpers — pure, deterministic, unit-testable.

/** Initials for an avatar (first letters of up to two words). */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? (words[words.length - 1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

/** The avatar hue palette (matches the cluster palette family). */
const AVATAR_COLORS = [
  "var(--u-cluster-0)",
  "var(--u-cluster-1)",
  "var(--u-cluster-2)",
  "var(--u-cluster-3)",
  "var(--u-res)",
  "var(--u-slate)",
] as const;

/** A stable colour for a key (name/WebID) — deterministic FNV-1a bucket. */
export function avatarColor(key: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return AVATAR_COLORS[(h >>> 0) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

const DATE_FMT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });
const DATE_FMT_Y = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

/** Compact date for a card ("2 Jun", with the year when it isn't this year). */
export function formatDate(iso: string, now: Date = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const d = new Date(t);
  return d.getFullYear() === now.getFullYear() ? DATE_FMT.format(d) : DATE_FMT_Y.format(d);
}
