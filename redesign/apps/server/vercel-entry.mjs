// The Vercel function's entry. Plain JavaScript: it registers tsx, which loads Unite's TypeScript
// at run time as `pnpm start` does, then hands each request to the app.
import { register } from 'tsx/esm/api';

// Vercel finds the files a function needs by tracing its imports, and it cannot read the TypeScript
// that tsx loads, so it would miss the packages that code imports. Naming them here, in a branch that
// never runs, makes the tracer include each package and its own files (PGlite's wasm is also listed
// in vercel.json's includeFiles). test/vercel.test.ts checks that every package the code imports is here.
if (process.env.UNITE_TRACE_ONLY === 'never-set') {
  await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/zod'),
    import('@electric-sql/pglite'),
    import('@vercel/blob'),
    import('cookie-parser'),
    import('express'),
    import('express-rate-limit'),
    import('pg'),
    import('zod'),
    import('@unite/shared'),
    import('../../packages/shared/vercel-trace.mjs'),
  ]);
}

register();
const { createHandler } = await import('./src/vercel.ts');

export default createHandler();
