import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function Changes() {
  return (
    <Layout title="What has changed">
      <EmptyState title="This page is being built">
        <p>This is where each release and what changed in it will be listed.</p>
      </EmptyState>
    </Layout>
  );
}
