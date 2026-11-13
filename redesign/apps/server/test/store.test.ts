import { fixedClock, stableId, type Person } from '@unite/shared';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { memoryStore, ValidationError, type Store } from '../src/store/index.js';

const person = (key: string, extra: Partial<Person> = {}): Person => ({
  id: stableId('per', key),
  createdAt: '2026-11-13T09:00:00.000Z',
  isExample: false,
  about: {},
  locale: 'en-GB',
  ...extra,
});

describe('store on in-memory PGlite', () => {
  let store: Store;
  const clock = fixedClock('2026-11-13T09:00:00Z');
  beforeAll(async () => {
    store = await memoryStore(clock);
  });
  afterAll(() => store.close());

  it('round-trips a document', async () => {
    const p = person('a', { displayName: 'Amina', about: { age: 'Under 25' } });
    await store.put('persons', p);
    expect(await store.get('persons', p.id)).toEqual(p);
    expect(await store.get('persons', stableId('per', 'missing'))).toBeUndefined();
  });

  it('refuses a document that does not match its schema', async () => {
    await expect(store.put('persons', { ...person('b'), locale: 3 } as unknown as Person)).rejects.toBeInstanceOf(ValidationError);
    await expect(store.put('persons', { ...person('c'), extra: true } as unknown as Person)).rejects.toThrow(/could not be saved/);
    await expect(store.put('persons', { ...person('d'), id: 'not-an-id' })).rejects.toBeInstanceOf(ValidationError);
    expect(await store.get('persons', person('b').id)).toBeUndefined();
  });

  it('replaces on put with the same id', async () => {
    await store.put('persons', person('e', { displayName: 'One' }));
    await store.put('persons', person('e', { displayName: 'Two' }));
    expect((await store.get('persons', person('e').id))?.displayName).toBe('Two');
  });

  it('lists with where, order and limit, keeping insertion order on ties', async () => {
    await store.clear();
    for (const [k, t, ex] of [
      ['l1', '2026-11-13T09:00:00.000Z', true],
      ['l2', '2026-11-13T08:00:00.000Z', false],
      ['l3', '2026-11-13T09:00:00.000Z', true],
    ] as const)
      await store.put('persons', person(k, { createdAt: t, isExample: ex }));
    const ids = (ps: Person[]) => ps.map((p) => p.id);
    expect(ids(await store.list('persons'))).toEqual([person('l2').id, person('l1').id, person('l3').id]);
    expect(ids(await store.list('persons', { isExample: true }))).toEqual([person('l1').id, person('l3').id]);
    expect(ids(await store.list('persons', {}, { dir: 'desc', limit: 1 }))).toEqual([person('l3').id]);
    expect(await store.count('persons', { isExample: false })).toBe(1);
    expect(await store.count('persons')).toBe(3);
    expect(await store.list('memberships')).toEqual([]);
  });

  it('matches nested values exactly and numbers as numbers', async () => {
    await store.put('spend', { id: '2026-11-13', usd: 1.5, calls: 3 });
    expect(await store.list('spend', { calls: 3 })).toHaveLength(1);
    expect(await store.list('spend', { calls: '3' })).toHaveLength(0);
  });

  it('deletes', async () => {
    await store.put('persons', person('del'));
    expect(await store.delete('persons', person('del').id)).toBe(true);
    expect(await store.delete('persons', person('del').id)).toBe(false);
  });

  it('rolls a transaction back on a throw, and nested calls join it', async () => {
    await expect(
      store.transaction(async (tx) => {
        await tx.put('persons', person('t1'));
        await store.put('persons', person('t2')); // the outer store joins the transaction
        await store.transaction(async () => store.put('persons', person('t3')));
        throw new Error('stop');
      }),
    ).rejects.toThrow('stop');
    for (const k of ['t1', 't2', 't3']) expect(await store.get('persons', person(k).id)).toBeUndefined();
    await store.transaction(async (tx) => tx.put('persons', person('t4')));
    expect(await store.get('persons', person('t4').id)).toBeDefined();
  });

  it('refuses unsafe where keys', async () => {
    await expect(store.list('persons', { "x'; drop": 1 })).rejects.toThrow(/field name/);
  });
});

describe('store on a PGlite folder', () => {
  it('keeps documents across reopening', async () => {
    const { openStore } = await import('../src/store/index.js');
    const os = await import('node:os');
    const path = await import('node:path');
    const fs = await import('node:fs');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'unite-store-'));
    const clock = fixedClock('2026-11-13T09:00:00Z');
    const a = await openStore({ dataDir: dir }, clock);
    await a.put('persons', person('disk'));
    await a.close();
    const b = await openStore({ dataDir: dir }, clock);
    expect(await b.get('persons', person('disk').id)).toBeDefined();
    await b.close();
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
