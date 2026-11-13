import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** The `redesign/` folder. */
export const rootDir = path.resolve(here, '../../..');

function bool(v: string | undefined, dflt: boolean): boolean {
  if (v === undefined || v.trim() === '') return dflt;
  return ['1', 'true', 'yes', 'on'].includes(v.trim().toLowerCase());
}

/** A non-negative dollar amount; anything else (unset, blank, "abc", -1) gives the default. */
function usd(v: string | undefined, dflt: number): number {
  if (v === undefined || v.trim() === '') return dflt;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : dflt;
}

export const DEFAULT_MODEL = 'claude-opus-5-5';

export interface Config {
  production: boolean;
  port: number;
  /** Set: the Claude interviewer and synthesis are on. Unset: scripted mode. */
  anthropicKey?: string;
  model: string;
  aiDailyUsd: number;
  aiMonthlyUsd: number;
  /** Postgres. Unset: PGlite at dataDir. */
  databaseUrl?: string;
  /** PGlite's folder, or 'memory'. */
  dataDir: string;
  secret: string;
  hostCode: string;
  stewardCode: string;
  /** Seeds the examples on an empty store and shows the role switcher. */
  demo: boolean;
  /** Fixed clock (ISO date-time). */
  now?: string;
  /** The built web app, served in production. */
  webDist: string;
  /** Off only in tests that make many writes. */
  rateLimits: boolean;
  /** Test-only routes (signing in as a seeded person): on only when NODE_ENV is "test". */
  testRoutes: boolean;
  /** Vercel Blob token (BLOB_READ_WRITE_TOKEN). Set: each sent feedback is also kept as a JSON file there. */
  blobToken?: string;
}

/**
 * All configuration comes from the environment (section 2). Production refuses to start without its
 * secrets; in demo mode the host and steward passcodes default to the public demo ones.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production';
  const demo = bool(env.UNITE_DEMO, !production);
  /** Required in production; `demoValue` also stands in production when demo mode is on. */
  const required = (name: string, devValue: string, demoValue?: string) => {
    const v = env[name]?.trim();
    if (v) return v;
    if (production && demo && demoValue !== undefined) return demoValue;
    if (production) throw new Error(`${name} must be set in production.`);
    return devValue;
  };
  const dataDir = env.UNITE_DATA_DIR?.trim() || path.join(rootDir, '.data');
  const now = env.UNITE_NOW?.trim() || undefined;
  if (now && Number.isNaN(new Date(now).getTime())) throw new Error(`UNITE_NOW is not a date-time: ${now}`);
  return {
    production,
    port: Number(env.PORT ?? 4310),
    anthropicKey: env.ANTHROPIC_API_KEY?.trim() || undefined,
    model: env.UNITE_MODEL?.trim() || DEFAULT_MODEL,
    aiDailyUsd: usd(env.UNITE_AI_DAILY_USD, 5),
    aiMonthlyUsd: usd(env.UNITE_AI_MONTHLY_USD, 40),
    databaseUrl: env.DATABASE_URL?.trim() || undefined,
    dataDir: dataDir === 'memory' ? 'memory' : path.resolve(dataDir),
    secret: required('UNITE_SECRET', 'unite-dev-only-secret-change-me'),
    // In demo mode the role switcher signs in with these public passcodes, so they default to them.
    hostCode: required('UNITE_HOST_CODE', 'host', 'host'),
    stewardCode: required('UNITE_STEWARD_CODE', 'steward', 'steward'),
    demo,
    now,
    webDist: path.join(rootDir, 'apps/web/dist'),
    rateLimits: bool(env.UNITE_RATE_LIMITS, true),
    testRoutes: env.NODE_ENV === 'test',
    blobToken: env.BLOB_READ_WRITE_TOKEN?.trim() || undefined,
  };
}
