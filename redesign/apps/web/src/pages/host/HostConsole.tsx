import { EmptyState } from '../../ui/EmptyState';
import { Layout } from '../../ui/Layout';

/** Being built by another part of the build: replace this file. */
export default function HostConsole() {
  return (
    <Layout title="For hosts">
      <EmptyState title="This page is being built">
        <p>This is where hosts open assemblies, write pledges and answer priorities.</p>
      </EmptyState>
    </Layout>
  );
}
