import { useParams } from 'react-router';
import { useAssembly } from '../../lib/useAssembly';
import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function Priorities() {
  const { slug } = useParams();
  const { data } = useAssembly(slug);
  return (
    <Layout title="Choose your priorities" assembly={data?.assembly} kicker={data?.assembly.question}>
      <EmptyState title="This page is being built">
        <p>This is where you will choose up to three common-ground statements.</p>
      </EmptyState>
    </Layout>
  );
}
