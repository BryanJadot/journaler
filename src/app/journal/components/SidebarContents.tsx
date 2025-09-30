import { DocumentPlusIcon } from '@heroicons/react/24/outline';
import { Suspense } from 'react';

import { createNewThreadAction } from '@/app/journal/chat/actions';
import { SidebarThreadsList } from '@/app/journal/components/SidebarThreadsList';
import { getUserIdFromHeader } from '@/lib/auth/get-user-from-header';
import { getCachedThreadSummaries } from '@/lib/db/threads';

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
 * Renders a fixed-width sidebar containing three sections:
 * - "New Chat" button that creates a new thread via server action
 * - Starred threads for quick access (non-scrollable)
 * - Unstarred threads in a scrollable area
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
            <button type="submit" className="flex items-center gap-1.5">
              <DocumentPlusIcon className="w-4 h-4" />
              New Chat
            </button>
          </li>
        </ul>
      </form>

      {/*
            Thread list with Suspense boundary for progressive rendering
            Shows skeleton loader while threads are being fetched
          */}
      <Suspense fallback={<SidebarThreadsSkeleton />}>
        <SidebarThreadsListServer />
      </Suspense>
    </div>
  );
}
