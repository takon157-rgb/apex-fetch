import './globals.css';
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import Header from './components/Header';

export const metadata: Metadata = {
  title: 'ApexFetch Dashboard',
  description: 'ApexFetch intelligent lead discovery and operations platform',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider
      appearance={{
        baseTheme: dark,
        layout: {
          unsafe_disableDevelopmentModeWarnings: true,
        },
      }}
    >
      <html lang="en">
        <body className="min-h-screen bg-slate-950 text-slate-100 antialiased selection:bg-indigo-500 selection:text-white">
          <Header />
          <main>{children}</main>
        </body>
      </html>
    </ClerkProvider>
  );
}
