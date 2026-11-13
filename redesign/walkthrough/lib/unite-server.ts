/**
 * The Unite a recording runs against: the real server (apps/server), booted and seeded the
 * same way `pnpm start` does it, plus one thing only a recording needs. The live-room
 * chapter wants a room on the "AI tools as a basic skill" statement that is open now, with
 * the viewer in it, and the viewer is a person who only exists once the recording has
 * started. So this server answers one more request, POST /__walkthrough/live-room, which
 * opens the seed's scheduled room on that statement with the viewer as one of its six
 * members, through the same store and facilitator code the app uses.
 *
 * The request needs the token the recorder passes in WALKTHROUGH_FIXTURE_TOKEN, and the
 * route doesn't exist without it. Nothing else about the app changes: every other request
 * goes to the app untouched, and the other members' messages are posted through the app's
 * own message endpoint, as those people (see liveRoom in ../scenes.ts).
 */
import http from 'node:http';
import { createApp } from '../../apps/server/src/app.ts';
import { boot } from '../../apps/server/src/boot.ts';
import { loadConfig } from '../../apps/server/src/config.ts';
import type { Deps } from '../../apps/server/src/deps.ts';
import { EARNING_IDS } from '../../apps/server/src/seed/earning.ts';
import { checkFacilitator } from '../../apps/server/src/services/rooms/rooms.ts';
import { bumpVersion } from '../../apps/server/src/version.ts';
import { LIVE_ROOM_MEMBERS } from './live-room.ts';

const FIXTURE_PATH = '/__walkthrough/live-room';

/**
 * Opens the scheduled room on the AI-tools statement now, for 45 minutes, with `viewerId`
 * among its members (in the place given by LIVE_ROOM_MEMBERS), and lets the facilitator
 * post its welcome as it does when a steward opens a room.
 */
async function openLiveRoom(deps: Deps, viewerId: string) {
  const room = await deps.store.get('rooms', EARNING_IDS.roomS5);
  if (!room) throw new Error('The seed has no scheduled room on the AI-tools statement');
  const viewer = await deps.store.get('persons', viewerId);
  if (!viewer) throw new Error(`No person ${viewerId}`);
  const memberIds = LIVE_ROOM_MEMBERS.map((key) => (key === 'viewer' ? viewerId : EARNING_IDS.person(key)));
  const start = deps.clock.now().getTime();
  const opened = { ...room, memberIds, status: 'open' as const, startedAt: new Date(start).toISOString(), endsAt: new Date(start + room.minutes * 60_000).toISOString() };
  await deps.store.put('rooms', opened);
  await bumpVersion(deps, room.assemblyId);
  await checkFacilitator(deps, room.id, { force: true });
  return { roomId: room.id, members: LIVE_ROOM_MEMBERS.map((key, i) => ({ key, id: memberIds[i]! })) };
}

async function readJson(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  let body = '';
  for await (const chunk of req) body += chunk;
  return body ? (JSON.parse(body) as Record<string, unknown>) : {};
}

async function main() {
  const config = loadConfig();
  const deps = await boot(config);
  const app = createApp(deps);
  const token = process.env.WALKTHROUGH_FIXTURE_TOKEN;
  const server = http.createServer((req, res) => {
    if (!token || req.method !== 'POST' || req.url !== FIXTURE_PATH) return void app(req, res);
    if (req.headers['x-walkthrough-token'] !== token) {
      res.writeHead(403).end();
      return;
    }
    readJson(req)
      .then((body) => openLiveRoom(deps, String(body.personId ?? '')))
      .then(
        (result) => res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(result)),
        (e: unknown) => res.writeHead(400, { 'content-type': 'text/plain' }).end((e as Error).message),
      );
  });
  server.listen(config.port, () => console.log(`Unite (walkthrough) is listening on http://localhost:${config.port}`));
  const stop = () => {
    server.close();
    deps.store.close().finally(() => process.exit(0));
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

await main();
