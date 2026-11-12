'use client';

import { SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useEffect, useState } from 'react';
import { BRAND, REFERRAL_STORAGE_KEY } from '@/lib/brand';

const PERKS = [
  {
    icon: '📡',
    title: 'Real jobs, 30+ live sources',
    body: 'Company career boards and remote job boards, ingested continuously — no scraped-and-stale listings.',
  },
  {
    icon: '🎯',
    title: 'Ranked against your resume',
    body: 'Every lead is scored on your roles and skills, so the strongest match is at the top instead of buried.',
  },
  {
    icon: '✍️',
    title: 'Applications written for you',
    body: 'A tailored resume and cover email drafted per job, checked against your master resume for accuracy.',
  },
  {
    icon: '🔒',
    title: 'Nothing sent without you',
    body: 'Every application waits in your approval queue. You press send — never the other way round.',
  },
];

export default function SignUpPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Park a referral code until onboarding completes, where it is claimed.
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref) {
      try {
        window.localStorage.setItem(REFERRAL_STORAGE_KEY, ref);
      } catch {
        // Storage blocked - the referral is simply not tracked.
      }
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -left-40 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-violet-500/15 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/5 blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
      </div>
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto grid min-h-screen max-w-6xl items-center gap-12 px-4 py-10 lg:grid-cols-[1.1fr_minmax(0,26rem)] lg:py-16">
        {/* Pitch */}
        <div className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-sm font-bold text-white shadow-lg shadow-indigo-500/20">
              {BRAND.mark}
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-white">{BRAND.name}</div>
              <div className="text-xs text-slate-500">{BRAND.tagline}</div>
            </div>
          </div>

          <h1 className="mt-8 text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
            Stop applying blind.
            <span className="mt-1 block bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Start applying to the right jobs.
            </span>
          </h1>

          <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-400 sm:text-base">
            {BRAND.pitch}
          </p>

          <ul className="mt-8 grid gap-4 sm:grid-cols-2">
            {PERKS.map((perk, i) => (
              <li
                key={perk.title}
                className="animate-slide-down rounded-2xl border border-slate-800 bg-slate-900/50 p-4 backdrop-blur-sm transition hover:border-indigo-500/40"
                style={{ animationDelay: `${0.1 + i * 0.08}s` }}
              >
                <div className="text-lg" aria-hidden="true">
                  {perk.icon}
                </div>
                <div className="mt-2 text-sm font-semibold text-slate-100">{perk.title}</div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{perk.body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">🔐</span> Your resume is stored privately and never sent anywhere except your own applications
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true">⏱️</span> Setup takes about two minutes
            </span>
          </div>
        </div>

        {/* Auth */}
        <div
          className={`animate-slide-down transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
          style={{ animationDelay: '0.15s' }}
        >
          <SignUp
            appearance={{
              baseTheme: dark,
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 shadow-2xl shadow-indigo-500/5 rounded-2xl',
                headerTitle: 'text-slate-100 text-xl font-bold',
                headerSubtitle: 'text-slate-400',
                formButtonPrimary:
                  'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold rounded-xl py-2.5 transition-all hover:scale-[1.02]',
                formFieldLabel: 'text-slate-300 text-sm font-medium',
                formFieldInput:
                  'bg-slate-950/70 border-slate-700/70 text-slate-100 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600',
                footerActionLink: 'text-indigo-400 hover:text-indigo-300 font-medium',
                socialButtonsBlockButton:
                  'border-slate-700 hover:bg-slate-800/50 rounded-xl text-slate-200 transition-all',
                socialButtonsBlockButtonText: 'text-slate-200 font-medium',
                dividerLine: 'bg-slate-800',
                dividerText: 'text-slate-500',
                formFieldError: 'text-rose-400 text-xs',
                identityPreviewText: 'text-slate-200',
                identityPreviewEditButton: 'text-indigo-400',
                otpCodeFieldInput: 'bg-slate-950 border-slate-700 text-slate-100 rounded-lg',
                otpCodeFieldInputFocused: 'border-indigo-400',
              },
            }}
          />
          <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-500">
            By creating an account you agree to ApexFetch sending applications on your behalf
            <strong className="font-semibold text-slate-400"> only after you approve them</strong>.
          </p>
        </div>
      </div>
    </div>
  );
}
