import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MeProvider } from '../lib/me';
import { bodyFrom, PledgeEditor, valuesFromDraft } from '../pages/host/PledgeEditor';

const draft = {
  question: "Wouldn't you agree that buses should run later?",
  affected: 'Night workers, carers',
  groups: ['Night workers', 'carers'],
  rule: 'We will take advice.',
  kind: 'advisory' as const,
  pledge: { setAside: '£120,000 a year.', remit: 'The evening timetable.', offTable: 'Fares.', decisionLevel: 2 as const, groupThreshold: 0.6, minParticipants: 30, capacity: 5, replyBy: '2027-01-31', checkBody: 'panel' as const, reviewAfterDays: 365 },
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function renderEditor(onPublished = vi.fn()) {
  render(
    <MemoryRouter>
      <MeProvider initial={{ person: null, memberships: [], role: 'host', demo: false }}>
        <PledgeEditor initial={valuesFromDraft(draft)} intakeId="ink_AAAAAAAAAAAA" onPublished={onPublished} />
      </MeProvider>
    </MemoryRouter>,
  );
  return onPublished;
}

afterEach(() => vi.unstubAllGlobals());

describe('the pledge editor', () => {
  it('is filled from the intake, with a line of help under each field', () => {
    vi.stubGlobal('fetch', vi.fn());
    renderEditor();
    expect((screen.getByLabelText('The question people will be asked') as HTMLTextAreaElement).value).toBe(draft.question);
    expect((screen.getByLabelText('What you have set aside') as HTMLTextAreaElement).value).toBe('£120,000 a year.');
    expect((screen.getByLabelText('The date you will answer by') as HTMLInputElement).value).toBe('2027-01-31');
    expect(screen.getByText('Money, staff time, or the power to change a rule. Say how much and from which budget.')).toBeTruthy();
    expect(screen.getAllByRole('textbox', { name: 'Group' }).map((i) => (i as HTMLInputElement).value)).toEqual(['Night workers', 'carers']);
  });

  it('checks the question for leading wording and offers the suggestion', async () => {
    const fetch = vi.fn(async () => json({ leading: true, why: 'It uses “wouldn’t you agree”, which tells people the answer you expect.', suggestion: 'Buses should run later?' }));
    vi.stubGlobal('fetch', fetch);
    renderEditor();
    fireEvent.blur(screen.getByLabelText('The question people will be asked'));
    expect(await screen.findByText('This may lead people toward an answer.')).toBeTruthy();
    expect(JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body))).toEqual({ text: draft.question });
    fireEvent.click(screen.getByRole('button', { name: 'Use the suggestion' }));
    expect((screen.getByLabelText('The question people will be asked') as HTMLTextAreaElement).value).toBe('Buses should run later?');
  });

  it('shows the unmet checklist items when publishing is refused (rule 6)', async () => {
    const assembly = { slug: 'evening-buses', title: 'Evening buses', aboutQuestions: [] };
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/host/assemblies' && init?.method === 'POST') return json({ assembly }, 201);
      if (url === '/api/assemblies/evening-buses/stage')
        return json({ error: { code: 'checklist_not_clear', message: 'This assembly cannot move on yet.', details: { unmet: [{ key: 'pledge_complete', text: 'The pledge is complete', met: false, detail: 'The pledge does not say what the host can act on' }] } } }, 409);
      return json({});
    });
    vi.stubGlobal('fetch', fetch);
    const onPublished = renderEditor();
    fireEvent.change(screen.getByLabelText('The organisation hosting it'), { target: { value: 'Riverside Transport Board' } });
    fireEvent.change(screen.getByLabelText('What you can act on'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish the pledge' }));
    expect(await screen.findByText('The pledge is complete')).toBeTruthy();
    expect(screen.getByText('The pledge does not say what the host can act on')).toBeTruthy();
    expect(onPublished).not.toHaveBeenCalled();
    const created = JSON.parse(String((fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(created).toMatchObject({ hostName: 'Riverside Transport Board', intakeId: 'ink_AAAAAAAAAAAA', pledge: { remit: '', groupThreshold: 0.6, replyBy: '2027-01-31' } });
  });

  it('needs a host name and a reply date before saving', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    renderEditor();
    fireEvent.change(screen.getByLabelText('The date you will answer by'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save the draft' }));
    await waitFor(() => expect(screen.getByText('Choose the date by which you will answer.')).toBeTruthy());
    expect(screen.getByText('Name the organisation that will host it.')).toBeTruthy();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('turns groups into an about question each group is counted from', () => {
    const body = bodyFrom(valuesFromDraft(draft));
    expect(body.aboutQuestions).toEqual([{ key: 'group', label: 'Which of these describes you best?', options: ['Night workers', 'carers'] }]);
    expect(body.affectedGroups.map((g) => [g.key, g.aboutKey, g.aboutValue, g.target])).toEqual([
      ['night_workers', 'group', 'Night workers', 10],
      ['carers', 'group', 'carers', 10],
    ]);
  });
});
