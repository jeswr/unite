import type { AssemblySummary } from '@unite/shared';
import { useApi } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Button } from '../../ui/Button';
import { Layout } from '../../ui/Layout';
import { AssemblyCard } from './AssemblyCard';

const LOOP = ['Listen', 'See', 'Talk', 'Decide', 'Deliver', 'Check'];

export default function Home() {
  const { data, error } = useApi<{ assemblies: AssemblySummary[] }>('/api/assemblies');
  const open = (data?.assemblies ?? []).filter((a) => !a.isOpenListening && a.stage !== 'proposed' && a.stage !== 'review');
  return (
    <Layout title="Say what a good ordinary life looks like, and see what is done about it.">
      <p className="mb-4">
        Unite starts with a private conversation about a real day in your life. Then you see an honest picture of what everyone said, work
        through the differences together, and decide by a rule agreed in advance. A named host has promised to answer, and someone else
        checks the work.
      </p>
      <div className="mb-8">
        <Button to="/talk">Start a conversation</Button>
      </div>

      <h2 className="mb-2">The loop</h2>
      <ol className="mb-8 flex flex-wrap gap-x-2 gap-y-1" aria-label="The loop in six words">
        {LOOP.map((w, i) => (
          <li key={w} className="flex items-center gap-2">
            <span className="font-bold">{w}</span>
            {i < LOOP.length - 1 && <span aria-hidden="true" className="text-muted">→</span>}
          </li>
        ))}
      </ol>

      <h2 className="mb-3">Open assemblies</h2>
      {error && <Banner tone="warn">{error.message}</Banner>}
      {data && open.length === 0 && <p>No assemblies are open just now.</p>}
      <ul className="space-y-4">
        {open.map((a) => (
          <AssemblyCard key={a.slug} a={a} />
        ))}
      </ul>
    </Layout>
  );
}
