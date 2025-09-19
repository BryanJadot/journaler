import { Suspense } from 'react';

import { createNewThreadAction } from '@/app/journal/chat/actions';
import { SidebarThreadsList } from '@/app/journal/components/SidebarThreadsList';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { getCachedThreadSummaries } from '@/lib/chat/service';

/**
 * Loading skeleton component for sidebar thread list.
 *
 * Displays placeholder skeleton bars while thread data is being fetched
 * to prevent layout shift during async loading.
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
 * Server component that fetches and provides thread data to the client component.
 *
 * Handles authentication via headers and fetches cached thread summaries
 * for the authenticated user. Renders the client-side SidebarThreadsList
 * with the fetched data.
 */
export async function SidebarThreadsListServer() {
  // Get authenticated user ID from headers (middleware handles auth)
  const userId = await getUserIdFromHeader();

  // Fetch cached thread summaries for the authenticated user
  // These are lightweight objects containing just ID and name, not full message history
  const threads = await getCachedThreadSummaries(userId);

  return <SidebarThreadsList threads={threads} />;
}

/**
 * Complete sidebar component with thread navigation and new chat functionality.
 *
 * Renders a fixed-width sidebar containing:
 * - "New Chat" button that creates a new thread via server action
 * - Scrollable list of user's existing chat threads
 * - Loading skeleton during thread data fetching
 *
 * The sidebar uses server-side rendering for thread data and includes
 * proper Suspense boundaries for progressive loading.
 */
export function SidebarContents() {
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
          <SidebarThreadsListServer />
        </Suspense>
      </div>
    </div>
  );
}
