import Link from 'next/link';

import { getCachedAuthedUserOrRedirect } from '@/app/(authed)/get-authed-user';
import { getThreadSummariesForUser } from '@/lib/chat/service';

/**
 * Internal component that renders the sidebar content with user's chat threads.
 *
 * This async server component fetches the authenticated user's thread summaries
 * and renders them as navigation links. The component handles three states:
 * - Loading (handled by parent Suspense boundary)
 * - Empty state (shows "No threads yet" message)
 * - Populated state (shows thread navigation links)
 *
 * @returns {Promise<JSX.Element>} The rendered sidebar content
 *
 * @throws {Error} Redirects to login if user is not authenticated
 * @throws {Error} Database error if thread fetching fails
 */
async function SidebarContent() {
  // Verify authentication and get user ID (redirects if not authenticated)
  const userId = await getCachedAuthedUserOrRedirect();

  // Fetch lightweight thread summaries for navigation (no message content)
  const threads = await getThreadSummariesForUser(userId);

  return (
    <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col">
      {/* Fixed header section */}
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Chat Threads</h2>
      </div>

      {/* Scrollable navigation area */}
      <div className="flex-1 overflow-y-auto">
        <nav className="p-2 space-y-1">
          {/* Primary action: Create new chat thread */}
          <Link
            href="/chat/new"
            className="block w-full text-left px-3 py-2 rounded-md text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            + New Chat
          </Link>

          {/* Existing thread navigation links */}
          {threads.map((thread) => (
            <Link
              key={thread.id}
              href={`/chat/${thread.id}`}
              className="block px-3 py-2 rounded-md text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 transition-colors truncate"
              title={thread.name} // Show full name on hover for long thread names
            >
              {thread.name}
            </Link>
          ))}

          {/* Empty state when user has no threads */}
          {threads.length === 0 && (
            <div className="px-3 py-2 text-sm text-gray-500 italic">
              No threads yet
            </div>
          )}
        </nav>
      </div>
    </div>
  );
}

/**
 * Sidebar navigation component for authenticated chat application.
 *
 * This component provides a fixed-width navigation sidebar that displays:
 * - A "New Chat" button to create threads
 * - A scrollable list of the user's existing chat threads
 * - An empty state message when no threads exist
 *
 * The component is designed to work within a Suspense boundary for loading states
 * and automatically handles user authentication verification.
 *
 * @returns {JSX.Element} The sidebar navigation component
 *
 * @example
 * ```tsx
 * // Used within layout with Suspense boundary
 * <Suspense fallback={<SidebarSkeleton />}>
 *   <Sidebar />
 * </Suspense>
 * ```
 *
 * Architecture notes:
 * - Uses server-side rendering to fetch thread data
 * - Implements responsive design with fixed width (w-64 = 256px)
 * - Thread list is ordered by most recent activity (handled by service layer)
 * - Long thread names are truncated with ellipsis and show full text on hover
 */
export default function Sidebar() {
  return <SidebarContent />;
}
