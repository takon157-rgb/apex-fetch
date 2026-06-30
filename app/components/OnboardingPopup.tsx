'use client';

import React, { useState, useEffect } from 'react';

export default function OnboardingPopup() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem('apex_onboarding_dismissed');
    if (!dismissed) {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    localStorage.setItem('apex_onboarding_dismissed', 'true');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="relative max-w-lg w-full bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl shadow-2xl shadow-indigo-500/10 animate-scale-in overflow-y-auto max-h-[90vh]">
        <div className="p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-xl flex items-center justify-center font-bold shadow-md shadow-indigo-500/20 shrink-0">
              AF
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">Apex Fetch</h1>
              <p className="text-xs text-slate-400">Intelligent Lead Discovery Engine</p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-indigo-300 mb-2">What is this?</h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                Apex Fetch automatically scrapes job boards, RSS feeds, and career pages to find high-quality freelance and remote opportunities. It uses AI to score, summarize, and rank leads so you focus on the best ones.
              </p>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-indigo-300 mb-2">How it works</h2>
              <div className="space-y-2.5">
                <div className="flex items-start gap-3">
                  <span className="text-indigo-400 font-bold text-sm mt-0.5 shrink-0">1.</span>
                  <p className="text-sm text-slate-300"><span className="text-white font-medium">Pull Live Leads</span> — Click the button to scan 14+ job sources for new opportunities matching your niche.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-indigo-400 font-bold text-sm mt-0.5 shrink-0">2.</span>
                  <p className="text-sm text-slate-300"><span className="text-white font-medium">Review & Score</span> — Each lead gets an AI score (0–10), summary, and proposal draft. Expand any card for full details.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-indigo-400 font-bold text-sm mt-0.5 shrink-0">3.</span>
                  <p className="text-sm text-slate-300"><span className="text-white font-medium">Auto-Apply</span> — Send tailored proposals directly or mark leads for follow-up.</p>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-indigo-400 font-bold text-sm mt-0.5 shrink-0">4.</span>
                  <p className="text-sm text-slate-300"><span className="text-white font-medium">Discord Alerts</span> — Connect your Discord webhook in Profile to get real-time alerts for high-scoring leads.</p>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-indigo-500/10 to-violet-500/10 border border-indigo-500/20 rounded-xl p-4 space-y-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400">Quick Tips</h3>
              <ul className="space-y-1.5 text-sm text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Use the <strong className="text-white">Target Industry</strong> filters to narrow results</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Upload your resume in <strong className="text-white">Profile</strong> for AI-tailored proposals</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-indigo-400 mt-0.5">•</span>
                  <span>Add custom career pages under <strong className="text-white">Scraping Targets</strong></span>
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={dismiss}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold text-sm hover:from-indigo-400 hover:to-violet-400 transition-all hover:scale-[1.02] shadow-lg shadow-indigo-500/20"
          >
            Get Started
          </button>
          <p className="text-center text-[10px] text-slate-600">You can access this again from your Profile settings.</p>
        </div>
        <button
          onClick={dismiss}
          className="absolute top-3 right-3 p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
