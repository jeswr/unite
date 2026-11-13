import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { api, ApiError, useApi } from '../../lib/api';
import { useMe } from '../../lib/me';
import { useAssembly } from '../../lib/useAssembly';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Field, inputClass } from '../../ui/Field';
import { Layout } from '../../ui/Layout';
import type { ConsentInfo, ConversationView } from '@unite/shared';
import { LANGUAGE_CHOICES, languageFromBrowser, localeFor, OTHER_LANGUAGE, ROUTE_CHOICES } from './words';

function browserLanguage(): string {
  return (typeof navigator !== 'undefined' && navigator.language) || 'en-GB';
}

/** /talk and /a/:slug/talk: choose how to take part, the language, read the consent lines, and start. */
export default function TalkStart() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { refresh } = useMe();
  const { data: view, error: assemblyError } = useAssembly(slug);
  const { data: consent } = useApi<ConsentInfo>('/api/talk/consent');
  const [route, setRoute] = useState<(typeof ROUTE_CHOICES)[number]['value']>('ai');
  const [browser] = useState(browserLanguage);
  const [choice, setChoice] = useState(() => languageFromBrowser(browser).choice);
  const [otherLanguage, setOtherLanguage] = useState(() => (languageFromBrowser(browser).choice === OTHER_LANGUAGE ? browser : ''));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function begin(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const started = await api.post<ConversationView>('/api/conversations', {
        ...(slug ? { assemblySlug: slug } : {}),
        route,
        language: localeFor(choice, browser, otherLanguage),
      });
      const id = started.conversation.id;
      await api.post(`/api/conversations/${id}/consent`);
      await refresh();
      navigate(`/talk/${id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The conversation could not start. Please try again.');
      setBusy(false);
    }
  }

  const assembly = view?.assembly;
  const current = view?.myConversation && (view.myConversation.status === 'active' || view.myConversation.status === 'reviewing') ? view.myConversation : null;

  return (
    <Layout title="Start a conversation" assembly={assembly} kicker={assembly ? assembly.title : undefined}>
      {assemblyError && <Banner tone="warn">{assemblyError.message}</Banner>}
      {assembly ? (
        <p className="mb-5">
          This conversation is part of an assembly hosted by {assembly.hostName}. Its question is: <strong>{assembly.question}</strong> You will
          be asked about your own days, not asked to answer the question directly.
        </p>
      ) : (
        <p className="mb-5">A private conversation about a real day in your life, and what a good ordinary day would look like.</p>
      )}
      {current && (
        <p className="mb-5">
          You already have a conversation here.{' '}
          <Link to={current.status === 'reviewing' ? `/talk/${current.id}/review` : `/talk/${current.id}`}>
            {current.status === 'reviewing' ? 'Check your points' : 'Carry on with it'}
          </Link>
          . Starting a new one leaves that one unfinished.
        </p>
      )}

      <form onSubmit={begin}>
        <fieldset className="mb-6">
          <legend className="mb-2 font-bold">How would you like to take part?</legend>
          <div className="space-y-2">
            {ROUTE_CHOICES.map((c) => (
              <label key={c.value} className={`flex gap-3 rounded-ui border p-3 ${route === c.value ? 'border-accent' : 'border-line'}`}>
                <input type="radio" name="route" value={c.value} checked={route === c.value} onChange={() => setRoute(c.value)} className="mt-1.5 h-5 w-5 shrink-0" />
                <span>
                  <span className="block font-bold">{c.label}</span>
                  <span className="block text-muted">
                    {c.line}
                    {c.value === 'ai' && consent && !consent.aiEnabled && ' The AI interviewer is not switched on just now, so the questions will be fixed ones.'}
                  </span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <Field label="Language" hint="The interviewer replies in the language you write in.">
          <select className={`${inputClass} max-w-xs`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            {LANGUAGE_CHOICES.map((l) => (
              <option key={l.code} value={l.code} lang={l.code}>
                {l.name}
              </option>
            ))}
            <option value={OTHER_LANGUAGE}>Another language</option>
          </select>
        </Field>
        {choice === OTHER_LANGUAGE && (
          <Field label="Which language?" hint="Its name, or a code such as “ta” or “pt-BR”.">
            <input className={`${inputClass} max-w-xs`} value={otherLanguage} onChange={(e) => setOtherLanguage(e.target.value)} autoComplete="language" maxLength={35} />
          </Field>
        )}

        <h2 className="mb-2">Before you start</h2>
        <ul className="mb-6 list-disc space-y-2 pl-6">
          {(consent?.lines ?? []).map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>

        {error && (
          <Banner tone="warn" className="mb-4">
            {error}
          </Banner>
        )}
        <Button type="submit" disabled={busy || !consent}>
          {busy ? 'Starting…' : 'I understand. Start'}
        </Button>
      </form>
    </Layout>
  );
}
