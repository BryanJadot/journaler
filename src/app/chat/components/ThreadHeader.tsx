'use client';

import { useThreadName } from '@/lib/store/thread-store';

/**
 * Header component that displays thread name from the store.
 *
 * Shows the current thread's name using data from the thread store.
 * This component automatically updates when the store data changes.
 *
 * @returns JSX element containing the thread header
 */
export default function ThreadHeader() {
  const threadName = useThreadName();

  return (
    <div className="mb-4">
      <h1 className="text-2xl font-bold text-gray-900">{threadName}</h1>
    </div>
  );
}
