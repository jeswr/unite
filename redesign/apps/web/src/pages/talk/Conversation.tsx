import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function Conversation() {
  return (
    <Layout title="Your conversation">
      <EmptyState title="This page is being built">
        <p>This is where the conversation happens, one question at a time.</p>
      </EmptyState>
    </Layout>
  );
}
