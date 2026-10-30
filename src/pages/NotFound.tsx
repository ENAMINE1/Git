import { Link } from 'react-router-dom';
import { EmptyState } from '@/components/ui';

export function NotFound() {
  return (
    <div className="py-16">
      <EmptyState title="Not in the library" action={<Link className="btn" to="/">Back to Discover</Link>}>
        This item may have been deleted or merged into another entry.
      </EmptyState>
    </div>
  );
}
