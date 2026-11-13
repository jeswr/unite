// For Vercel's file tracing only (see apps/server/vercel-entry.mjs): names, in a branch that never
// runs, every package this TypeScript imports, so the tracer includes them where Node looks for them
// from here. apps/server/test/vercel.test.ts checks the list.
if (process.env.UNITE_TRACE_ONLY === 'never-set') {
  await Promise.all([import('zod')]);
}
