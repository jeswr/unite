import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function Feedback() {
  return (
    <Layout title="Give feedback">
      <EmptyState title="This page is being built">
        <p>This is where you will tell us what works and what does not.</p>
      </EmptyState>
    </Layout>
  );
}
