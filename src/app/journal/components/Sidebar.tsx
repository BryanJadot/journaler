import Link from 'next/link';
import { Suspense } from 'react';

import { createNewThreadAction } from '@/app/journal/chat/actions';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { getChatUrl } from '@/lib/chat/redirect-helpers';
import { getThreadSummariesForUser } from '@/lib/chat/service';
import { ThreadSummary } from '@/lib/chat/types';

/**
 * Loading skeleton component displayed while the sidebar fetches thread data.
 * Renders placeholder elements to prevent layout shift during async data loading.
 *
 * @returns Three skeleton loading bars simulating thread items
 */
export function SidebarThreadsSkeleton() {
  return (
    <>
      {/* Render 3 skeleton items as loading placeholders */}
      {Array.from({ length: 10 }, (_, i) => (
        <div key={i} className="mx-2 skeleton h-6 bg-base-300"></div>
      ))}
    </>
  );
}

/**
 * Renders the list of chat thread navigation links.
 * Handles both populated and empty states for the thread list.
 *
 * @param props - Component props
 * @param props.threads - Array of thread summaries to display
 * @returns List of clickable thread links or empty state message
 */
export function SidebarThreads({ threads }: { threads: ThreadSummary[] }) {
  return (
    <ul className="menu w-full">
      {/* Map through threads and create navigation links */}
      {threads.map((thread) => (
        <li key={thread.id}>
          <Link
            href={getChatUrl(thread.id)}
            className="w-full"
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

/**
 * Main sidebar navigation component for the chat application.
 *
 * This async server component:
 * - Gets the authenticated user from headers (set by middleware)
 * - Fetches the user's chat thread summaries
 * - Renders a fixed sidebar with thread navigation
 *
 * The sidebar features:
 * - Fixed 256px width (w-64 in Tailwind)
 * - Sticky header with title
 * - "New Chat" button for creating threads via server action
 * - Scrollable list of existing threads
 * - Responsive hover states and transitions
 *
 * @async
 * @returns The complete sidebar component
 *
 * @example
 * // Usage in a layout component
 * <Suspense fallback={<SidebarSkeleton />}>
 *   <Sidebar />
 * </Suspense>
 */
export async function SidebarContents() {
  // Get authenticated user ID from headers (middleware handles auth)
  const userId = await getUserIdFromHeader();

  // Fetch all thread summaries for the authenticated user
  // These are lightweight objects containing just ID and name, not full message history
  const threads = await getThreadSummariesForUser(userId);

  return (
    <div className="flex flex-col w-80 h-screen bg-base-200 border-r border-base-300">
      {/*
            New Chat button - uses server action for thread creation
            Form submission triggers createNewThreadAction which:
            1. Creates a new thread in the database
            2. Redirects user to the new thread's chat page
          */}
      <form action={createNewThreadAction} className="shrink-0">
        <ul className="menu w-full">
          <li>
            <button type="submit">+ New Chat</button>
          </li>
        </ul>
      </form>

      {/*
            Thread list with Suspense boundary for progressive rendering
            Shows skeleton loader while threads are being fetched
          */}
      <div className="border-t border-base-300 flex flex-col flex-1 overflow-y-auto gap-2">
        <Suspense fallback={<SidebarThreadsSkeleton />}>
          <SidebarThreads threads={threads} />
        </Suspense>
      </div>
    </div>
  );
}
