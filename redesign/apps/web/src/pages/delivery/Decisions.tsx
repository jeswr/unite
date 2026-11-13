import { useParams } from 'react-router';
import { useAssembly } from '../../lib/useAssembly';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function Decisions() {
  const { slug } = useParams();
  const { data } = useAssembly(slug);
  return (
    <Layout title="Decisions" assembly={data?.assembly} kicker={data?.assembly.question}>
      <EmptyState title="This page is being built">
        <p>This is where the decisions and the host’s answers will be shown.</p>
      </EmptyState>
    </Layout>
  );
}
