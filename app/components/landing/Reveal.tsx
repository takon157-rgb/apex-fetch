'use client';

import { useEffect, useRef } from 'react';

/**
 * Reveals its children once they scroll into view.
 *
 * The hidden state lives in CSS (`.reveal`), and CSS only applies it when
 * `<html>` has the `js` class. That class is added by a tiny inline script in
 * the root layout, so if JavaScript never runs the content is simply visible
 * instead of permanently invisible.
 *
 * Only `transform` and `opacity` are animated, so the whole thing stays on the
 * compositor and never triggers layout.
 */
export default function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // If the visitor asked for less motion, show everything straight away.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      el.classList.add('is-visible');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          el.classList.add('is-visible');
          observer.unobserve(el);
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -60px 0px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
