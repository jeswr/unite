import { useState, type FormEvent, type ReactNode } from 'react';
import { DECISION_LEVELS, slugify, type AboutQuestion, type AffectedGroup, type Assembly, type ChecklistItem } from '@unite/shared';
import { api, ApiError } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { messageOf } from '../delivery/useAction';
import type { IntakeDraft } from './Intake';

/** The about question that new affected groups are counted from. */
const GROUP_KEY = 'group';
const GROUP_LABEL = 'Which of these describes you best?';

interface GroupRow {
  label: string;
  target: string;
  /** Kept from an existing group, so its link to an about question is not lost. */
  aboutKey?: string;
  aboutValue?: string;
  key?: string;
}

export interface EditorValues {
  title: string;
  hostName: string;
  kind: Assembly['kind'];
  scale: Assembly['scale'];
  question: string;
  summary: string;
  probes: string[];
  groups: GroupRow[];
  setAside: string;
  remit: string;
  offTable: string;
  decisionLevel: string;
  thresholdPct: string;
  minParticipants: string;
  capacity: string;
  replyBy: string;
  checkBody: 'panel' | 'independent';
  checkBodyName: string;
  reviewAfterDays: string;
}

const blank: EditorValues = {
  title: '',
  hostName: '',
  kind: 'advisory',
  scale: 'local',
  question: '',
  summary: '',
  probes: ['', '', ''],
  groups: [],
  setAside: '',
  remit: '',
  offTable: '',
  decisionLevel: '2',
  thresholdPct: '60',
  minParticipants: '30',
  capacity: '5',
  replyBy: '',
  checkBody: 'panel',
  checkBodyName: '',
  reviewAfterDays: '365',
};

const three = (p: string[]) => [...p, '', '', ''].slice(0, 3);
const str = (n: number | undefined, d: string) => (n === undefined ? d : String(n));

export function valuesFromDraft(d: IntakeDraft): EditorValues {
  const p = d.pledge;
  return {
    ...blank,
    question: d.question,
    kind: d.kind,
    groups: d.groups.map((label) => ({ label, target: '10' })),
    setAside: p.setAside ?? '',
    remit: p.remit ?? '',
    offTable: p.offTable ?? '',
    decisionLevel: str(p.decisionLevel, blank.decisionLevel),
    thresholdPct: p.groupThreshold === undefined ? blank.thresholdPct : String(Math.round(p.groupThreshold * 100)),
    minParticipants: str(p.minParticipants, blank.minParticipants),
    capacity: str(p.capacity, blank.capacity),
    replyBy: p.replyBy?.slice(0, 10) ?? '',
    checkBody: p.checkBody ?? 'panel',
    checkBodyName: p.checkBodyName ?? '',
    reviewAfterDays: str(p.reviewAfterDays, blank.reviewAfterDays),
  };
}

export function valuesFromAssembly(a: Assembly): EditorValues {
  const p = a.pledge;
  return {
    ...blank,
    title: a.title,
    hostName: a.hostName,
    kind: a.kind,
    scale: a.scale,
    question: a.question,
    summary: a.summary,
    probes: three(a.probes),
    groups: a.affectedGroups.map((g) => ({ label: g.label, target: String(g.target), aboutKey: g.aboutKey, aboutValue: g.aboutValue, key: g.key })),
    ...(p
      ? {
          setAside: p.setAside,
          remit: p.remit,
          offTable: p.offTable,
          decisionLevel: String(p.decisionLevel),
          thresholdPct: String(Math.round(p.groupThreshold * 100)),
          minParticipants: String(p.minParticipants),
          capacity: String(p.capacity),
          replyBy: p.replyBy.slice(0, 10),
          checkBody: p.checkBody,
          checkBodyName: p.checkBodyName ?? '',
          reviewAfterDays: String(p.reviewAfterDays),
        }
      : {}),
  };
}

const num = (s: string) => (s.trim() === '' || Number.isNaN(Number(s)) ? 0 : Math.max(0, Math.round(Number(s))));

/** The request body for creating or editing, from the form. */
export function bodyFrom(v: EditorValues, existingAbout: AboutQuestion[] = []) {
  const groups = v.groups.filter((g) => g.label.trim());
  const fresh = groups.filter((g) => !g.aboutKey || g.aboutKey === GROUP_KEY);
  const about: AboutQuestion[] = existingAbout.filter((q) => q.key !== GROUP_KEY);
  if (fresh.length) about.push({ key: GROUP_KEY, label: GROUP_LABEL, options: fresh.map((g) => g.label.trim()) });
  const used = new Set<string>();
  const affectedGroups: AffectedGroup[] = groups.map((g, i) => {
    let key = g.key ?? (slugify(g.label).replace(/-/g, '_') || `group_${i + 1}`);
    while (used.has(key)) key = `${key}_${i + 1}`;
    used.add(key);
    const isFresh = !g.aboutKey || g.aboutKey === GROUP_KEY;
    return { key, label: g.label.trim(), aboutKey: isFresh ? GROUP_KEY : g.aboutKey!, aboutValue: isFresh ? g.label.trim() : g.aboutValue!, target: num(g.target) };
  });
  return {
    title: v.title.trim() || v.question.trim(),
    question: v.question.trim(),
    summary: v.summary.trim(),
    probes: v.probes.map((p) => p.trim()).filter(Boolean),
    aboutQuestions: about,
    affectedGroups,
    pledge: {
      setAside: v.setAside.trim(),
      remit: v.remit.trim(),
      offTable: v.offTable.trim(),
      decisionLevel: Math.min(3, num(v.decisionLevel)) as 0 | 1 | 2 | 3,
      groupThreshold: Math.min(100, num(v.thresholdPct)) / 100,
      minParticipants: num(v.minParticipants),
      capacity: num(v.capacity),
      replyBy: v.replyBy,
      checkBody: v.checkBody,
      ...(v.checkBody === 'independent' && v.checkBodyName.trim() ? { checkBodyName: v.checkBodyName.trim() } : {}),
      reviewAfterDays: num(v.reviewAfterDays),
    },
  };
}

interface LeadingResult {
  leading: boolean;
  why: string;
  suggestion: string;
}

/** The leading-wording check under the question and each probe: runs when the field is left. */
export function LeadingNote({ result, onUse }: { result: LeadingResult | undefined; onUse: (s: string) => void }) {
  if (!result) return null;
  if (!result.leading) return <p className="-mt-3 mb-5 text-agree">This wording does not lead people toward an answer.</p>;
  return (
    <Banner tone="warn" className="-mt-3 mb-5">
      <p className="font-bold">This may lead people toward an answer.</p>
      <p>{result.why}</p>
      {result.suggestion && (
        <>
          <p className="mt-2">
            Suggestion: <q>{result.suggestion}</q>
          </p>
          <Button variant="secondary" className="mt-2" onClick={() => onUse(result.suggestion)}>
            Use the suggestion
          </Button>
        </>
      )}
    </Banner>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="mb-8">
      <legend className="mb-3 text-xl font-bold">{title}</legend>
      {children}
    </fieldset>
  );
}

interface Props {
  initial: EditorValues;
  /** Set when editing an assembly that already exists. */
  assembly?: Assembly;
  intakeId?: string;
  fromThemeId?: string;
  /** Called after a save, with the assembly as saved. */
  onSaved?: (a: Assembly) => void;
  /** Called once the pledge is published. */
  onPublished: (a: Assembly) => void;
}

/** The pledge editor: a plain form with a line of help under each field, and "Publish the pledge". */
export function PledgeEditor({ initial, assembly, intakeId, fromThemeId, onSaved, onPublished }: Props) {
  const [v, setV] = useState(initial);
  const [saved, setSaved] = useState<Assembly | undefined>(assembly);
  const [leading, setLeading] = useState<Record<string, LeadingResult | undefined>>({});
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [unmet, setUnmet] = useState<ChecklistItem[]>();
  const [note, setNote] = useState<string>();

  const set = <K extends keyof EditorValues>(k: K, value: EditorValues[K]) => setV((x) => ({ ...x, [k]: value }));
  const input = (k: keyof EditorValues) => ({ value: v[k] as string, onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) });

  const check = async (key: string, text: string) => {
    if (!text.trim()) return setLeading((l) => ({ ...l, [key]: undefined }));
    try {
      const r = await api.post<LeadingResult>('/api/check-leading', { text });
      setLeading((l) => ({ ...l, [key]: r }));
    } catch {
      setLeading((l) => ({ ...l, [key]: undefined }));
    }
  };

  const problems = {
    question: !v.question.trim() ? 'Write the question people will be asked.' : undefined,
    hostName: !saved && !v.hostName.trim() ? 'Name the organisation that will host it.' : undefined,
    replyBy: !v.replyBy ? 'Choose the date by which you will answer.' : undefined,
  };

  const save = async (): Promise<Assembly | undefined> => {
    setTried(true);
    setError(undefined);
    setUnmet(undefined);
    setNote(undefined);
    if (Object.values(problems).some(Boolean)) {
      setError('Some fields need attention before this can be saved.');
      return undefined;
    }
    const body = bodyFrom(v, saved?.aboutQuestions);
    try {
      const res = saved
        ? await api.patch<{ assembly: Assembly }>(`/api/host/assemblies/${saved.slug}`, body)
        : await api.post<{ assembly: Assembly }>('/api/host/assemblies', {
            ...body,
            hostName: v.hostName.trim(),
            kind: v.kind,
            scale: v.scale,
            ...(intakeId ? { intakeId } : {}),
            ...(fromThemeId ? { fromThemeId } : {}),
          });
      setSaved(res.assembly);
      onSaved?.(res.assembly);
      return res.assembly;
    } catch (e) {
      setError(messageOf(e));
      return undefined;
    }
  };

  const onSave = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    if (await save()) setNote('Saved. Nothing is public until you publish the pledge.');
    setBusy(false);
  };

  const publish = async () => {
    setBusy(true);
    const a = await save();
    if (a) {
      try {
        const res = await api.post<{ assembly: Assembly }>(`/api/assemblies/${a.slug}/stage`);
        onPublished(res.assembly);
      } catch (e) {
        setError(messageOf(e));
        if (e instanceof ApiError) setUnmet((e.details as { unmet?: ChecklistItem[] } | undefined)?.unmet);
      }
    }
    setBusy(false);
  };

  const err = (k: keyof typeof problems) => (tried ? problems[k] : undefined);

  return (
    <form onSubmit={(e) => void onSave(e)} noValidate>
      <Group title="The question">
        <Field label="The question people will be asked" hint="One open question, in plain words, that any answer could fit." error={err('question')}>
          <textarea className={inputClass} rows={2} {...input('question')} onBlur={() => void check('question', v.question)} />
        </Field>
        <LeadingNote result={leading.question} onUse={(s) => (set('question', s), setLeading((l) => ({ ...l, question: undefined })))} />
        <Field label="A short title" hint="Used in lists and the register. Leave it empty to use the question.">
          <input className={inputClass} {...input('title')} />
        </Field>
        <Field label="What this is about" hint="Two or three sentences for someone who has never heard of it.">
          <textarea className={inputClass} rows={3} {...input('summary')} />
        </Field>
        {v.probes.map((p, i) => (
          <div key={i}>
            <Field label={`Your own question ${i + 1} (optional)`} hint="Asked near the end of each conversation. Up to three.">
              <input
                className={inputClass}
                value={p}
                onChange={(e) => set('probes', v.probes.map((x, j) => (j === i ? e.target.value : x)))}
                onBlur={() => void check(`probe${i}`, p)}
              />
            </Field>
            <LeadingNote
              result={leading[`probe${i}`]}
              onUse={(s) => (set('probes', v.probes.map((x, j) => (j === i ? s : x))), setLeading((l) => ({ ...l, [`probe${i}`]: undefined })))}
            />
          </div>
        ))}
      </Group>

      <Group title="Who hosts it">
        {saved ? (
          <p className="mb-5">
            Hosted by <strong>{saved.hostName}</strong>.
          </p>
        ) : (
          <>
            <Field label="The organisation hosting it" hint="This name goes on the pledge and on the host’s public record." error={err('hostName')}>
              <input className={inputClass} {...input('hostName')} />
            </Field>
            <Field label="What kind of promise" hint="Advisory: you answer every priority with reasons. Co-decided: you carry out what passes, within your limits.">
              <select className={inputClass} value={v.kind} onChange={(e) => set('kind', e.target.value as Assembly['kind'])}>
                <option value="advisory">Advisory</option>
                <option value="codecided">Co-decided</option>
                <option value="community">Community-run</option>
                <option value="technology">Technology co-design</option>
              </select>
            </Field>
            <Field label="Scale" hint="Who the question reaches.">
              <select className={inputClass} value={v.scale} onChange={(e) => set('scale', e.target.value as Assembly['scale'])}>
                <option value="local">A town or area</option>
                <option value="sector">A sector</option>
                <option value="global">Across countries</option>
                <option value="platform">Unite itself</option>
              </select>
            </Field>
          </>
        )}
      </Group>

      <Group title="Who must be heard">
        <p className="mb-3 text-muted">The groups whose voices must be heard for the result to be fair, and how many people from each you hope to hear.</p>
        {v.groups.map((g, i) => (
          <div key={i} className="mb-3 flex flex-wrap items-end gap-3">
            <label className="min-w-0 flex-1 basis-48">
              <span className="mb-1 block font-bold">Group</span>
              <input className={inputClass} value={g.label} onChange={(e) => set('groups', v.groups.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
            </label>
            <label className="w-28">
              <span className="mb-1 block font-bold">Hoped for</span>
              <input
                type="number"
                min={0}
                className={inputClass}
                value={g.target}
                onChange={(e) => set('groups', v.groups.map((x, j) => (j === i ? { ...x, target: e.target.value } : x)))}
              />
            </label>
            <Button variant="quiet" onClick={() => set('groups', v.groups.filter((_, j) => j !== i))}>
              Remove<span className="sr-only"> {g.label}</span>
            </Button>
          </div>
        ))}
        <Button variant="secondary" onClick={() => set('groups', [...v.groups, { label: '', target: '10' }])}>
          Add a group
        </Button>
      </Group>

      <Group title="The pledge">
        <Field label="What you have set aside" hint="Money, staff time, or the power to change a rule. Say how much and from which budget.">
          <textarea className={inputClass} rows={2} {...input('setAside')} />
        </Field>
        <Field label="What you can act on" hint="The things within your control that this assembly can change.">
          <textarea className={inputClass} rows={2} {...input('remit')} />
        </Field>
        <Field label="What is off the table, and why" hint="Say plainly what you cannot change, and the reason.">
          <textarea className={inputClass} rows={2} {...input('offTable')} />
        </Field>
        <Field label="How it is decided" hint="The rule a statement must meet to pass.">
          <select className={inputClass} {...input('decisionLevel')}>
            {DECISION_LEVELS.filter((l) => l.available).map((l) => (
              <option key={l.level} value={l.level}>
                {l.name}: {l.passesWhen}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How much agreement is needed, in each group of people who answered alike (%)" hint="For example 60 means at least 60% in each group must agree.">
          <input type="number" min={1} max={100} className={inputClass} {...input('thresholdPct')} />
        </Field>
        <Field label="The fewest people who must take part" hint="Below this number nothing can be decided.">
          <input type="number" min={1} className={inputClass} {...input('minParticipants')} />
        </Field>
        <Field label="How many priorities you will answer" hint="You promise a reasoned answer to each of the top ones.">
          <input type="number" min={1} className={inputClass} {...input('capacity')} />
        </Field>
        <Field label="The date you will answer by" hint="A missing answer is shown in public as late, with the number of days." error={err('replyBy')}>
          <input type="date" className={inputClass} {...input('replyBy')} />
        </Field>
        <Field label="Who checks what you deliver" hint="You cannot mark your own work done. Someone else checks it against the numbered tests.">
          <select className={inputClass} value={v.checkBody} onChange={(e) => set('checkBody', e.target.value as 'panel' | 'independent')}>
            <option value="panel">A panel of participants drawn by lot</option>
            <option value="independent">An independent body</option>
          </select>
        </Field>
        {v.checkBody === 'independent' && (
          <Field label="The independent body’s name" hint="It will be named on the pledge.">
            <input className={inputClass} {...input('checkBodyName')} />
          </Field>
        )}
        <Field label="Review after (days)" hint="When each decision is looked at again and the question can be reopened.">
          <input type="number" min={1} className={inputClass} {...input('reviewAfterDays')} />
        </Field>
      </Group>

      <div aria-live="polite">
        {error && (
          <Banner tone="warn" className="mb-4">
            <p>{error}</p>
            {unmet && unmet.length > 0 && (
              <ul className="mt-2 list-disc pl-6">
                {unmet.map((i) => (
                  <li key={i.key}>
                    {i.text}
                    {i.detail && <span className="block text-sm text-muted">{i.detail}</span>}
                  </li>
                ))}
              </ul>
            )}
          </Banner>
        )}
        {note && <Banner className="mb-4">{note}</Banner>}
      </div>
      <p className="mb-3 text-muted">Publishing puts the question and the pledge in public. People can challenge it for a set time before conversations open.</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => void publish()} disabled={busy}>
          Publish the pledge
        </Button>
        <Button type="submit" variant="secondary" disabled={busy}>
          Save the draft
        </Button>
      </div>
    </form>
  );
}
