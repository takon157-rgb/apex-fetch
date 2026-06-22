'use client';

import { SignUp } from '@clerk/nextjs';
import { dark } from '@clerk/themes';
import { useEffect, useState } from 'react';

export default function SignUpPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-slate-950">
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] rounded-full bg-indigo-500/20 blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full bg-violet-500/15 blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-indigo-600/5 blur-3xl animate-pulse-soft" style={{ animationDelay: '2s' }} />
      </div>
      <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.03)_1px,transparent_1px)] bg-[size:64px_64px]" />
      <div className={`relative z-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
        <div className="text-center mb-8 animate-slide-down">
          <div className="inline-flex h-14 w-14 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-2xl items-center justify-center font-bold text-xl text-white shadow-xl shadow-indigo-500/20 mb-4">
            AF
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">
            Join <span className="bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">ApexFetch</span>
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-sm mx-auto">
            Your AI-powered lead discovery and operations platform
          </p>
        </div>
        <div className="animate-slide-down" style={{ animationDelay: '0.2s' }}>
          <SignUp
            appearance={{
              baseTheme: dark,
              elements: {
                rootBox: 'mx-auto',
                card: 'bg-slate-900/80 backdrop-blur-xl border border-slate-800/80 shadow-2xl shadow-indigo-500/5 rounded-2xl',
                headerTitle: 'text-slate-100 text-xl font-bold',
                headerSubtitle: 'text-slate-400',
                formButtonPrimary: 'bg-gradient-to-r from-indigo-500 to-violet-500 hover:from-indigo-400 hover:to-violet-400 text-white font-semibold rounded-xl py-2.5 transition-all hover:scale-[1.02]',
                formFieldLabel: 'text-slate-300 text-sm font-medium',
                formFieldInput: 'bg-slate-950/70 border-slate-700/70 text-slate-100 rounded-xl focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20 transition-all placeholder:text-slate-600',
                footerActionLink: 'text-indigo-400 hover:text-indigo-300 font-medium',
                socialButtonsBlockButton: 'border-slate-700 hover:bg-slate-800/50 rounded-xl text-slate-200 transition-all',
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
        </div>
      </div>
    </div>
  );
}
