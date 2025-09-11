import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Journaler',
  description: 'Organize your thoughts and feelings',
};

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
