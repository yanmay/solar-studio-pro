export type PaymentPlan = 'pay_per_scan' | 'pro_monthly';

export interface CreateOrderRequest {
  plan: PaymentPlan;
  scanId?: string;
  installerUserId?: string;
}

export interface CreateOrderResponse {
  orderId: string;
  amount: number;      // in paise
  currency: string;    // 'INR'
  keyId: string;       // Razorpay Key ID
}

export interface VerifyPaymentRequest {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  plan: PaymentPlan;
  scanId?: string;
  installerUserId?: string;
}

export interface VerifyPaymentResponse {
  verified: boolean;
  paymentId: string;
}

const PLAN_AMOUNTS: Record<PaymentPlan, number> = {
  pay_per_scan: 14900,   // ₹149 in paise
  pro_monthly: 399900,   // ₹3,999 in paise (between ₹3,500 and ₹5,000)
};

export { PLAN_AMOUNTS };
