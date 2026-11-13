import { ASSEMBLY_STAGES, type AssemblySummary } from '@unite/shared';
import { useApi } from '../../lib/api';
import { Banner } from '../../ui/Banner';
import { Layout } from '../../ui/Layout';
import { AssemblyCard } from './AssemblyCard';

export default function Assemblies() {
  const { data, error, loading } = useApi<{ assemblies: AssemblySummary[] }>('/api/assemblies');
  const all = data?.assemblies ?? [];
  return (
    <Layout title="Assemblies">
      <p className="mb-6">
        An assembly is one question, one host and one written pledge. The host is whoever can act on the answer. Here is every assembly,
        by the stage it has reached.
      </p>
      {error && <Banner tone="warn">{error.message}</Banner>}
      {loading && !data && <p>Loading…</p>}
      {ASSEMBLY_STAGES.map((s) => {
        const here = all.filter((a) => a.stage === s.key);
        if (here.length === 0) return null;
        return (
          <section key={s.key} className="mb-8" aria-labelledby={`stage-${s.key}`}>
            <h2 id={`stage-${s.key}`} className="mb-1">
              {s.title}
            </h2>
            <p className="mb-3 text-muted">{s.description}</p>
            <ul className="space-y-4">
              {here.map((a) => (
                <AssemblyCard key={a.slug} a={a} />
              ))}
            </ul>
          </section>
        );
      })}
    </Layout>
  );
}
