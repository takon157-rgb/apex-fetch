import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { SOURCES } from '@/lib/source-registry';
import CountUp from './components/landing/CountUp';

export const metadata = {
  title: BRAND.name,
  description: BRAND.seo,
  verification: {
    google: 'DFKciEzXlVykeOK0gmNB9SXUgP5SD-UEtZWMZb5LOaU',
  },
};

const FEATURES = [
  { icon: '⚡', title: 'Real Jobs, Verified', desc: 'Scraped directly from company career boards and remote job platforms.' },
  { icon: '🎯', title: 'Resume Match Score', desc: 'AI ranks each opening by how well it matches your skills and target roles.' },
  { icon: '✉️', title: 'Tailored Applications', desc: 'Drafts are customized to each posting and reviewed before sending.' },
  { icon: '🛡️', title: 'No Auto-Apply', desc: 'Your approval is required for every application. Nothing goes out unreviewed.' },
] as const;

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) redirect('/dashboard');

  const totalJobs = 1500;
  const sourceCount = SOURCES.length;

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-indigo-500 to-violet-500 font-bold text-white">{BRAND.mark}</div>
            <span className="font-bold text-white">{BRAND.name}</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex">
            <Link href="#features" className="hover:text-white">Features</Link>
            <Link href="#pricing" className="hover:text-white">Pricing</Link>
            <Link href="/sign-in" className="rounded-lg bg-slate-800 px-3 py-1.5 hover:bg-slate-700">Sign In</Link>
            <Link href="/sign-up" className="rounded-lg bg-indigo-600 px-3 py-1.5 font-semibold text-white hover:bg-indigo-500">Get Started</Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="px-4 py-16 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Ready to use</div>
            <h1 className="max-w-4xl text-4xl font-black tracking-tight text-white sm:text-5xl lg:text-6xl">Find real jobs automatically.</h1>
            <p className="mt-6 max-w-2xl text-lg text-slate-300">
              {BRAND.name} scrapes live listings from company career boards and remote job sites, ranks them by resume fit, and drafts applications you review before sending.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/sign-up" className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-6 py-3 font-semibold text-white transition hover:bg-indigo-500">Get Started Free</Link>
              <Link href="/sign-in" className="inline-flex items-center justify-center rounded-xl border border-slate-700 bg-slate-900 px-6 py-3 font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-800">Sign In</Link>
            </div>
            <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-3xl font-black text-white tabular-nums"><CountUp value={totalJobs} suffix="+" /></p>
                <p className="mt-2 text-sm text-slate-400">Live job openings</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
                <p className="text-3xl font-black text-white tabular-nums"><CountUp value={sourceCount} suffix="+" /></p>
                <p className="mt-2 text-sm text-slate-400">Sources</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5 sm:col-span-2 lg:col-span-1">
                <p className="text-3xl font-black text-white tabular-nums">0</p>
                <p className="mt-2 text-sm text-slate-400">Auto-send approvals</p>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-800 bg-slate-900/30 px-4 py-16">
          <div className="mx-auto max-w-6xl">
            <h2 className="text-center text-3xl font-bold text-white">How it works</h2>
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div key={feature.title} className="rounded-2xl border border-slate-800 bg-slate-950/50 p-5">
                  <div className="mb-4 text-3xl">{feature.icon}</div>
                  <h3 className="text-lg font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="pricing" className="px-4 py-16">
          <div className="mx-auto max-w-4xl rounded-2xl border border-slate-800 bg-slate-900/50 p-8 text-center">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-indigo-300">Pricing</p>
            <h2 className="mt-4 text-3xl font-bold text-white">Free forever. Upgrade when you want more.</h2>
            <div className="mt-8 grid gap-6 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-6 text-left">
                <h3 className="text-xl font-semibold text-white">Free</h3>
                <p className="mt-4 text-4xl font-black text-white">$0</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-300"><li>• Live feed access</li><li>• Resume matching</li><li>• Tailored drafts</li></ul>
              </div>
              <div className="rounded-2xl border border-indigo-500/40 bg-indigo-500/10 p-6 text-left">
                <span className="inline-flex rounded-full border border-indigo-400/40 bg-indigo-400/10 px-2 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-200">Pro</span>
                <p className="mt-4 text-4xl font-black text-white">$9</p>
                <ul className="mt-5 space-y-2 text-sm text-slate-200"><li>• More credits</li><li>• Faster scraping</li><li>• Premium workflow</li></ul>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
