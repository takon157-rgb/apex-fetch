'use client';

import { SignIn } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useEffect, useState } from 'react';
import { BRAND } from '@/lib/brand';

const REASSURANCES = [
  { icon: '📡', text: 'Real openings from 30+ company and remote job boards' },
  { icon: '🎯', text: 'Every lead ranked against your resume' },
  { icon: '🔒', text: 'Applications only go out when you approve them' },
];

export default function SignInPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 overflow-hidden">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-indigo-500/20 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-40 -left-40 h-[600px] w-[600px] rounded-full bg-violet-500/15 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-600/5 blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
      </div>
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]"
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center px-4 py-12">
        <div className={`text-center transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-base font-bold text-white shadow-xl shadow-indigo-500/20">
            {BRAND.mark}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white md:text-3xl">
            Welcome back to{' '}
            <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              {BRAND.name}
            </span>
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-400">
            Sign in to pick up where your job search left off.
          </p>
        </div>

        <div
          className="mt-8 w-full animate-slide-down transition-all duration-700"
          style={{ animationDelay: '0.15s' }}
        >
          <SignIn
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
              },
            }}
          />
        </div>

        <ul className="mt-8 w-full space-y-2.5">
          {REASSURANCES.map((item, i) => (
            <li
              key={item.text}
              className="animate-slide-down flex items-start gap-2.5 text-xs text-slate-400"
              style={{ animationDelay: `${0.25 + i * 0.08}s` }}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
