import React from 'react';

import { SidebarContents } from './Sidebar';

/**
 * Journal wrapper component that provides the sidebar layout for chat pages.
 *
 * This component wraps page content with a sidebar navigation.
 * Authentication is handled at the middleware level.
 */
export default async function JournalWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
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
