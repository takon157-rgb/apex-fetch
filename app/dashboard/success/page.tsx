'use client';

import Link from 'next/link';

export default function PaymentSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full animate-fade-in">
        <div className="rounded-3xl border border-emerald-500/20 bg-gradient-to-b from-slate-900 to-slate-950 p-8 md:p-12 shadow-2xl shadow-emerald-500/5 text-center">
          <div className="mx-auto mb-6 h-20 w-20 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Payment Received!
          </h1>
          <p className="text-slate-300 text-sm md:text-base leading-relaxed mb-8">
            Your account is being provisioned. This process takes <strong className="text-emerald-400">2 to 5 minutes</strong>.
            Refresh this page shortly or check your email for confirmation.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              Back to Dashboard
            </Link>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800/50 px-6 py-3 text-sm font-semibold text-slate-200 hover:bg-slate-800 transition-all hover:scale-105"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh Status
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6 animate-fade-in">
          Having issues? <span className="text-indigo-400 hover:underline cursor-pointer">Contact Support</span>
        </p>
      </div>
    </div>
  );
}
