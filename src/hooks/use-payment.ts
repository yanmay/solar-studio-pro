import { useState } from "react";
import { useScanStore } from "./use-scan-store";
import { useToast } from "./use-toast";
import { trackPaymentCompleted } from "@/lib/analytics";

interface InitiatePaymentArgs {
  plan: "pay_per_scan" | "pro_monthly";
  scanId?: string;
  /** Called after the server has verified the payment (e.g. to revalidate server unlock status). */
  onSuccess?: () => void;
}

// Function to dynamically load scripts
function loadScript(src: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = src;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function usePayment() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const initiatePayment = async ({ plan, scanId, onSuccess }: InitiatePaymentArgs) => {
    setIsLoading(true);
    setError(null);

    try {
      // 1. Create order on the serverless API
      const res = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, scanId }),
      });

      if (!res.ok) {
        throw new Error("Failed to create order on server");
      }

      const orderData = await res.json();
      const { orderId, amount, currency, keyId } = orderData;

      // 2. Load Razorpay script
      const scriptLoaded = await loadScript("https://checkout.razorpay.com/v1/checkout.js");
      if (!scriptLoaded) {
        throw new Error("Razorpay SDK failed to load. Are you offline?");
      }

      const Razorpay = (window as any).Razorpay;
      if (!Razorpay) {
        throw new Error("Razorpay instance not available");
      }

      // 3. Define Razorpay Options
      const options = {
        key: keyId,
        amount: amount,
        currency: currency,
        name: "SolarScan AI",
        description: plan === "pay_per_scan" 
          ? "Rooftop Solar Potential Feasibility Report" 
          : "Pro Subscription Monthly Plan",
        order_id: orderId,
        theme: {
          color: "#F17C58", // Accent orange
        },
        handler: async (response: any) => {
          setIsLoading(true);
          try {
            // Verify payment signature on the backend
            const verifyRes = await fetch("/api/payment/verify", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                plan,
                scanId: scanId || "default",
              }),
            });

            if (!verifyRes.ok) {
              throw new Error("Payment signature verification failed");
            }

            const verifyData = await verifyRes.json();
            if (verifyData.verified) {
              // Mark scan as paid in store
              useScanStore.getState().setIsPaid(true, response.razorpay_payment_id);
              
              // If results exist on page, update their unlocked state
              const currentAnalysis = useScanStore.getState().fullAnalysis;
              if (currentAnalysis) {
                useScanStore.getState().setFullAnalysis({
                  ...currentAnalysis,
                  unlocked: true,
                });
              }

              // Track payment completed event
              trackPaymentCompleted(plan);

              // Let the caller revalidate the server-authoritative unlock status
              onSuccess?.();

              toast({
                title: "Payment Successful",
                description: plan === "pro_monthly"
                  ? "Pro Subscription activated! Unlimited scans unlocked."
                  : "Report unlocked successfully! Premium GIS data loaded.",
              });
            }
          } catch (err: any) {
            console.error("Verification failed:", err);
            toast({
              title: "Verification Failed",
              description: err.message || "Payment verified failed. Please contact support.",
              variant: "destructive",
            });
            setError(err.message || "Verification failed");
          } finally {
            setIsLoading(false);
          }
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            toast({
              title: "Payment Cancelled",
              description: "You closed the payment dialog without checking out.",
            });
          },
        },
      };

      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err: any) {
      console.error("Payment initiation error:", err);
      setError(err.message || "Failed to initiate payment");
      toast({
        title: "Checkout Error",
        description: err.message || "Unable to open payment gateway. Try again.",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return { initiatePayment, isLoading, error };
}
