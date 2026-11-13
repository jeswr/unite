// The Vercel function's entry. Plain JavaScript: it registers tsx, which loads Unite's TypeScript
// at run time as `pnpm start` does, then hands each request to the app.
import { register } from 'tsx/esm/api';

register();
const { createHandler } = await import('./src/vercel.ts');

export default createHandler();
