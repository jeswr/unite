import { fixedClock } from '@unite/shared';
import { describe, expect, it } from 'vitest';
import { WindowLimiter } from '../src/services/feedback/limits.js';
import { changesSince, compareVersions, type Release } from '../src/services/feedback/releases.js';
import { csvCell, publicSummaryText, stripLinksAndEmails } from '../src/services/feedback/text.js';

describe('stripLinksAndEmails', () => {
  it.each([
    ['See https://unite.example/a/x?y=1 now', 'See [link removed] now'],
    ['Go to http://localhost:4311/feedback', 'Go to [link removed]'],
    ['Try www.example.com/page', 'Try [link removed]'],
    ['It is on example.org/feedback and bbc.co.uk', 'It is on [link removed] and [link removed]'],
    ['//cdn.example.net/x', '[link removed]'],
    ['ftp://files.example.net/a', '[link removed]'],
    ['Mail sam.o@example.org or me@localhost', 'Mail [email removed] or [email removed]'],
    ['sam (at) example.org', '[email removed]'],
    ['Ｈｔｔｐｓ://ｅｘａｍｐｌｅ.ｃｏｍ', '[link removed]'],
    ['mail\u200Bto sam@exa\u200Bmple.org', 'mailto [email removed]'],
  ])('%s', (input, expected) => {
    expect(stripLinksAndEmails(input)).toBe(expected);
  });

  it('leaves ordinary words, versions and abbreviations alone', () => {
    const plain = 'Version 0.1.0 is fine, e.g. the picture. I paid £5.50. Node.js and Mr. Okafor.';
    expect(stripLinksAndEmails(plain)).toBe(plain);
  });

  it('builds the public summary from answered questions only', () => {
    expect(
      publicSummaryText([
        { key: 'a', question: 'What happened?', answer: 'It broke at https://x.example.com' },
        { key: 'b', question: 'Anything else?', answer: '  ' },
        { key: 'c', question: 'Who?', answer: 'Write to a@b.org' },
      ]),
    ).toBe('What happened?\nIt broke at [link removed]\n\nWho?\nWrite to [email removed]');
  });
});

describe('csvCell', () => {
  it('quotes and guards against formulas', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('=1+1')).toBe("'=1+1");
    expect(csvCell('@cmd')).toBe("'@cmd");
    expect(csvCell(undefined)).toBe('');
  });
});

describe('WindowLimiter', () => {
  it('counts hits in a sliding window read from the injected clock', () => {
    const clock = fixedClock('2026-11-13T09:00:00Z');
    const l = new WindowLimiter(clock, 2, 1000);
    expect(l.take('a')).toBe(true);
    clock.advance(500);
    expect(l.take('a')).toBe(true);
    expect(l.take('a')).toBe(false);
    expect(l.take('b')).toBe(true);
    clock.advance(501);
    expect(l.take('a')).toBe(true); // the first hit has left the window
    expect(l.take('a')).toBe(false);
    // Several keys: refused if any is full, and nothing is counted then.
    expect(l.take('c', 'a')).toBe(false);
    expect(l.take('c')).toBe(true);
  });
});

describe('releases', () => {
  const releases: Release[] = [
    { version: '0.10.0', date: '2027-01-01', changes: [{ text: 'C', affects: ['hosts'] }] },
    { version: '0.2.0', date: '2026-12-01', changes: [{ text: 'B', affects: ['participants'], question: 'B?' }] },
    { version: '0.1.0', date: '2026-11-13', changes: [{ text: 'A', affects: ['stewards'] }] },
  ];
  it('compares versions as numbers', () => {
    expect(compareVersions('0.10.0', '0.2.0')).toBeGreaterThan(0);
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
  });
  it('lists changes after a version, oldest first, or all of them', () => {
    expect(changesSince(releases).map((c) => c.text)).toEqual(['A', 'B', 'C']);
    expect(changesSince(releases, '0.1.0').map((c) => c.text)).toEqual(['B', 'C']);
    expect(changesSince(releases, '0.10.0')).toEqual([]);
  });
});
