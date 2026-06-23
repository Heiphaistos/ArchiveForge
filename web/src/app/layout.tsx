import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ArchiveForge',
  description: 'Discord Server Exporter — Admin Panel',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="bg-[#1e1f22] text-gray-200 min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
