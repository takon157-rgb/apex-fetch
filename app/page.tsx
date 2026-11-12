import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { BRAND } from '@/lib/brand';
import { SOURCES, AGGREGATOR_COUNT, BOARD_COUNT } from '@/lib/source-registry';
import CountUpClient from './components/landing/CountUp';

export const metadata = {
  title: BRAND.name,
  description: BRAND.seo,
  verification: {
    google: 'eOk7S3ijOCkPAbcshH0cIiw9_bkH2dApxIwWTrpFdNY',
  },
};

const FEATURES = [
  {
    icon: '🔍',
    title: 'Real Jobs, Verified',
    desc: 'Scraped directly from company career boards and remote job platforms.',
  },
  {
    icon: '🎯',
    title: 'Resume Match Score',
    desc: 'AI ranks each opening by how well it matches your skills.',
  },
  {
    icon: '✍️',
    title: 'Tailored Applications',
    desc: 'Drafts are customized to each job. Review before sending.',
  },
  {
    icon: '🛡️',
    title: 'No Auto-Apply',
    desc: 'Your approval is required for every application.',
  },
];

async function getJobCount(): Promise<number> {
  try {
    const res = await fetch(`${BRAND.siteUrl}/api/public/jobs?limit=1`, { next: { revalidate: 60 } });
    if (!res.ok) return 0;
    const data = await res.json();
    return data?.pagination?.total ?? 0;
  } catch {
    return 0;
  }
}

export default async function LandingPage() {
  const { userId } = await auth();
  if (userId) {
    redirect('/dashboard');
  }

  const totalJobs = await getJobCount();
  const sourceCount = SOURCES?.length ?? (AGGREGATOR_COUNT + BOARD_COUNT);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Aurora background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-[200%] h-[200%] bg-radial-gradient from-indigo-900/30 via-slate-900/10 to-transparent rounded-full animate-aurora-reverse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-[200%] h-[200%] bg-radial-gradient from-violet-900/30 via-slate-900/10 to-transparent rounded-full animate-aurora" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-950/80 border-b border-slate-800 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-tr from-indigo-500 to-violet-500 text-[11px] font-bold text-white">{BRAND.mark}</div>
            <span className="font-bold text-slate-100">{BRAND.name}</span>
          </div>
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm text-slate-300 hover:text-white transition">Features</Link>
            <Link href="#pricing" className="text-sm text-slate-300 hover:text-white transition">Pricing</Link>
            <Link href="/sign-in" className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">Sign In</Link>
            <Link href="/sign-up" className="text-sm text-white px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition">Get Started</Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 bg-slate-950">
        <section className="py-20 lg:py-32 px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-4 py-1.5 mb-6">
            <span className="text-xs font-semibold text-indigo-300">✨ Ready to use</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white mb-6 bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-purple-400 to-cyan-400 animate-gradient-pan">
            Find real jobs automatically
          </h1>

          <p className="text-lg text-slate-300 mb-8 max-w-2xl mx-auto">
            ApexFetch scrapes live listings from company career boards and remote job sites,
            ranks them by resume match, and drafts applications you review before sending.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/sign-up" className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-7 py-3 text-base font-semibold text-white hover:bg-indigo-500 transition">
              Get Started — Free
            </Link>
            <Link href="/sign-in" className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-800 px-7 py-3 text-base font-semibold text-slate-200 hover:bg-slate-700 transition">
              Sign In
            </Link>
          </div>

          {/* Live counters */}
          <div className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-8 text-center">
            <div>
              <p className="text-3xl font-bold text-white tabular-numbers">
                <CountUpClient value={totalJobs} />+
              </p>
              <p className="text-sm text-slate-400">Live Job Openings</p>
            </div>
            <div className="hidden sm:block h-8 border-x border-slate-800" />
            <div>
              <p className="text-3xl font-bold text-white tabular-numbers">
                <CountUpClient value={sourceCount} />+
              </p>
              <p className="text-sm text-slate-400">Sources</p>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-4">
          <div className="max-w-5xl mx-auto">
            <h2 className="text-3xl font-bold text-white text-center mb-12">How it works</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {FEATURES.map((f) => (
                <div key={f.title} className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6 text-center hover:translate-y-[-2px] transition">
                  <div className="text-3xl mb-3">{f.icon}</div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section id="pricing" className="py-20 px-4 bg-slate-900/30 border-y border-slate-800">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Pricing</h2>
            <p className="text-slate-300 mb-10">Free forever. Upgrade to Pro for advanced features.</p>

            <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
              <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
                <h3 className="text-xl font-semibold text-white mb-4">Free</h3>
                <p className="text-3xl font-bold text-indigo-400 mb-4">0$</p>
                <ul className="text-left text-slate-300 text-sm space-y-2 mb-6">
                  <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> 10 credits / month</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Live feed</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Resume match</li>
                </ul>
                <Link href="/sign-up" className="block w-full py-2.5 rounded-xl bg-indigo-600 text-white font-semibold hover:bg-indigo-500 transition">
                  Start Free
                </Link>
              </div>

              <div className="rounded-2xl border-2 border-indigo-500 bg-slate-900 p-6">
                <div className="absolute top-4 right-4 bg-indigo-600 text-xs font-semibold px-2 py-1 rounded-full">Most Popular</div>
                <h3 className="text-xl font-semibold text-white mb-4">Pro</h3>
                <p className="text-3xl font-bold text-white mb-4">$9<span className="text-base font-normal">/mo</span></p>
                <ul className="text-left text-slate-300 text-sm space-y-2 mb-6">
                  <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> 100 credits / month</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> Unlimited scrapes</li>
                  <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span> AI cover letters</li>
                </ul>
                <Link href="/sign-up" className="block w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold hover:from-indigo-400 hover:to-violet-400 transition">
                  Upgrade to Pro
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="bg-slate-950 border-t border-slate-800 py-8 px-4">
        <div className="max-w-6xl mx-auto text-center text-slate-500">
          <p className="text-sm">© {new Date().getFullYear()} ApexFetch — Built for job hunters, by job hunters.</p>
        </div>
      </footer>
    </div>
  );
}