import { useState } from 'react';
import { useSearchParams } from 'react-router';
import { stageInfo, type Assembly, type AssemblySummary } from '@unite/shared';
import { useApi } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';
import { AssemblyPanel } from './AssemblyPanel';
import { Intake, type IntakeDraft } from './Intake';
import { PasscodeGate } from './PasscodeGate';
import { PledgeEditor, valuesFromDraft } from './PledgeEditor';

type Screen = { kind: 'list' } | { kind: 'intake' } | { kind: 'assembly'; slug: string };

function NewAssembly({ fromThemeId, onDone }: { fromThemeId?: string; onDone: (a: Assembly) => void }) {
  const [step, setStep] = useState<{ draft?: IntakeDraft; intakeId?: string; editing: boolean }>({ editing: false });
  if (!step.editing) return <Intake onDone={(draft, intakeId) => setStep({ draft, intakeId, editing: true })} onSkip={() => setStep({ editing: true })} />;
  const initial = step.draft
    ? valuesFromDraft(step.draft)
    : valuesFromDraft({ question: '', affected: '', groups: [], rule: '', kind: 'advisory', pledge: {} });
  return (
    <section aria-labelledby="editor-h">
      <h2 id="editor-h" className="mb-2">
        The pledge
      </h2>
      <p className="mb-6 text-muted">{step.draft ? 'Filled in from your answers, in your own words. Check every field before you publish.' : 'Fill in each field. Nothing is public until you publish.'}</p>
      <PledgeEditor initial={initial} intakeId={step.intakeId} fromThemeId={fromThemeId} onPublished={onDone} />
    </section>
  );
}

/** /host: passcode gate, then my assemblies, opening a new one, and each assembly's jobs. */
export default function HostConsole() {
  const [params] = useSearchParams();
  const fromThemeId = params.get('fromTheme') ?? undefined;
  const [screen, setScreen] = useState<Screen>(fromThemeId ? { kind: 'intake' } : { kind: 'list' });
  const [published, setPublished] = useState<string>();
  const { data, reload } = useApi<{ assemblies: AssemblySummary[] }>('/api/assemblies');
  const mine = (data?.assemblies ?? []).filter((a) => !a.isOpenListening).sort((x, y) => x.title.localeCompare(y.title, 'en-GB'));
  const current = screen.kind === 'assembly' ? mine.find((a) => a.slug === screen.slug) : undefined;

  const title =
    screen.kind === 'list' ? 'For hosts' : screen.kind === 'assembly' ? (current?.title ?? 'An assembly') : 'Open a new assembly';

  return (
    <Layout title={title} kicker={screen.kind === 'list' ? undefined : 'For hosts'}>
      <PasscodeGate role="host">
        {screen.kind !== 'list' && (
          <p className="mb-6">
            <Button variant="quiet" className="!px-0" onClick={() => (reload(), setScreen({ kind: 'list' }))}>
              Back to my assemblies
            </Button>
          </p>
        )}
        {screen.kind === 'list' && (
          <>
            {published && (
              <Banner className="mb-6" >
                {published}
              </Banner>
            )}
            <p className="mb-4">Open an assembly on a question you can act on, publish your pledge, then answer every priority people put to you by the date you promised.</p>
            <Button onClick={() => setScreen({ kind: 'intake' })} className="mb-8">
              Open a new assembly
            </Button>
            <h2 className="mb-3">My assemblies</h2>
            {mine.length === 0 ? (
              <EmptyState title="No assemblies yet">
                <p>The assemblies you open will be listed here, with what each one needs from you next.</p>
              </EmptyState>
            ) : (
              <ul className="space-y-3">
                {mine.map((a) => (
                  <Card as="li" key={a.slug}>
                    <p className="font-bold">{a.title}</p>
                    <p className="mb-2 text-muted">
                      {a.hostName} · {stageInfo(a.stage).title}
                    </p>
                    <Button variant="secondary" onClick={() => setScreen({ kind: 'assembly', slug: a.slug })}>
                      Manage<span className="sr-only"> {a.title}</span>
                    </Button>
                  </Card>
                ))}
              </ul>
            )}
          </>
        )}
        {screen.kind === 'intake' && (
          <NewAssembly
            fromThemeId={fromThemeId}
            onDone={(a) => {
              setPublished(`“${a.title}” is published. People can challenge the pledge until the date shown on its page.`);
              reload();
              setScreen({ kind: 'list' });
            }}
          />
        )}
        {screen.kind === 'assembly' && <AssemblyPanel slug={screen.slug} />}
      </PasscodeGate>
    </Layout>
  );
}
