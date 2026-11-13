import { useState } from 'react';
import { Button } from '../../ui/Button';
import { inputClass } from '../../ui/Field';
import type { FeedbackAnswer } from './types';

interface Props {
  answers: FeedbackAnswer[];
  /** Saves a corrected answer; resolves when saved. */
  onSave: (index: number, answer: string) => Promise<void>;
}

function AnswerItem({ answer, index, onSave }: { answer: FeedbackAnswer; index: number; onSave: Props['onSave'] }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(answer.answer);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const id = `feedback-answer-${index}`;

  const save = async () => {
    setSaving(true);
    setError(undefined);
    try {
      await onSave(index, text);
      setEditing(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <li className="border-t border-line pt-3">
      <h3 className="mb-1 text-base">{answer.question}</h3>
      {editing ? (
        <div>
          <label htmlFor={id} className="sr-only">
            Your answer to: {answer.question}
          </label>
          <textarea id={id} rows={4} value={text} onChange={(e) => setText(e.target.value)} className={inputClass} maxLength={4000} />
          {error && (
            <p role="alert" className="mt-1 font-bold text-warn">
              {error}
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
            <Button
              variant="quiet"
              onClick={() => {
                setText(answer.answer);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="whitespace-pre-line">{answer.answer}</p>
          <Button
            variant="quiet"
            className="!min-h-0 !px-0 !py-1"
            onClick={() => {
              setText(answer.answer);
              setEditing(true);
            }}
            aria-label={`Change your answer to: ${answer.question}`}
          >
            Change
          </Button>
        </>
      )}
    </li>
  );
}

/** "What we have recorded so far": each answer under its question, editable in place. */
export function AnswersPanel({ answers, onSave }: Props) {
  const recorded = answers.map((a, index) => ({ a, index })).filter(({ a }) => a.answer.trim());
  return (
    <section aria-labelledby="feedback-answers-heading">
      <h2 id="feedback-answers-heading" className="mb-1">
        What we have recorded so far
      </h2>
      <p className="mb-3 text-muted">Your words, as you said them. Change anything that is not right.</p>
      {recorded.length ? (
        <ul className="space-y-3">
          {recorded.map(({ a, index }) => (
            <AnswerItem key={`${index}-${a.answer}`} answer={a} index={index} onSave={onSave} />
          ))}
        </ul>
      ) : (
        <p className="text-muted">Nothing yet. Your answers will appear here as you go.</p>
      )}
    </section>
  );
}
