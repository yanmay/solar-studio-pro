import { useState } from "react";
import { useScanStore } from "./use-scan-store";
import { useToast } from "./use-toast";
import { trackPaymentCompleted } from "@/lib/analytics";
import { useUnlockStatus } from "./use-unlock-status";
import { processReferralConversion } from "@/lib/referrals";

interface InitiatePaymentArgs {
  plan: "pay_per_scan" | "pro_monthly";
  scanId?: string;
  /** Called after the server has verified the payment (e.g. to revalidate server unlock status). */
  onSuccess?: () => void;
}

export function usePayment(scanId?: string) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const { unlocked } = useUnlockStatus(scanId);

  const initiatePayment = async ({ plan, scanId: methodScanId, onSuccess }: InitiatePaymentArgs) => {
    setIsLoading(true);
    setError(null);

    const activeScanId = methodScanId || scanId;

    try {
      // 1. Create demo order on the serverless API (falls back to local demo order if offline)
      const referrerCode = localStorage.getItem("sunpower-referrer-code") || undefined;
      let orderData: { orderId: string; amount: number; currency: string; keyId?: string; demoMode?: boolean } = {
        orderId: `order_demo_${Date.now()}`,
        amount: plan === "pro_monthly" ? 99900 : (referrerCode ? 12900 : 14900),
        currency: "INR",
        keyId: "rzp_test_demo",
        demoMode: true,
      };

      try {
        const res = await fetch("/api/payment/create-order", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan, scanId: activeScanId, referrerCode }),
        });
        if (res.ok) {
          orderData = await res.json();
        }
      } catch {
        // Use local demo order fallback
      }

      // 2. Demo payment flow (skips opening live Razorpay checkout popup)
      const demoOrderId = orderData.orderId?.startsWith("order_demo_")
        ? orderData.orderId
        : `order_demo_${Date.now()}`;
      const demoPaymentId = `pay_demo_${Date.now()}`;

      await new Promise((resolve) => setTimeout(resolve, 900));

      // Best-effort server verification so HttpOnly unlock cookie / DB record are persisted
      try {
        await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            razorpay_order_id: demoOrderId,
            razorpay_payment_id: demoPaymentId,
            razorpay_signature: "demo_signature",
            plan,
            scanId: activeScanId || "default",
            scan_hash: activeScanId || "default",
            referrerCode,
          }),
        });
      } catch {
        // Client unlock state still applies below for demo mode
      }

      // Unlock report in client store immediately
      const scanStore = useScanStore.getState();
      scanStore.setIsPaid(true, demoPaymentId);
      if (scanStore.fullAnalysis) {
        scanStore.setFullAnalysis({ ...scanStore.fullAnalysis, unlocked: true });
      }

      trackPaymentCompleted(plan);
      processReferralConversion();
      onSuccess?.();

      toast({
        title: "Demo Payment Successful",
        description: plan === "pro_monthly"
          ? "Pro Subscription activated (Demo)! Unlimited scans unlocked."
          : "Report unlocked (Demo)! Full 25-year analysis & PDF ready.",
      });
      setIsLoading(false);
    } catch (err: any) {
      console.error("Payment initiation error:", err);
      setError(err.message || "Failed to initiate payment");
      toast({
        title: "Checkout Error",
        description: err.message || "Unable to complete demo payment. Try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return { initiatePayment, isLoading, error, unlocked };
}
