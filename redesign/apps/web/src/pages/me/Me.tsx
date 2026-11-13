import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function Me() {
  return (
    <Layout title="What happened to what I said">
      <EmptyState title="This page is being built">
        <p>This is where you will follow each of your points, download your data, or delete it.</p>
      </EmptyState>
    </Layout>
  );
}
