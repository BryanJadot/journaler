'use client';

import { useThreadName } from '@/lib/store/thread-store';

/**
 * Displays the thread name with support for both server and client updates.
 *
 * Shows the initial thread name immediately from server data, then subscribes
 * to the store for any client-side updates (e.g., if user renames the thread).
 *
 * @param initialThreadName - The thread name from server-side data
 * @returns Thread header with the current thread name
 *
 * @example
 * ```tsx
 * <ThreadHeader initialThreadName={thread.name} />
 * ```
 */
export default function ThreadHeader({
  initialThreadName,
}: {
  initialThreadName: string;
}) {
  // Subscribe to store updates for real-time thread name changes
  const storeThreadName = useThreadName();

  // Implement fallback strategy: prefer store value, use server value as backup
  // This ensures we always have a name to display, even during store initialization
  const threadName = storeThreadName || initialThreadName;

  return (
    <div className="shrink-0 border-b p-4">
      {/* Display thread name with consistent styling */}
      <h1 className="text-2xl font-bold text-gray-900">{threadName}</h1>
    </div>
  );
}
