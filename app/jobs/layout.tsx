import type { Metadata } from 'next';
import { BRAND } from '@/lib/brand';

export const metadata: Metadata = {
  title: `Remote Job Leads | ${BRAND.name}`,
  description:
    'Real job openings from 30+ company career boards and remote job boards, ranked by resume fit and refreshed daily. Find your next role with smart filtering.',
  openGraph: {
    title: `Remote Job Leads | ${BRAND.name}`,
    description:
      'Real job openings from 30+ company career boards and remote job boards, ranked by resume fit and refreshed daily.',
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function JobsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
