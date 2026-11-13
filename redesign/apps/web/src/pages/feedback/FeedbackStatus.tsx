import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function FeedbackStatus() {
  return (
    <Layout title="Your feedback">
      <EmptyState title="This page is being built">
        <p>This is where you will see your feedback and what happened to it.</p>
      </EmptyState>
    </Layout>
  );
}
