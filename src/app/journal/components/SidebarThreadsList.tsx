'use client';

import { EllipsisHorizontalIcon, TrashIcon } from '@heroicons/react/24/outline';
import clsx from 'clsx';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useMemo, useRef } from 'react';

import { deleteThreadAction } from '@/app/journal/chat/actions';
import type { ThreadSummary } from '@/lib/chat/types';
import { getChatUrl } from '@/lib/chat/url-helpers';

/**
 * Client component that renders navigational links for chat threads with management actions.
 *
 * This component provides a comprehensive thread management interface that combines
 * navigation with administrative actions. Each thread is displayed as a clickable
 * link for navigation, with hover-activated dropdown menus containing management
 * options like deletion.
 *
 * Features:
 * - Displays thread list with names as clickable navigation links
 * - Highlights currently active thread based on URL pathname
 * - Shows dropdown menu with delete option on hover/focus
 * - Handles thread deletion with proper navigation and cache invalidation
 * - Shows "No threads yet" message when thread list is empty
 * - Truncates long thread names with tooltip showing full text
 * - Manages dropdown state to prevent UI conflicts during actions
 *
 * @param threads Array of thread summaries containing id, name, and updatedAt
 */
export function SidebarThreadsList({ threads }: { threads: ThreadSummary[] }) {
  const pathname = usePathname();
  const router = useRouter();

  // Map to store dropdown element references for programmatic control
  // Enables closing dropdowns when actions are triggered to prevent UI conflicts
  const dropdownRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Extract thread ID from pathname (e.g., /journal/chat/uuid)
  const currentThreadId = useMemo(() => {
    const match = pathname.match(/\/journal\/chat\/([^/]+)/);
    return match?.[1] || null;
  }, [pathname]);

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

  return (
    <ul className="menu w-full">
      {/* Map through threads and create navigation links */}
      {threads.map((thread) => (
        <li
          key={thread.id}
          className={clsx('w-full', {
            'menu-active': thread.id === currentThreadId,
          })}
        >
          <div className="flex flex-row group w-full p-0">
            <Link
              href={getChatUrl(thread.id)}
              className="flex-1 min-w-0 pl-3 py-1.5"
              title={thread.name} // Tooltip shows full name for truncated text
            >
              <div className="truncate">{thread.name}</div>
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
                className="menu dropdown-content bg-base-100 rounded-box z-1 w-52 p-2 shadow-sm"
              >
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
      ))}

      {/* Display helpful message when user has no chat threads */}
      {threads.length === 0 && (
        <div className="px-3 py-2 text-sm text-neutral italic">
          No threads yet
        </div>
      )}
    </ul>
  );
}
