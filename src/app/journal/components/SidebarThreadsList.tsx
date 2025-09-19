'use client';

import clsx from 'clsx';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

import type { ThreadSummary } from '@/lib/chat/types';
import { getChatUrl } from '@/lib/chat/url-helpers';

/**
 * Client component that renders navigational links for chat threads.
 *
 * Features:
 * - Displays thread list with names as clickable navigation links
 * - Highlights currently active thread based on URL pathname
 * - Shows "No threads yet" message when thread list is empty
 * - Truncates long thread names with tooltip showing full text
 *
 * @param threads - Array of thread summaries containing id and name
 */
export function SidebarThreadsList({ threads }: { threads: ThreadSummary[] }) {
  const pathname = usePathname();

  // Extract thread ID from pathname (e.g., /journal/chat/uuid)
  const currentThreadId = useMemo(() => {
    const match = pathname.match(/\/journal\/chat\/([^/]+)/);
    return match?.[1] || null;
  }, [pathname]);

  return (
    <ul className="menu w-full">
      {/* Map through threads and create navigation links */}
      {threads.map((thread) => (
        <li key={thread.id}>
          <Link
            href={getChatUrl(thread.id)}
            className={clsx('w-full', {
              'menu-active': thread.id === currentThreadId,
            })}
            title={thread.name} // Tooltip shows full name for truncated text
          >
            {thread.name}
          </Link>
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
