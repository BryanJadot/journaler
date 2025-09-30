import { Bars3Icon } from '@heroicons/react/24/outline';
import React from 'react';

import { SidebarContents } from '@/app/journal/components/SidebarContents';

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
    <div className="drawer xl:drawer-open">
      <input id="nav-drawer" type="checkbox" className="drawer-toggle" />

      {/* Left sidebar with thread navigation */}
      <nav className="drawer-side">
        <label
          htmlFor="nav-drawer"
          aria-label="close sidebar"
          className="drawer-overlay"
        ></label>
        <SidebarContents />
      </nav>

      {/* Main content area for page-specific content */}
      <main className="drawer-content">
        <label
          htmlFor="nav-drawer"
          className="btn btn-square drawer-button xl:hidden fixed"
          style={{
            top: '1rem',
            left: '1rem',
          }}
        >
          <Bars3Icon className="w-6 h-6" />
        </label>
        {children}
      </main>
    </div>
  );
}
