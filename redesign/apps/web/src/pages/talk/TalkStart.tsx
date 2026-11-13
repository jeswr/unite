import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function TalkStart() {
  return (
    <Layout title="Start a conversation">
      <EmptyState title="This page is being built">
        <p>You will choose how to take part: with the AI interviewer, by answering written questions, or by writing freely.</p>
      </EmptyState>
    </Layout>
  );
}
