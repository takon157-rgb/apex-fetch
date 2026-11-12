'use client';

import { useState } from 'react';

/**
 * Starts a Paystack checkout and sends the browser to the payment page.
 * The plan itself is defined server side, so the client only picks a key.
 */
export default function CheckoutButton({
  plan,
  label,
  className,
  disabled,
}: {
  plan: string;
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/paystack/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.url) {
        setError(data?.error || 'Could not start the payment. Try again in a moment.');
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError('Network error - could not reach the payment service.');
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={start}
        disabled={loading || disabled}
        className={className}
      >
        {loading ? 'Opening checkout…' : label}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
