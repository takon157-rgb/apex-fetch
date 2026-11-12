import type { Metadata } from 'next';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { PLANS } from '@/lib/paystack';
import CheckoutButton from '../components/CheckoutButton';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Start free with 10 job-search credits. Upgrade to Pro for 100 credits a month and unlimited scrapes.',
};

const FREE_CREDITS = 10;

const PRO_FEATURES = [
  '100 credits every month',
  'Unlimited scrapes',
  'Resume-match ranking on every lead',
  'Tailored resumes you can export as PDF or Word',
  'Approval queue before anything is sent',
];

const FREE_FEATURES = [
  `${FREE_CREDITS} credits to get started`,
  '1 credit per scrape',
  'Full job feed and filters',
  'Tailored resume and cover email',
  'Approval queue before anything is sent',
];

export default async function PricingPage() {
  const { userId } = await auth();
  const user = userId
    ? await prisma.user.findUnique({
        where: { clerkId: userId },
        select: { creditsRemaining: true, isSubscribed: true, email: true },
      })
    : null;

  const pro = PLANS.pro;
  const priceLabel = process.env.PAYSTACK_PRO_DISPLAY_PRICE || '$9';
  const checkoutReady = Boolean(pro.planCode);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
        <header className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-400">Pricing</p>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Pay for the searches that matter
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-slate-400">
            One credit runs one full pull across every job board. Start free, upgrade when
            the leads start flowing.
          </p>

          {user && (
            <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-1.5 text-xs text-slate-300">
              <span className="font-semibold text-white">{user.creditsRemaining}</span> credits
              {user.isSubscribed ? ' · Pro plan active' : ' available'}
            </p>
          )}
        </header>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {/* Free */}
          <section className="flex flex-col rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
            <h2 className="text-lg font-bold text-white">Free</h2>
            <p className="mt-1 text-sm text-slate-400">Everything you need to try ApexFetch.</p>
            <p className="mt-5 text-4xl font-extrabold text-white">
              $0
              <span className="text-sm font-medium text-slate-500"> forever</span>
            </p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-300">
                  <span aria-hidden="true" className="mt-0.5 text-emerald-400">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              {user ? (
                <p className="rounded-xl border border-slate-700 bg-slate-950/50 px-4 py-3 text-center text-xs text-slate-400">
                  You are on the free plan.
                </p>
              ) : (
                <Link
                  href="/sign-up"
                  className="block rounded-xl border border-slate-700 px-5 py-3 text-center text-sm font-semibold text-slate-200 transition hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:outline-none"
                >
                  Create a free account
                </Link>
              )}
            </div>
          </section>

          {/* Pro */}
          <section className="relative flex flex-col rounded-2xl border border-indigo-500/40 bg-gradient-to-b from-indigo-500/10 to-slate-900/60 p-6 shadow-2xl shadow-indigo-950/30">
            <span className="absolute -top-3 left-6 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 px-3 py-1 text-[11px] font-bold text-white">
              MOST POPULAR
            </span>
            <h2 className="text-lg font-bold text-white">{pro.name}</h2>
            <p className="mt-1 text-sm text-slate-400">For people running a real job search.</p>
            <p className="mt-5 text-4xl font-extrabold text-white">
              {priceLabel}
              <span className="text-sm font-medium text-slate-500"> / month</span>
            </p>
            <p className="mt-1 text-xs text-slate-500">{pro.monthlyCredits} credits a month</p>
            <ul className="mt-6 flex-1 space-y-2.5">
              {PRO_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 text-sm text-slate-200">
                  <span aria-hidden="true" className="mt-0.5 text-indigo-400">✓</span>
                  {feature}
                </li>
              ))}
            </ul>
            <div className="mt-7">
              {!user ? (
                <Link
                  href="/sign-up"
                  className="block rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3 text-center text-sm font-semibold text-white transition hover:from-indigo-400 hover:to-violet-400 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none"
                >
                  Sign up to upgrade
                </Link>
              ) : user.isSubscribed ? (
                <p className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-xs font-semibold text-emerald-300">
                  Pro is active on your account
                </p>
              ) : checkoutReady ? (
                <CheckoutButton
                  plan="pro"
                  label={`Upgrade to ${pro.name}`}
                  className="w-full rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-5 py-3 text-sm font-semibold text-white transition hover:from-indigo-400 hover:to-violet-400 focus-visible:ring-2 focus-visible:ring-indigo-300 focus-visible:outline-none disabled:opacity-60"
                />
              ) : (
                <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs text-amber-200">
                  Checkout is being configured. Please check back shortly.
                </p>
              )}
            </div>
          </section>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-3">
          {[
            {
              icon: '🔒',
              title: 'Nothing sent without you',
              body: 'Every application waits in your approval queue. You press send.',
            },
            {
              icon: '📄',
              title: 'Your data stays private',
              body: 'Your resume is stored against your account and never shared with anyone else.',
            },
            {
              icon: '↩️',
              title: 'Cancel any time',
              body: 'Pro is a monthly subscription. Leave whenever you like, keep what you earned.',
            },
          ].map((item) => (
            <div key={item.title} className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5">
              <div className="text-xl" aria-hidden="true">{item.icon}</div>
              <h3 className="mt-2 text-sm font-semibold text-white">{item.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{item.body}</p>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-slate-500">
          Questions? <Link href="/" className="text-indigo-400 hover:text-indigo-300">Back to the feed</Link>
        </p>
      </div>
    </main>
  );
}
