import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Remote Job Leads | ApexFetch',
  description: 'AI-scored remote job opportunities from 14+ sources. Updated daily. Find your next remote role with smart filtering.',
  openGraph: {
    title: 'Remote Job Leads | ApexFetch',
    description: 'AI-scored remote job opportunities from 14+ sources. Updated daily.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
