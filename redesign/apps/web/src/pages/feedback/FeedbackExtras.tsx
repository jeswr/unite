import { useState, type ChangeEvent } from 'react';
import { Link } from 'react-router';
import { MAX_SCREENSHOT_CHARS } from '@unite/shared';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import type { FeedbackView } from './types';

type Patch = (body: Record<string, unknown>) => Promise<void>;

const message = (e: unknown) => (e as Error)?.message ?? 'Something went wrong. Please try again.';

/** Optional name and contact. */
export function AboutYou({ feedback, onPatch }: { feedback: FeedbackView; onPatch: Patch }) {
  const [name, setName] = useState(feedback.name ?? '');
  const [contact, setContact] = useState(feedback.contact ?? '');
  const [note, setNote] = useState<string>();
  const [error, setError] = useState<string>();
  const save = async () => {
    setError(undefined);
    try {
      await onPatch({ name: name.trim() || null, contact: contact.trim() || null });
      setNote('Saved.');
    } catch (e) {
      setError(message(e));
    }
  };
  return (
    <section aria-labelledby="feedback-about-heading" className="mb-8">
      <h2 id="feedback-about-heading" className="mb-3">
        Your name and how to reach you
      </h2>
      <p className="mb-4 text-muted">Both are optional. You do not need to sign in.</p>
      <Field label="Your name (optional)">
        <input className={inputClass} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      </Field>
      <Field label="How to reach you (optional)" hint="An email address or phone number, only if you are happy for us to reply.">
        <input className={inputClass} value={contact} maxLength={200} onChange={(e) => setContact(e.target.value)} autoComplete="email" />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void save()}>
          Save these details
        </Button>
        <span aria-live="polite" className="text-muted">
          {note}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 font-bold text-warn">
          {error}
        </p>
      )}
    </section>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(new Error('The file could not be read.'));
    r.readAsDataURL(file);
  });
}

/** An optional screenshot: PNG or JPEG, at most 400 KB. */
export function Screenshot({ feedback, onPatch }: { feedback: FeedbackView; onPatch: Patch }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const choose = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(undefined);
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') return setError('The screenshot must be a PNG or JPEG image.');
    setBusy(true);
    try {
      const url = await readAsDataUrl(file);
      if (url.length > MAX_SCREENSHOT_CHARS) return setError('The screenshot is too large. It can be at most 400 KB.');
      await onPatch({ screenshot: url });
    } catch (err) {
      setError(message(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="feedback-shot-heading" className="mb-8">
      <h2 id="feedback-shot-heading" className="mb-3">
        A screenshot (optional)
      </h2>
      {feedback.screenshot ? (
        <>
          <img src={feedback.screenshot} alt="Your screenshot" className="mb-3 max-h-64 max-w-full rounded-ui border border-line" />
          <Button variant="secondary" onClick={() => void onPatch({ screenshot: null }).catch((err) => setError(message(err)))}>
            Remove the screenshot
          </Button>
        </>
      ) : (
        <Field label="Add a picture of what you were looking at" hint="A PNG or JPEG image, at most 400 KB.">
          <input type="file" accept="image/png,image/jpeg" onChange={(e) => void choose(e)} disabled={busy} className="block max-w-full" />
        </Field>
      )}
      {error && (
        <p role="alert" className="mt-2 font-bold text-warn">
          {error}
        </p>
      )}
    </section>
  );
}

/** The public summary: shown exactly as it would be published, kept only if the person agrees, and withdrawable. */
export function PublicSummary({ feedback, onPatch }: { feedback: FeedbackView; onPatch: Patch }) {
  const [error, setError] = useState<string>();
  const { state, text } = feedback.publicIssue;
  const hasAnswers = feedback.answers.some((a) => a.answer.trim());
  const act = (body: Record<string, unknown>) => {
    setError(undefined);
    onPatch({ publicIssue: body }).catch((e) => setError(message(e)));
  };
  return (
    <section aria-labelledby="feedback-public-heading" className="mb-8">
      <h2 id="feedback-public-heading" className="mb-3">
        A public summary (optional)
      </h2>
      <p className="mb-3">
        With your agreement, your answers can be published as a public summary so that others can see what people asked for. Links and email addresses
        are taken out. Your name and contact are never included. In this test version nothing is published yet.
      </p>
      {(state === 'previewed' || state === 'agreed') && text ? (
        <>
          <p className="mb-1 font-bold">{state === 'agreed' ? 'You agreed to publish this summary:' : 'It would be published exactly like this:'}</p>
          <blockquote data-testid="public-summary" className="mb-3 rounded-ui border border-line bg-soft px-3 py-2 whitespace-pre-line">
            {text}
          </blockquote>
          {state === 'previewed' ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => act({ state: 'agreed', text })}>Yes, publish this summary</Button>
              <Button variant="secondary" onClick={() => act({ state: 'none' })}>
                No, keep it private
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => act({ state: 'withdrawn' })}>
              Withdraw the public summary
            </Button>
          )}
        </>
      ) : hasAnswers ? (
        <>
          {state === 'withdrawn' && <p className="mb-2 text-muted">You withdrew the public summary.</p>}
          <Button variant="secondary" onClick={() => act({ state: 'previewed' })}>
            Show me the summary
          </Button>
        </>
      ) : (
        <p className="text-muted">Once you have answered a question, you can see the summary here before deciding.</p>
      )}
      {error && (
        <p role="alert" className="mt-2 font-bold text-warn">
          {error}
        </p>
      )}
    </section>
  );
}

/** The private link to "your feedback", with a button to copy it. */
export function PrivateLink({ token }: { token: string }) {
  const url = `${window.location.origin}/feedback/${token}`;
  const [copied, setCopied] = useState<string>();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied('Copied.');
    } catch {
      setCopied('Copying did not work. Select the link and copy it yourself.');
    }
  };
  return (
    <section aria-labelledby="feedback-link-heading" className="mb-8">
      <h2 id="feedback-link-heading" className="mb-3">
        Your private link
      </h2>
      <p className="mb-3">
        Keep this link to see <Link to={`/feedback/${token}`}>your feedback</Link> and what we do about it. Anyone with the link can see it, so keep it to yourself.
      </p>
      <Field label="The link">
        <input className={inputClass} readOnly value={url} onFocus={(e) => e.target.select()} />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="secondary" onClick={() => void copy()}>
          Copy the link
        </Button>
        <span aria-live="polite" className="text-muted">
          {copied}
        </span>
      </div>
    </section>
  );
}
