'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';

import {
  deleteThreadAction,
  setThreadStarredAction,
} from '@/app/journal/chat/actions';
import { ThreadItem } from '@/app/journal/components/ThreadItem';
import type { ThreadSummary } from '@/lib/chat/types';

/**
 * Client component that renders navigational links for chat threads with management actions.
 *
 * This component provides a comprehensive thread management interface that combines
 * navigation with administrative actions. It separates threads into starred and unstarred
 * sections for better organization.
 *
 * Features:
 * - Displays starred threads at the top in a fixed section
 * - Shows unstarred threads in a scrollable section below
 * - Highlights currently active thread based on URL pathname
 * - Delegates individual thread rendering to ThreadItem components
 * - Shows "No threads yet" message when thread list is empty
 *
 * @param threads Array of thread summaries containing id, name, updatedAt, and starred
 */
export function SidebarThreadsList({ threads }: { threads: ThreadSummary[] }) {
  const pathname = usePathname();
  const router = useRouter();

  // Separate starred and unstarred threads for distinct UI treatment
  // Database query pre-sorts starred first, but we split them for different layout containers
  // Starred threads get a fixed, non-scrollable section at the top
  const starredThreads = useMemo(
    () => threads.filter((thread) => thread.starred),
    [threads]
  );
  const unstarredThreads = useMemo(
    () => threads.filter((thread) => !thread.starred),
    [threads]
  );

  // Extract thread ID from URL path for active thread highlighting
  // Matches pattern: /journal/chat/{uuid}
  const currentThreadId = useMemo(() => {
    const match = pathname.match(/\/journal\/chat\/([^/]+)/);
    return match?.[1] || null;
  }, [pathname]);

  /**
   * Handles starring/unstarring a thread with UI feedback.
   *
   * This function toggles the starred status of a thread and refreshes
   * the UI to reflect the change. The starred threads appear at the top
   * of the thread list for quick access.
   *
   * @param threadId The UUID of the thread to star/unstar
   * @param starred Whether to star (true) or unstar (false) the thread
   */
  const handleToggleStar = async (threadId: string, starred: boolean) => {
    const result = await setThreadStarredAction(threadId, starred);

    if (result.success) {
      // Trigger UI refresh to reflect updated star status in sidebar
      router.refresh();
    } else {
      // TODO: Consider adding user-facing error feedback for failed star operations
      console.error('Failed to toggle star status');
    }
  };

  /**
   * Handles the deletion of a chat thread with proper UI feedback and navigation.
   *
   * This function manages the complete flow of thread deletion including:
   * - Calling the server action to delete the thread
   * - Handling post-deletion navigation when the current thread is deleted
   * - Triggering sidebar refresh to reflect the updated thread list
   *
   * The function gracefully handles both successful deletions and potential
   * errors without throwing exceptions, relying on the server action's
   * structured response format.
   *
   * @param threadId The UUID of the thread to delete
   */
  const handleDeleteThread = async (threadId: string) => {
    const result = await deleteThreadAction(threadId);

    if (result.success) {
      // Navigate away from deleted thread if it's currently active
      if (threadId === currentThreadId) {
        router.push('/'); // Return to journal home page
      }
      // Trigger sidebar refresh - thread cache is already invalidated by server action
      router.refresh();
    } else {
      // TODO: Consider adding user-facing error feedback for failed deletions
      console.error('Failed to delete thread');
    }
  };

  return (
    <>
      {/* Starred threads section - fixed position, always visible */}
      {starredThreads.length > 0 && (
        <>
          <div className="shrink-0 border-t border-base-300">
            <ul className="menu w-full">
              {starredThreads.map((thread) => (
                <ThreadItem
                  key={thread.id}
                  thread={thread}
                  isActive={thread.id === currentThreadId}
                  onDelete={handleDeleteThread}
                  onToggleStar={handleToggleStar}
                />
              ))}
            </ul>
          </div>
        </>
      )}

      {/* Unstarred threads section - scrollable container for regular threads */}
      <div className="flex-1 border-t border-base-300 overflow-y-auto">
        <ul className="menu w-full">
          {unstarredThreads.map((thread) => (
            <ThreadItem
              key={thread.id}
              thread={thread}
              isActive={thread.id === currentThreadId}
              onDelete={handleDeleteThread}
              onToggleStar={handleToggleStar}
            />
          ))}

          {/* Show empty state message when user has no threads at all */}
          {threads.length === 0 && (
            <div className="px-3 py-2 text-sm text-neutral italic">
              No threads yet
            </div>
          )}
        </ul>
      </div>
    </>
  );
}
