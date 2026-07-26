import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhook } from '@/lib/paystack';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('x-paystack-signature') || '';
    const rawBody = await req.text();

    if (!verifyWebhook(signature, rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(rawBody);

    switch (event.event) {
      case 'charge.success': {
        const data = event.data;
        const userId = data.metadata?.userId;
        const customerCode = data.customer?.customer_code;

        if (userId) {
          await prisma.user.update({
            where: { id: userId },
            data: {
              isSubscribed: true,
              creditsRemaining: { increment: 100 },
              paystackCustomerCode: customerCode || undefined,
            },
          });
          console.log(`[Paystack Webhook] Subscribed user ${userId}`);
        }
        break;
      }

      case 'subscription.create':
      case 'subscription.enable': {
        const sub = event.data;
        const customerCode = sub.customer?.customer_code;
        await prisma.user.updateMany({
          where: { paystackCustomerCode: customerCode },
          data: { isSubscribed: true },
        });
        console.log(`[Paystack Webhook] Subscription ${event.event} for ${customerCode}`);
        break;
      }

      case 'subscription.disable':
      case 'subscription.expiring_cards': {
        const disabled = event.data;
        const disabledCustomer = disabled.customer?.customer_code;
        await prisma.user.updateMany({
          where: { paystackCustomerCode: disabledCustomer },
          data: { isSubscribed: false },
        });
        console.log(`[Paystack Webhook] Subscription ${event.event} for ${disabledCustomer}`);
        break;
      }

      case 'invoice.create':
      case 'invoice.update': {
        const inv = event.data;
        const invCustomer = inv.customer?.customer_code;
        const paid = inv.status === 'paid' || inv.status === 'success';
        await prisma.user.updateMany({
          where: { paystackCustomerCode: invCustomer },
          data: { isSubscribed: paid },
        });
        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('[Paystack Webhook] Error:', err);
    return NextResponse.json({ error: 'Webhook error' }, { status: 400 });
  }
}
