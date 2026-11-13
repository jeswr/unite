import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function Review() {
  return (
    <Layout title="Here is what I heard">
      <EmptyState title="This page is being built">
        <p>This is where you check the points from your conversation before anything is shared.</p>
      </EmptyState>
    </Layout>
  );
}
