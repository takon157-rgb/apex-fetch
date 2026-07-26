const PAYSTACK_API = 'https://api.paystack.co';

function getSecret(): string {
  const key = process.env.PAYSTACK_SECRET_KEY;
  if (!key) throw new Error('PAYSTACK_SECRET_KEY is not set');
  return key;
}

async function paystackFetch(path: string, options?: RequestInit) {
  const res = await fetch(`${PAYSTACK_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${getSecret()}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  const json = await res.json();
  if (!json.status) throw new Error(json.message || 'Paystack API error');
  return json.data;
}

export async function initializeTransaction(params: {
  email: string;
  amount: number;
  plan: string;
  metadata: Record<string, string>;
  callbackUrl: string;
}) {
  return paystackFetch('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: params.email,
      amount: params.amount,
      plan: params.plan,
      metadata: params.metadata,
      callback_url: params.callbackUrl,
    }),
  });
}

export function verifyWebhook(signature: string, rawBody: string): boolean {
  const secret = getSecret();
  const hmac = require('crypto')
    .createHmac('sha512', secret)
    .update(rawBody)
    .digest('hex');
  return hmac === signature;
}

export const PLANS = {
  pro: {
    planCode: process.env.PAYSTACK_PRO_PLAN_CODE || '',
    name: 'Pro',
    monthlyCredits: 100,
  },
} as const;

export function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
