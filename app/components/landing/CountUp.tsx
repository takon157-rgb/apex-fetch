'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Counts up to `value` when it scrolls into view.
 *
 * Used on the landing page's stats band. The easing is exponential rather
 * than linear so the number decelerates into its final value, which reads as
 * deliberate rather than mechanical.
 */
export default function CountUp({
  value,
  suffix = '',
  duration = 1600,
}: {
  value: number;
  suffix?: string;
  duration?: number;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    let startedAt = 0;

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();

        const tick = (now: number) => {
          if (!startedAt) startedAt = now;
          const progress = Math.min(1, (now - startedAt) / duration);
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplay(Math.round(value * eased));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };

        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [value, duration]);

  return (
    <span ref={ref} className="tabular">
      {display.toLocaleString()}
      {suffix}
    </span>
  );
}
