import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router';
import { api, ApiError, useApi } from '../../lib/api';
import { useAssembly } from '../../lib/useAssembly';
import { useLive } from '../../lib/useLive';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { Field, inputClass } from '../../ui/Field';
import { Layout } from '../../ui/Layout';
import { Tag } from '../../ui/Tag';
import { answersInWords, EvidenceCardView, NotHeardOrError, OutcomeView } from './parts';
import { roomLengthWords, roomTimeLeft, slowRoomLine, writeFirstNotice } from './time';
import type { AnswerValue, MessagesResponse, RoomMessageView, RoomResponse, RoomStatus } from '@unite/shared';

/** Rooms poll their own messages every 1.5 seconds (section 7). */
export const MESSAGE_POLL_MS = 1500;
export const MESSAGE_MAX = 600;

const STATUS_WORDS: Record<RoomStatus, string> = { scheduled: 'Not open yet', open: 'Open', closed: 'Closed' };
const ANSWER_WORDS: Record<AnswerValue, string> = { agree: 'Agree', disagree: 'Disagree', unsure: 'Not sure' };
const OUTCOME_KINDS = [
  { value: 'for', label: 'A reason for' },
  { value: 'against', label: 'A reason against' },
  { value: 'wording', label: 'A better wording for the statement' },
  { value: 'question', label: 'A question for experts' },
] as const;

const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'That did not work. Please try again.');

export interface WriteFirstState {
  mustWriteFirst: boolean;
  hiddenPeople: number;
}

/**
 * Polls the room's messages while `active`, appending what is new. Returns the messages and the server's clock offset.
 * While a member of a slow room must write first, each poll fetches the whole list again, so the
 * messages held back until now arrive in their places once they have written.
 */
function useRoomMessages(roomId: string, active: boolean) {
  const [messages, setMessages] = useState<RoomMessageView[]>([]);
  const [status, setStatus] = useState<RoomStatus>();
  const [offset, setOffset] = useState<number>();
  const [gate, setGate] = useState<WriteFirstState>();
  const last = useRef<string | undefined>(undefined);
  const gated = useRef(true);
  const busy = useRef(false);

  const poll = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const whole = gated.current || !last.current;
      const q = whole ? '' : `?after=${encodeURIComponent(last.current!)}`;
      const r = await api.get<MessagesResponse>(`/api/rooms/${encodeURIComponent(roomId)}/messages${q}`);
      setOffset(Date.parse(r.now) - Date.now());
      setStatus(r.status);
      gated.current = !!r.mustWriteFirst;
      setGate({ mustWriteFirst: !!r.mustWriteFirst, hiddenPeople: r.hiddenPeople ?? 0 });
      if (whole) {
        last.current = r.messages.at(-1)?.id;
        setMessages(r.messages);
      } else if (r.messages.length) {
        last.current = r.messages[r.messages.length - 1]!.id;
        setMessages((m) => [...m, ...r.messages.filter((x) => !m.some((y) => y.id === x.id))]);
      }
    } catch {
      // Offline for a moment: the next poll tries again.
    } finally {
      busy.current = false;
    }
  }, [roomId]);

  useEffect(() => {
    if (!active) return;
    void poll();
    const t = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') void poll();
    }, MESSAGE_POLL_MS);
    return () => clearInterval(t);
  }, [active, poll]);

  return { messages, status, offset, gate, poll };
}

/** Re-renders every few seconds so the timer stays current. */
function useTick(ms: number) {
  const [, setT] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setT((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
}

export default function Room() {
  const { slug = '', roomId = '' } = useParams();
  const version = useLive(slug);
  const { data: view, reload: reloadView } = useAssembly(slug, version);
  const { data, error, reload } = useApi<RoomResponse>(`/api/rooms/${encodeURIComponent(roomId)}`, version);
  const a = view?.assembly;
  const live = !!data?.isMember && data.room.status === 'open';
  const { messages, status: polledStatus, offset: pollOffset, gate: polledGate, poll } = useRoomMessages(roomId, live);
  useTick(5000);
  // The server's clock minus this device's, measured once when the room loads.
  const loadedNow = data?.now;
  const baseOffset = useMemo(() => (loadedNow ? Date.parse(loadedNow) - Date.now() : 0), [loadedNow]);

  if (error && !data)
    return (
      <Layout title={error.status === 404 ? 'There is no room here' : 'A room'} assembly={a} kicker={a?.question}>
        <NotHeardOrError error={error} slug={slug} what="this room" isExample={a?.isExample} onLookedAround={() => (reloadView(), reload())} />
      </Layout>
    );
  if (!data)
    return (
      <Layout title="A room" assembly={a} kicker={a?.question}>
        <p aria-live="polite">Loading the room…</p>
      </Layout>
    );

  const room = data.room;
  const status = polledStatus === 'closed' ? 'closed' : room.status;
  const offset = live && pollOffset !== undefined ? pollOffset : baseOffset;
  const left = room.endsAt ? Date.parse(room.endsAt) - (Date.now() + offset) : null;
  const timeUp = status === 'open' && left !== null && left <= 0;
  const slow = room.pace === 'slow';
  // What the latest poll says, or the room's own answer before the first poll.
  const gate: WriteFirstState = polledGate ?? { mustWriteFirst: data.mustWriteFirst, hiddenPeople: data.hiddenPeople };

  return (
    <Layout title={room.topic} assembly={a} kicker="A room">
      {data.canManage && <ManagerControls roomId={room.id} status={status} onDone={reload} />}

      {/* On phones the timer and the folded briefing share one row, so the messages start near the top. */}
      <div className="mb-4 flex flex-wrap items-start gap-x-3 gap-y-2 md:mb-6">
        <p className="flex min-h-10 flex-wrap items-center gap-2">
          <Tag tone={status === 'open' ? 'accent' : 'neutral'}>{STATUS_WORDS[status]}</Tag>
          {status === 'open' && left !== null && <span className={left < 5 * 60_000 ? 'font-bold text-warn' : 'font-bold'}>{roomTimeLeft(left, room.pace)}</span>}
          {status === 'scheduled' &&
            (slow ? <span>This is a slow room. It will be open for {roomLengthWords(room.minutes, 'slow')} once it opens.</span> : <span>It will run for {room.minutes} minutes once it opens.</span>)}
        </p>
        <Briefing data={data} />
      </div>

      {slow && status === 'open' && room.endsAt && <p className="mb-4">{slowRoomLine(room.endsAt)}</p>}

      {!data.isMember && (
        <section aria-labelledby="not-member" className="mb-8">
          <h2 id="not-member" className="mb-2">
            You are not in this room
          </h2>
          <p>
            The {data.memberCount} people in this room were drawn by lot. What they say to each other stays in the room. When it closes, the reasons they gave, any new wording and how their
            private final answers fell are shown here and on the rooms page.
          </p>
          <p className="mt-2">
            <Link to={`/a/${slug}/rooms`}>Back to the rooms</Link>
          </p>
        </section>
      )}

      {data.isMember && status === 'scheduled' && (
        <section className="mb-8">
          <h2 className="mb-2">You have been drawn for this room</h2>
          <p className="mb-2">The room has not opened yet. Read the briefing above so you are ready. Messages will appear here once it opens.</p>
          <p>
            <span className="font-bold">In the room: </span>
            {data.members.map((m) => (m.isMe ? 'you' : m.name)).join(', ')}
          </p>
        </section>
      )}

      {data.isMember && status === 'open' && (
        <>
          {slow && gate.mustWriteFirst && (
            <Banner className="mb-4">
              <p>{writeFirstNotice(gate.hiddenPeople)}</p>
            </Banner>
          )}
          <Messages messages={messages} />
          {timeUp ? (
            <FinalForms data={data} mustWriteFirst={slow && gate.mustWriteFirst} onDone={reload} />
          ) : (
            <MessageBox
              roomId={room.id}
              onSent={() => {
                void poll();
                // Once you have written in a slow room, what the others added to the outcome is yours to read too.
                if (slow && gate.mustWriteFirst) reload();
              }}
            />
          )}
        </>
      )}

      {status === 'closed' && (
        <section aria-labelledby="outcome" className="mb-8">
          <h2 id="outcome" className="mb-3">
            What the room found
          </h2>
          {room.outcome ? <OutcomeView outcome={room.outcome} /> : <p className="text-muted">The members did not add any reasons or wording.</p>}
          {data.answerTotals && <p className="mt-3">{answersInWords(data.answerTotals)}</p>}
          <p className="mt-2 text-sm text-muted">Each final answer was private. Only these totals are shown.</p>
        </section>
      )}
    </Layout>
  );
}

function ManagerControls({ roomId, status, onDone }: { roomId: string; status: RoomStatus; onDone: () => void }) {
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  if (status === 'closed') return null;
  const act = async (what: 'open' | 'close') => {
    setBusy(true);
    setErr(undefined);
    try {
      await api.post(`/api/rooms/${encodeURIComponent(roomId)}/${what}`);
      onDone();
    } catch (e) {
      setErr(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mb-6 rounded-ui border border-line bg-soft p-3">
      <p className="mb-2 text-sm text-muted">For hosts and stewards</p>
      {err && <Banner tone="warn" className="mb-2">{err}</Banner>}
      {status === 'scheduled' ? (
        <Button onClick={() => void act('open')} disabled={busy}>
          Open the room
        </Button>
      ) : (
        <Button variant="secondary" onClick={() => void act('close')} disabled={busy}>
          Close the room
        </Button>
      )}
    </div>
  );
}

function Briefing({ data }: { data: RoomResponse }) {
  const b = data.room.briefing;
  // Open on wider screens; folded on phones so the conversation is near the top.
  const [open, setOpen] = useState(() => (typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia('(min-width: 768px)').matches : true));
  return (
    <details open={open} onToggle={(e) => setOpen(e.currentTarget.open)} className="min-w-0 grow basis-40 rounded-ui border border-line md:basis-full">
      <summary className="flex min-h-10 cursor-pointer items-center px-3 py-1 font-bold md:px-4 md:py-3">The briefing</summary>
      <div className="space-y-4 border-t border-line px-4 py-4">
        {data.room.statement && (
          <div>
            <h2 className="mb-1 text-base">The statement</h2>
            <blockquote className="border-l-4 border-accent pl-3">{data.room.statement.text}</blockquote>
          </div>
        )}
        {b.summary && <p>{b.summary}</p>}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h2 className="mb-1 text-base text-agree">The case for</h2>
            {b.forSide.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {b.forSide.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Nothing written yet.</p>
            )}
          </div>
          <div>
            <h2 className="mb-1 text-base text-disagree">The case against</h2>
            {b.againstSide.length ? (
              <ul className="list-disc space-y-1 pl-5">
                {b.againstSide.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            ) : (
              <p className="text-muted">Nothing written yet.</p>
            )}
          </div>
        </div>
        {b.evidence.length > 0 && (
          <div>
            <h2 className="mb-2 text-base">Evidence</h2>
            <ul className="space-y-3">
              {b.evidence.map((c) => (
                <li key={c.id}>
                  <EvidenceCardView card={c} />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </details>
  );
}

function Messages({ messages }: { messages: RoomMessageView[] }) {
  // A new message is followed when you are already near the end, or wrote it yourself.
  // Someone reading further up is left where they are.
  const end = useRef<HTMLDivElement>(null);
  const seen = useRef<number | undefined>(undefined);
  const count = messages.length;
  const lastMine = messages[count - 1]?.mine ?? false;
  useEffect(() => {
    const before = seen.current;
    seen.current = count;
    if (before === undefined || count <= before) return;
    const fromEnd = document.documentElement.scrollHeight - window.innerHeight - window.scrollY;
    if (lastMine || fromEnd < 360) end.current?.scrollIntoView?.({ block: 'end' });
  }, [count, lastMine]);
  return (
    <section aria-labelledby="messages-heading" className="mb-4">
      <h2 id="messages-heading" className="mb-2 text-lg md:mb-3 md:text-[1.3rem]">
        The conversation
      </h2>
      {/* Padding below the last message, so the sticky message box never sits over it. */}
      <ol aria-live="polite" aria-relevant="additions" className="space-y-3 pb-4">
        {messages.length === 0 && <li className="text-muted">The facilitator will open the conversation in a moment.</li>}
        {messages.map((m) =>
          m.authorType === 'facilitator' ? (
            <li key={m.id} className="rounded-ui border-l-4 border-accent bg-accent-soft px-3 py-2" data-author="facilitator">
              <p className="text-sm font-bold text-accent">Facilitator (AI)</p>
              <p className="whitespace-pre-wrap">{m.text}</p>
            </li>
          ) : (
            <li key={m.id} className="border-b border-line pb-2" data-author={m.mine ? 'me' : 'person'}>
              <p className="text-sm font-bold">{m.mine ? 'You' : m.author}</p>
              <p className="whitespace-pre-wrap break-words">{m.text}</p>
            </li>
          ),
        )}
      </ol>
      {/* The margin is the height of the message box, which sits over the bottom of the screen. */}
      <div ref={end} className="scroll-mb-48" />
    </section>
  );
}

export function MessageBox({ roomId, onSent }: { roomId: string; onSent: () => void }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setErr(undefined);
    try {
      await api.post(`/api/rooms/${encodeURIComponent(roomId)}/messages`, { text: text.trim() });
      setText('');
      onSent();
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={(e) => void submit(e)} className="sticky bottom-0 z-10 -mx-4 border-t border-line bg-white px-4 pt-2 pb-2 md:pt-3 md:pb-3">
      {err && <Banner tone="warn" className="mb-2">{err}</Banner>}
      <label htmlFor="room-message" className="mb-1 block text-sm font-bold md:text-base">
        Your message
      </label>
      <textarea
        id="room-message"
        rows={2}
        className={`${inputClass} resize-y`}
        value={text}
        maxLength={MESSAGE_MAX}
        aria-describedby="room-message-count"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void submit(e);
        }}
      />
      <div className="mt-1 flex items-center justify-between gap-3 md:mt-2">
        <span id="room-message-count" className="text-sm text-muted">
          {text.length} of {MESSAGE_MAX} characters
        </span>
        <Button type="submit" disabled={busy || !text.trim()}>
          Send
        </Button>
      </div>
    </form>
  );
}

function FinalForms({ data, mustWriteFirst, onDone }: { data: RoomResponse; mustWriteFirst: boolean; onDone: () => void }) {
  const roomId = data.room.id;
  const [value, setValue] = useState<AnswerValue | undefined>(data.myAnswer?.value);
  const [note, setNote] = useState(data.myAnswer?.note ?? '');
  const [saved, setSaved] = useState<string>();
  const [err, setErr] = useState<string>();
  const [kind, setKind] = useState<(typeof OUTCOME_KINDS)[number]['value']>('for');
  const [item, setItem] = useState('');
  const [itemErr, setItemErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  const saveAnswer = async (e: FormEvent) => {
    e.preventDefault();
    if (!value) return setErr('Choose agree, disagree or not sure.');
    setBusy(true);
    setErr(undefined);
    try {
      await api.post(`/api/rooms/${encodeURIComponent(roomId)}/answer`, { value, ...(note.trim() ? { note: note.trim() } : {}) });
      setSaved(`Your private answer is saved: ${ANSWER_WORDS[value].toLowerCase()}. You can change it until the room closes.`);
      onDone();
    } catch (e2) {
      setErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  };
  const addItem = async (e: FormEvent) => {
    e.preventDefault();
    if (!item.trim()) return;
    setBusy(true);
    setItemErr(undefined);
    try {
      await api.post(`/api/rooms/${encodeURIComponent(roomId)}/outcome`, { kind, text: item.trim() });
      setItem('');
      onDone();
    } catch (e2) {
      setItemErr(errorText(e2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-8">
      <section aria-labelledby="final-answer">
        <h2 id="final-answer" className="mb-2">
          Your private final answer
        </h2>
        <p className="mb-3">Only the totals are shown, and only after the room closes. Nobody sees how you answered.</p>
        <form onSubmit={(e) => void saveAnswer(e)}>
          <fieldset className="mb-4">
            <legend className="mb-2 font-bold">{data.room.statement ? `“${data.room.statement.text}”` : 'Where do you stand now?'}</legend>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-6">
              {(Object.keys(ANSWER_WORDS) as AnswerValue[]).map((v) => (
                <label key={v} className="flex min-h-11 items-center gap-2">
                  <input type="radio" name="final" value={v} checked={value === v} onChange={() => setValue(v)} className="h-5 w-5" />
                  {ANSWER_WORDS[v]}
                </label>
              ))}
            </div>
          </fieldset>
          <Field label="A note for yourself (optional, private)">
            <textarea className={inputClass} value={note} maxLength={280} onChange={(e) => setNote(e.target.value)} />
          </Field>
          {err && <Banner tone="warn" className="mb-3">{err}</Banner>}
          {saved && (
            <p role="status" className="mb-3 font-bold text-agree">
              {saved}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            Save my private answer
          </Button>
        </form>
      </section>

      <section aria-labelledby="add-outcome">
        <h2 id="add-outcome" className="mb-2">
          Add to what the room found
        </h2>
        <p className="mb-3">Each of you can add a reason for, a reason against, a better wording or a question for experts. These go back to the assembly in your words. The facilitator does not write any of it.</p>
        {mustWriteFirst ? (
          <p className="text-muted">This was a slow room, and you did not write in it, so what the others added stays with them. You can still give your private final answer above.</p>
        ) : (
          <form onSubmit={(e) => void addItem(e)}>
            <Field label="What are you adding?">
              <select className={inputClass} value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
                {OUTCOME_KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="In your words" error={itemErr}>
              <textarea className={inputClass} value={item} maxLength={280} onChange={(e) => setItem(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" disabled={busy || !item.trim()}>
              Add it
            </Button>
          </form>
        )}
        {data.room.outcome && (
          <Card className="mt-4">
            <h3 className="mb-2">Added so far</h3>
            <OutcomeView outcome={data.room.outcome} headingLevel={4} />
          </Card>
        )}
        <CloseWhenDone roomId={roomId} onDone={onDone} />
      </section>
    </div>
  );
}

function CloseWhenDone({ roomId, onDone }: { roomId: string; onDone: () => void }) {
  const [err, setErr] = useState<string>();
  return (
    <div className="mt-6">
      <p className="mb-2 text-muted">When everyone has given their answer, anyone in the room can close it.</p>
      {err && <Banner tone="warn" className="mb-2">{err}</Banner>}
      <Button
        variant="quiet"
        onClick={() => {
          api
            .post(`/api/rooms/${encodeURIComponent(roomId)}/close`)
            .then(onDone)
            .catch((e: unknown) => setErr(errorText(e)));
        }}
      >
        Close the room
      </Button>
    </div>
  );
}
