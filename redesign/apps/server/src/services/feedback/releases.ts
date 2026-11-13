import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { rootDir } from '../../config.js';

/** `redesign/RELEASES.json` (section 4): what changed in each release, in plain words. */
export const ReleaseSchema = z.strictObject({
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  changes: z.array(
    z.strictObject({
      text: z.string().min(1),
      affects: z.array(z.enum(['participants', 'hosts', 'stewards'])).min(1),
      question: z.string().min(1).optional(),
    }),
  ),
});
export type Release = z.infer<typeof ReleaseSchema>;
export type ReleaseChange = Release['changes'][number];

export const RELEASES_FILE = path.join(rootDir, 'RELEASES.json');

/** Compares two versions "a.b.c" numerically. */
export function compareVersions(a: string, b: string): number {
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (x[i] ?? 0) - (y[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

let cached: Release[] | undefined;

/** The releases, newest first. Read once and checked against the schema. */
export function loadReleases(file = RELEASES_FILE): Release[] {
  if (file === RELEASES_FILE && cached) return cached;
  const parsed = z.array(ReleaseSchema).parse(JSON.parse(fs.readFileSync(file, 'utf8')));
  const sorted = [...parsed].sort((a, b) => compareVersions(b.version, a.version));
  if (file === RELEASES_FILE) cached = sorted;
  return sorted;
}

export interface ChangeSince extends ReleaseChange {
  version: string;
  /** Its position in its release's list, from 0. */
  index: number;
}

/** Every change in a release newer than `sinceVersion`, oldest release first; all changes when it is not given. */
export function changesSince(releases: Release[], sinceVersion?: string): ChangeSince[] {
  return [...releases]
    .filter((r) => !sinceVersion || compareVersions(r.version, sinceVersion) > 0)
    .sort((a, b) => compareVersions(a.version, b.version))
    .flatMap((r) => r.changes.map((c, index) => ({ ...c, version: r.version, index })));
}
