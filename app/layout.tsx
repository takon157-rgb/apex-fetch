import './globals.css';
import type { Metadata } from 'next';
import { ClerkProvider } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import Header from './components/Header';
import OnboardingPopup from './components/OnboardingPopup';

export const metadata: Metadata = {
  title: 'JobPilot — Job search on autopilot',
  description:
    'JobPilot finds real openings across 30+ job boards, ranks them against your resume, tailors applications, and sends nothing without your approval.',
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
          <OnboardingPopup />
        </body>
      </html>
    </ClerkProvider>
  );
}
