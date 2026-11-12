import dynamic from 'next/dynamic';

// Dynamic import to satisfy SSR - Dashboard is a client component
const Dashboard = dynamic(() => import('../components/Dashboard'), { ssr: false });

export const metadata = {
  title: 'Dashboard',
};

export default function DashboardPage() {
  return <Dashboard />;
}