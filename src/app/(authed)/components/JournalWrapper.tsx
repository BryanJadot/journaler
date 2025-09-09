import React, { Suspense } from 'react';

import { getCachedAuthedUserOrRedirect } from '@/app/(authed)/get-authed-user';

import Sidebar from './Sidebar';

/**
 * Loading skeleton component displayed while the sidebar fetches thread data.
 */
function SidebarSkeleton() {
  return (
    <div className="w-64 h-full bg-gray-50 border-r border-gray-200 flex flex-col animate-pulse">
      {/* Header skeleton matching actual sidebar header */}
      <div className="p-4 border-b border-gray-200">
        <div className="h-6 bg-gray-300 rounded w-24"></div>
      </div>

      {/* Navigation skeleton with New Chat button + sample threads */}
      <div className="p-2">
        {/* New Chat button skeleton */}
        <div className="h-8 bg-blue-200 rounded mb-2"></div>

        {/* Sample thread navigation links */}
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="h-6 bg-gray-200 rounded mb-2"></div>
        ))}
      </div>
    </div>
  );
}

/**
 * Journal wrapper component that provides the sidebar layout for chat pages.
 *
 * This component wraps page content with a sidebar navigation and handles
 * authentication verification. It's designed to be used directly by pages
 * that need the journal interface with sidebar navigation.
 */
export default async function JournalWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  // Verify user authentication before rendering layout
  await getCachedAuthedUserOrRedirect();
  console.log('JournalWrapper rendered');

  return (
    <div className="flex h-screen">
      {/* Left sidebar with thread navigation */}
      <Suspense fallback={<SidebarSkeleton />}>
        <Sidebar />
      </Suspense>

      {/* Main content area for page-specific content */}
      <main className="flex-1 overflow-hidden">{children}</main>
    </div>
  );
}
