'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton, useUser } from '@clerk/nextjs';

export default function Header() {
  const [open, setOpen] = useState(false);
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (isLoaded && user) {
      fetch('/api/me').catch(() => {});
    }
  }, [isLoaded, user]);

  const isAdmin =
    isLoaded &&
    user?.id === process.env.NEXT_PUBLIC_ADMIN_CLERK_ID;

  return (
    <header className="bg-slate-950/80 border-b border-slate-800 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            aria-label="menu"
            onClick={() => setOpen(!open)}
            className="md:hidden p-2 rounded-lg bg-slate-900 hover:bg-slate-800"
          >
            <svg className="w-5 h-5 text-slate-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 bg-gradient-to-tr from-indigo-500 to-violet-500 rounded-md flex items-center justify-center font-bold">
              AF
            </div>
            <div className="text-sm font-bold">Apex Fetch</div>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-4">
          <Link href="/" className="text-sm text-slate-300 hover:text-white">
            Live Feed
          </Link>
          <Link href="/local-leads" className="text-sm text-indigo-300 hover:underline">
            Local Leads
          </Link>
          <Link href="/stored-leads" className="text-sm text-slate-300 hover:text-white">
            Stored Leads
          </Link>
          <Link href="/profile" className="text-sm text-slate-300 hover:text-white">
            Profile
          </Link>
          {isAdmin && (
            <Link href="/admin" className="text-sm text-amber-400 hover:text-amber-300 font-semibold">
              Admin
            </Link>
          )}
          <div className="ml-2 flex items-center gap-2">
            <SignedOut>
              <SignInButton mode="modal">
                <button className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                  Sign in
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="text-sm text-white px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
                  Sign up
                </button>
              </SignUpButton>
            </SignedOut>
            <SignedIn>
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: 'h-8 w-8',
                  },
                }}
                afterSignOutUrl="/"
              />
            </SignedIn>
          </div>
        </nav>
      </div>

      {open && (
        <div className="md:hidden bg-slate-900/90 border-t border-slate-800">
          <div className="px-4 py-3 space-y-2">
            <Link href="/" className="block text-slate-200" onClick={() => setOpen(false)}>
              Live Feed
            </Link>
            <Link href="/local-leads" className="block text-indigo-300" onClick={() => setOpen(false)}>
              Local Leads
            </Link>
            <Link href="/stored-leads" className="block text-slate-200" onClick={() => setOpen(false)}>
              Stored Leads
            </Link>
            <Link href="/profile" className="block text-slate-200" onClick={() => setOpen(false)}>
              Profile
            </Link>
            {isAdmin && (
              <Link href="/admin" className="block text-amber-400" onClick={() => setOpen(false)}>
                Admin
              </Link>
            )}
            <div className="pt-2 border-t border-slate-800 space-y-2">
              <SignedOut>
                <SignInButton mode="modal">
                  <button className="w-full text-left text-sm text-slate-200 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors">
                    Sign in
                  </button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <button className="w-full text-left text-sm text-white px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 transition-colors">
                    Sign up
                  </button>
                </SignUpButton>
              </SignedOut>
              <SignedIn>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
