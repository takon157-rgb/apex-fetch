'use client';

import { useEffect, useRef } from 'react';

/**
 * Moves a layer at a different speed to the page scroll, which gives the
 * hero a sense of depth.
 *
 * The offset is written to a CSS transform on the element, so the browser
 * composites it instead of recalculating layout. A single rAF is used for
 * every scroll event, and the listener is passive.
 */
export default function Parallax({
  children,
  strength = 0.12,
  className = '',
}: {
  children: React.ReactNode;
  /** Fraction of the viewport travel to offset by. */
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // Touch devices scroll with momentum and the offset reads as jitter.
    if (window.matchMedia('(pointer: coarse)').matches) return;

    let frame = 0;

    const update = () => {
      frame = 0;
      const rect = el.getBoundingClientRect();
      const viewport = window.innerHeight || 1;

      // -1 when the element is below the fold, +1 when it is above it.
      const progress =
        (rect.top + rect.height / 2 - viewport / 2) / (viewport / 2 + rect.height / 2);
      const offset = -progress * strength * 100;

      el.style.transform = `translate3d(0, ${offset.toFixed(2)}px, 0)`;
    };

    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, [strength]);

  return (
    <div ref={ref} className={`parallax-layer ${className}`}>
      {children}
    </div>
  );
}
