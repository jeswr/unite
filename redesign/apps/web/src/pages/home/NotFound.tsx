import { Link } from 'react-router';
import { Layout } from '../../ui/Layout';

export default function NotFound() {
  return (
    <Layout title="There is no page here">
      <p>
        The address may be mistyped, or the page may have moved. <Link to="/">Go to the home page</Link>.
      </p>
    </Layout>
  );
}
