import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Journaler',
  description: 'Organize your thoughts and feelings',
};

/**
 * Root layout component for the entire application.
 *
 * Provides the basic HTML structure and global styling for all pages.
 * This is the top-level layout that wraps all other pages and components.
 *
 * @param children - All page content and nested layouts
 * @returns Complete HTML document structure with global styles
 */
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
