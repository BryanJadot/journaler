'use client';

import {
  EllipsisHorizontalIcon,
  StarIcon as StarOutlineIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useRef } from 'react';

import {
  deleteThreadAction,
  setThreadStarredAction,
} from '@/app/journal/chat/actions';
import type { ThreadSummary } from '@/lib/chat/types';
import { getChatUrl } from '@/lib/chat/url-helpers';

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
 * - Shows dropdown menu with star/unstar and delete options on hover/focus
 * - Handles thread starring and deletion with proper navigation and cache invalidation
 * - Shows "No threads yet" message when thread list is empty
 * - Truncates long thread names with tooltip showing full text
 * - Manages dropdown state to prevent UI conflicts during actions
 *
 * @param threads Array of thread summaries containing id, name, updatedAt, and starred
 */
export function SidebarThreadsList({ threads }: { threads: ThreadSummary[] }) {
  const pathname = usePathname();
  const router = useRouter();

  // Separate starred and unstarred threads for distinct UI sections
  // Database query already sorts starred first, but we separate them for different container styling
  const starredThreads = useMemo(
    () => threads.filter((thread) => thread.starred),
    [threads]
  );
  const unstarredThreads = useMemo(
    () => threads.filter((thread) => !thread.starred),
    [threads]
  );

  // Map to store dropdown element references for programmatic control
  // Enables closing dropdowns when actions are triggered to prevent UI conflicts
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Extract thread ID from pathname (e.g., /journal/chat/uuid)
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
    // Close the dropdown by removing open attribute
    const dropdown = dropdownRefs.current.get(threadId);
    if (dropdown) {
      dropdown.removeAttribute('open');
    }

    const result = await setThreadStarredAction(threadId, starred);

    if (result.success) {
      // Refresh to update the thread list
      router.refresh();
    }
  };

  /**
   * Handles the deletion of a chat thread with proper UI feedback and navigation.
   *
   * This function manages the complete flow of thread deletion including:
   * - Closing any open dropdown menus to prevent UI conflicts
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
    // Close the dropdown by removing open attribute
    const dropdown = dropdownRefs.current.get(threadId);
    if (dropdown) {
      dropdown.removeAttribute('open');
    }

    const result = await deleteThreadAction(threadId);

    if (result.success) {
      // If we deleted the current thread, navigate to home
      if (threadId === currentThreadId) {
        router.push('/');
      }
      // The sidebar will refresh automatically via cache invalidation
      router.refresh();
    }
  };

  // Helper function to render a single thread item
  const renderThreadItem = (thread: ThreadSummary) => (
    <li key={thread.id} className="w-full">
      <div
        className={clsx('flex flex-row group w-full p-0', {
          'menu-active': thread.id === currentThreadId,
        })}
      >
        <Link
          href={getChatUrl(thread.id)}
          className="flex-1 min-w-0 pl-3 py-1.5 block"
          title={thread.name} // Tooltip shows full name for truncated text
        >
          <div className="flex items-center gap-1.5">
            {/* Show solid star icon next to thread name for visual indication */}
            {thread.starred && <StarSolidIcon className="w-4 h-4 shrink-0" />}
            <div className="truncate">{thread.name}</div>
          </div>
        </Link>

        <div
          className="shrink-0 dropdown dropdown-end"
          ref={(el) => {
            if (el) dropdownRefs.current.set(thread.id, el);
          }}
        >
          <div
            tabIndex={0}
            role="button"
            className="invisible group-hover:visible focus:visible pr-3 py-1.5"
          >
            <EllipsisHorizontalIcon className="w-4 h-4" />
          </div>
          <ul
            tabIndex={0}
            className="menu dropdown-content bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm text-base-content"
          >
            <li>
              <button
                onClick={() => handleToggleStar(thread.id, !thread.starred)}
                className="flex flex-row items-center justify-left"
              >
                {thread.starred ? (
                  <>
                    <StarOutlineIcon className="w-4 h-4" /> Unstar
                  </>
                ) : (
                  <>
                    <StarSolidIcon className="w-4 h-4" /> Star
                  </>
                )}
              </button>
            </li>
            <li>
              <button
                onClick={() => handleDeleteThread(thread.id)}
                className="flex flex-row items-center justify-left"
              >
                <TrashIcon className="w-4 h-4" /> Delete
              </button>
            </li>
          </ul>
        </div>
      </div>
    </li>
  );

  return (
    <>
      {/* Starred threads section - fixed, non-scrollable */}
      {starredThreads.length > 0 && (
        <>
          <div className="shrink-0 border-t border-base-300">
            <ul className="menu w-full">
              {starredThreads.map(renderThreadItem)}
            </ul>
          </div>
        </>
      )}

      {/* Unstarred threads section - scrollable */}
      <div className="flex-1 border-t border-base-300 overflow-y-auto">
        <ul className="menu w-full">
          {unstarredThreads.map(renderThreadItem)}

          {/* Display helpful message when user has no chat threads */}
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
