import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { speechSupported, startDictation } from '../../lib/speech';
import { Button } from '../../ui/Button';
import { inputClass } from '../../ui/Field';
import type { FeedbackView } from '@unite/shared';

interface Props {
  feedback: FeedbackView;
  pending: boolean;
  error?: string;
  onSend: (text: string) => void;
}

/**
 * The feedback chat, in the conversation page's visual language: one readable column, the
 * interviewer's turns as quiet plain text, the person's turns in a box, and the message box
 * pinned to the bottom with a microphone where the browser can listen.
 */
export function FeedbackChat({ feedback, pending, error, onSend }: Props) {
  const [text, setText] = useState('');
  const [listening, setListening] = useState(false);
  const [voiceNote, setVoiceNote] = useState<string>();
  const [canSpeak] = useState(() => speechSupported());
  const stop = useRef<(() => void) | null>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const open = feedback.status === 'draft';

  useEffect(() => () => stop.current?.(), []);

  const send = (e?: Pick<FormEvent, 'preventDefault'>) => {
    e?.preventDefault();
    const t = text.trim();
    if (!t || pending) return;
    stop.current?.();
    onSend(t);
    setText('');
    box.current?.focus();
  };

  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) send(e);
  };

  const toggleVoice = () => {
    if (listening) {
      stop.current?.();
      setListening(false);
      return;
    }
    setVoiceNote(undefined);
    setListening(true);
    stop.current = startDictation({
      lang: 'en-GB',
      onText: (t) => setText((cur) => (cur ? `${cur} ${t}` : t)),
      onEnd: () => setListening(false),
      onError: (m) => {
        setVoiceNote(m);
        setListening(false);
      },
    });
  };

  return (
    <section aria-labelledby="feedback-chat-heading" className="min-w-0">
      <h2 id="feedback-chat-heading" className="sr-only">
        The conversation
      </h2>
      <ol aria-live="polite" className="space-y-5">
        {feedback.messages.map((m, i) =>
          m.role === 'interviewer' ? (
            <li key={i} className="whitespace-pre-line">
              <span className="sr-only">Unite asked: </span>
              {m.text}
            </li>
          ) : (
            <li key={i} className="ml-6 rounded-ui border border-accent bg-accent-soft px-3 py-2 whitespace-pre-line sm:ml-12">
              <span className="mb-1 block text-sm font-bold text-muted">You</span>
              {m.text}
            </li>
          ),
        )}
        {pending && (
          <li className="text-muted" key="pending">
            Thinking about the next question…
          </li>
        )}
      </ol>

      {open ? (
        <form onSubmit={send} className="sticky bottom-0 z-[5] mt-6 border-t border-line bg-white pt-3 pb-3">
          {error && (
            <p role="alert" className="mb-2 font-bold text-warn">
              {error}
            </p>
          )}
          <label htmlFor="feedback-message" className="mb-1 block font-bold">
            Your answer
          </label>
          <textarea
            id="feedback-message"
            ref={box}
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKey}
            className={`${inputClass} resize-y`}
            placeholder={feedback.done ? 'Anything else? Or send it when you are ready.' : 'Type here, or speak'}
            maxLength={4000}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button type="submit" disabled={pending || !text.trim()}>
              Send
            </Button>
            {canSpeak && (
              <Button variant="secondary" onClick={toggleVoice} aria-pressed={listening}>
                {listening ? 'Stop listening' : 'Speak instead'}
              </Button>
            )}
            {listening && <span className="text-muted">Listening…</span>}
          </div>
          {voiceNote && <p className="mt-2 text-muted">{voiceNote}</p>}
        </form>
      ) : (
        <p className="mt-6 border-t border-line pt-3 text-muted">This feedback has been sent. You can still correct your answers.</p>
      )}
    </section>
  );
}
