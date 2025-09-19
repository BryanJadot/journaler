import React from 'react';

import { SidebarContents } from '@/app/journal/components/Sidebar';

/**
 * Journal layout component that provides persistent sidebar navigation.
 *
 * This layout wraps all journal routes (/journal/*) with a fixed sidebar
 * containing thread navigation and a "New Chat" button. The sidebar remains
 * visible and accessible across all journal pages for consistent navigation.
 *
 * Uses DaisyUI's drawer component for responsive sidebar behavior.
 *
 * @param children - The page content to render in the main area
 */
export default function JournalLayout({
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
