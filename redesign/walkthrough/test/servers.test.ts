import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { LIVE_ROOM_LINES, LIVE_ROOM_MEMBERS } from '../lib/live-room.ts';
import { serverEnv, signCookie } from '../lib/servers.ts';

describe('the recorded server', () => {
  it('signs a session the way cookie-parser checks it', () => {
    const signed = signCookie('per_abcdefghijkl', 'k');
    expect(signed.startsWith('s:per_abcdefghijkl.')).toBe(true);
    const mac = createHmac('sha256', 'k').update('per_abcdefghijkl').digest('base64').replace(/=+$/, '');
    expect(signed).toBe(`s:per_abcdefghijkl.${mac}`);
  });

  it('runs with this run’s own secret and fixture token when given them, and never a production setting', () => {
    const env = serverEnv(4555, { NODE_ENV: 'production', UNITE_SECRET: 'theirs' }, { secret: 'mine', fixtureToken: 't' });
    expect(env).toMatchObject({ UNITE_SECRET: 'mine', WALKTHROUGH_FIXTURE_TOKEN: 't', UNITE_DATA_DIR: 'memory' });
    expect(env.NODE_ENV).toBeUndefined();
    expect(serverEnv(4555, {}).WALKTHROUGH_FIXTURE_TOKEN).toBeUndefined();
  });
});

describe('the live room', () => {
  it('has the viewer and five seeded people, and only members speak', () => {
    expect(LIVE_ROOM_MEMBERS).toHaveLength(6);
    expect(LIVE_ROOM_MEMBERS.filter((m) => m === 'viewer')).toHaveLength(1);
    for (const l of LIVE_ROOM_LINES) expect(LIVE_ROOM_MEMBERS).toContain(l.who);
    expect(LIVE_ROOM_LINES.filter((l) => l.who === 'viewer')).toHaveLength(1);
  });

  it('keeps every line short enough to read as it arrives', () => {
    for (const l of LIVE_ROOM_LINES) expect(l.text.length).toBeLessThan(120);
  });
});
