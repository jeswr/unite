import type { DecisionsResponse, RegisterResponse, RoomsResponse, StatementsResponse } from '@unite/shared';
import { stableId } from '../../packages/shared/src/ids';
import { asRole, expect, noSidewaysScroll, RAW_ID, settle, signInAs, test } from './helpers';

/** Liam took part in the earning example, so he may see its group pages. */
const LIAM = stableId('per', 'earning/liam');

const WIDTHS = [375, 1280] as const;

/** Every route: one h1, no sideways scrolling at a phone's width or a laptop's, and no raw id in the text. */
test('every page has one heading, fits at 375 and 1280 px, and shows no raw ids', async ({ page }) => {
  test.setTimeout(180_000);
  await signInAs(page.request, LIAM);
  const get = async <T,>(path: string) => (await (await page.request.get(path)).json()) as T;
  const { statements } = await get<StatementsResponse>('/api/assemblies/earning-and-learning/statements');
  const rooms = await get<RoomsResponse>('/api/assemblies/earning-and-learning/rooms');
  const room = rooms.closed[0]?.id ?? rooms.others[0]?.id;
  const { decisions } = await get<DecisionsResponse>('/api/assemblies/volunteering-tool/decisions');
  const register = await get<RegisterResponse>('/api/register');
  expect(statements.length && room && decisions.length && register.filters.hosts.length).toBeTruthy();

  const participant = [
    '/',
    '/assemblies',
    '/a/earning-and-learning',
    '/a/volunteering-tool',
    '/a/ai-and-care',
    '/a/ai-and-care/pledge',
    '/a/making-unite-better',
    '/talk',
    '/a/earning-and-learning/talk',
    '/listening',
    '/a/earning-and-learning/picture',
    '/a/earning-and-learning/statements',
    `/a/earning-and-learning/statements/${statements[0]!.id}`,
    '/a/earning-and-learning/rooms',
    `/a/earning-and-learning/rooms/${room}`,
    '/a/earning-and-learning/priorities',
    '/a/volunteering-tool/decisions',
    `/a/volunteering-tool/decisions/${decisions[0]!.id}`,
    '/register',
    `/hosts/${register.filters.hosts[0]!.slug}`,
    '/me',
    '/feedback',
    '/feedback/not-a-real-token',
    '/changes',
    '/how',
    '/how/rules',
    '/how/prompts',
    '/approve/not-a-real-token',
    '/talk/not-a-real-conversation',
    '/no-such-page',
  ];

  const look = async (path: string) => {
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await settle(page);
      await expect(page.getByRole('heading', { level: 1 }), `${path} has one h1`).toHaveCount(1);
      await noSidewaysScroll(page, `${path} at ${width}px`);
      const text = await page.locator('body').innerText();
      expect(text, `${path} shows a raw id`).not.toMatch(RAW_ID);
    }
  };

  for (const path of participant) await look(path);
  await asRole(page.request, 'host');
  await look('/host');
  await look(`/a/volunteering-tool/decisions/${decisions[1]!.id}`);
  await asRole(page.request, 'steward');
  await look('/steward');
  await look(`/a/volunteering-tool/decisions/${decisions[2]!.id}`);
});
