import React from 'react';

import { getCachedAuthedUserOrRedirect } from '@/lib/auth/get-authed-user';

import { SidebarContents } from './Sidebar';

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

  return (
    <div className="drawer drawer-open">
      <input id="my-drawer" type="checkbox" className="drawer-toggle" />

      {/* Main content area for page-specific content */}
      <main className="drawer-content">{children}</main>

      {/* Left sidebar with thread navigation */}
      <nav className="drawer-side">
        <SidebarContents />
      </nav>
    </div>
  );
}
