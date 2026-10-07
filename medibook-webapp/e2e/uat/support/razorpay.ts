import { createHmac, randomUUID } from 'node:crypto';

import type { ApiClient } from './api.ts';
import { UAT_ENV } from './env.ts';

/**
 * A signed Razorpay `payment.captured` webhook (report §3 option 1, BE-04):
 * HMAC-SHA256 of the exact body bytes with the server's webhook secret in
 * `X-Razorpay-Signature`, idempotent on `X-Razorpay-Event-Id`. Mounted at
 * `/webhooks/razorpay`, outside `/api/v1`.
 */

export interface GatewayOrder {
  /** `payment_order.gateway_order_id`. */
  readonly gatewayOrderId: string;
  /** `payment_order.amount_paise`. */
  readonly amountPaise: number;
}

export function signWebhook(body: string, secret = UAT_ENV.razorpayWebhookSecret): string {
  return createHmac('sha256', secret).update(body, 'utf-8').digest('hex');
}

/** Send `payment.captured` for `order`; the webhooks worker books it. */
export async function sendPaymentCaptured(
  client: ApiClient,
  order: GatewayOrder,
  method = 'upi',
): Promise<void> {
  const suffix = randomUUID().replace(/-/g, '').slice(0, 14);
  const body = JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: `pay_uat_${suffix}`,
          order_id: order.gatewayOrderId,
          amount: order.amountPaise,
          currency: 'INR',
          status: 'captured',
          method,
        },
      },
    },
    created_at: Math.floor(Date.now() / 1000),
  });
  const response = await client.raw.post('/webhooks/razorpay', {
    headers: {
      'Content-Type': 'application/json',
      'X-Razorpay-Signature': signWebhook(body),
      'X-Razorpay-Event-Id': `evt_uat_${suffix}`,
    },
    data: body,
  });
  if (!response.ok()) {
    throw new Error(`Razorpay webhook refused: ${response.status()} ${await response.text()}`);
  }
}
