'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import { dismissWelcome, welcomeDismissed } from '@/lib/welcome';
import { BRAND, OPEN_WELCOME_EVENT } from '@/lib/brand';

/**
 * First-run welcome modal.
 *
 * Previously this component only redirected new users to /onboarding and
 * rendered nothing, so a brand-new account got no explanation of what
 * ApexFetch does or how to get value from it. It now shows a short, dismissible
 * welcome with the three things a new user actually needs: set up a profile,
 * browse the live feed, and review matches awaiting approval.
 *
 * It can also be reopened at any time (the header's help button fires
 * `OPEN_WELCOME_EVENT`), so a user who dismissed it is never stuck.
 */

const STEPS = [
  {
    title: 'Add your resume',
    body: 'Upload a PDF and ApexFetch extracts your roles and skills to rank every lead against.',
    href: '/onboarding',
    icon: '📄',
  },
  {
    title: 'Browse the live feed',
    body: 'Real openings from 30+ company boards and remote job boards, refreshed continuously.',
    href: '/',
    icon: '🔎',
  },
  {
    title: 'Approve what gets sent',
    body: 'Tailored applications wait in your approval queue — nothing is ever sent without you.',
    href: '/approval-queue',
    icon: '✅',
  },
];

export default function OnboardingPopup() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [open, setOpen] = useState(false);
  const [liveJobs, setLiveJobs] = useState<number | null>(null);
  const [setupComplete, setSetupComplete] = useState(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    dismissWelcome();
    setOpen(false);
  }, []);

  const go = useCallback(
    (href: string) => {
      dismissWelcome();
      setOpen(false);
      router.push(href);
    },
    [router],
  );

  useEffect(() => {
    if (!isLoaded) return;
    if (!user) return;
    if (welcomeDismissed()) return;

    let cancelled = false;

    async function checkOnboarding() {
      try {
        const res = await fetch('/api/user-preferences');
        if (!res.ok) return;
        const data = await res.json();
        // Users who finished setup never see the welcome.
        if (data?.preferences?.setupComplete) return;
        if (cancelled) return;
        setOpen(true);
      } catch {
        // Offline / API down — don't block the user with a modal.
      }
    }

    checkOnboarding();
    return () => {
      cancelled = true;
    };
  }, [isLoaded, user]);

  // A live count of indexed jobs makes the pitch concrete rather than
  // theoretical. It is a nice-to-have, so a failure is ignored.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetch('/api/public/jobs?limit=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (cancelled) return;
        const total = data?.pagination?.total;
        if (typeof total === 'number') setLiveJobs(total);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Reopen on demand (header help button).
  useEffect(() => {
    function onOpenWelcome() {
      setSetupComplete(false);
      setOpen(true);
    }
    window.addEventListener(OPEN_WELCOME_EVENT, onOpenWelcome);
    return () => window.removeEventListener(OPEN_WELCOME_EVENT, onOpenWelcome);
  }, []);

  // Move focus into the dialog so keyboard and screen-reader users land in the
  // right place instead of at the top of the page behind the overlay.
  useEffect(() => {
    if (open) primaryRef.current?.focus();
  }, [open]);

  // Escape closes the dialog, Tab stays inside it.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key !== 'Tab') return;

      const root = dialogRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => el.offsetParent !== null);
      if (!focusable.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, close]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apexfetch-welcome-title"
        aria-describedby="apexfetch-welcome-desc"
        className="relative max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl shadow-indigo-950/40"
      >
        <div
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-500 via-sky-400 to-emerald-400"
          aria-hidden="true"
        />

        <button
          onClick={close}
          aria-label="Close welcome"
          className="absolute right-4 top-4 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="px-6 pb-6 pt-8 sm:px-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-500/10 px-3 py-1 text-[11px] font-semibold text-indigo-300">
            <span aria-hidden="true">👋</span> Welcome to {BRAND.name}
          </div>

          <h2 id="apexfetch-welcome-title" className="mt-4 text-2xl font-bold tracking-tight text-white">
            Your job search, on autopilot
          </h2>
          <p id="apexfetch-welcome-desc" className="mt-2 text-sm leading-relaxed text-slate-400">
            {BRAND.name} finds real openings across company career boards and remote job boards,
            ranks them against your resume, and drafts an application for every good match.
            You stay in control — nothing is sent without your approval.
          </p>

          {liveJobs !== null && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-300">
              <span aria-hidden="true">●</span>
              <strong className="font-semibold">{liveJobs.toLocaleString()}</strong> openings indexed right now
            </p>
          )}

          <ul className="mt-6 space-y-3">
            {STEPS.map((step) => (
              <li key={step.title}>
                <button
                  onClick={() => go(step.href)}
                  className="group flex w-full items-start gap-3 rounded-2xl border border-slate-800 bg-slate-950/50 p-4 text-left transition hover:border-indigo-500/50 hover:bg-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
                >
                  <span aria-hidden="true" className="pt-0.5 text-xl leading-none">
                    {step.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-100 group-hover:text-white">
                      {step.title}
                    </span>
                    <span className="mt-1 block text-xs leading-relaxed text-slate-400">{step.body}</span>
                  </span>
                  <span
                    aria-hidden="true"
                    className="self-center text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-indigo-400"
                  >
                    →
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:items-center">
            <button
              ref={primaryRef}
              onClick={() => go('/onboarding')}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300"
            >
              Get started — takes 2 minutes
            </button>
            <button
              onClick={close}
              className="rounded-xl px-4 py-3 text-sm font-medium text-slate-400 transition hover:bg-slate-800 hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400"
            >
              Browse jobs first
            </button>
          </div>

          <p className="mt-4 text-center text-[11px] text-slate-500">
            Tip: add a resume to unlock resume-match ranking on every lead.
          </p>
        </div>
      </div>
    </div>
  );
}
