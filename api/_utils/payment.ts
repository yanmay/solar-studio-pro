/**
 * Payment verification utilities
 */

import crypto from 'crypto';

export interface PaymentVerificationResult {
  isValid: boolean;
  error?: string;
}

/**
 * Verify Razorpay payment signature using HMAC SHA256
 * Fails closed: returns false if secret is missing or invalid
 */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string | undefined
): PaymentVerificationResult {
  // Fail closed if secret is missing or placeholder
  if (!secret || secret === 'your_razorpay_secret_here' || secret === 'your_key_secret_here') {
    return {
      isValid: false,
      error: 'Payment verification unavailable: Razorpay secret not configured'
    };
  }

  try {
    const text = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(text)
      .digest('hex');

    return {
      isValid: expectedSignature === signature
    };
  } catch (err) {
    return {
      isValid: false,
      error: `Signature verification failed: ${err instanceof Error ? err.message : 'unknown error'}`
    };
  }
}

/**
 * Verify webhook signature
 */
export function verifyWebhookSignature(
  webhookBody: string,
  signature: string,
  secret: string | undefined
): PaymentVerificationResult {
  if (!secret || secret === 'your_razorpay_secret_here' || secret === 'your_key_secret_here') {
    return {
      isValid: false,
      error: 'Webhook verification unavailable: Razorpay secret not configured'
    };
  }

  try {
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(webhookBody)
      .digest('hex');

    return {
      isValid: expectedSignature === signature
    };
  } catch (err) {
    return {
      isValid: false,
      error: `Webhook signature verification failed: ${err instanceof Error ? err.message : 'unknown error'}`
    };
  }
}
