export interface ScanState {
  address: string;
  systemSizeKw: number;
  lifetimeSavingsLakh: number;
  paybackYears: number;
  confidenceScore: number;
  reportUrl: string;
}

/**
 * Generates the standardized WhatsApp sharing proposal text.
 */
export function generateWhatsAppMessage(scanData: ScanState): string {
  return `🏠 *Solar Potential Report for ${scanData.address}*

☀️ System Size: ${scanData.systemSizeKw.toFixed(1)} kW
💰 Lifetime Savings: ₹${scanData.lifetimeSavingsLakh.toFixed(1)} Lakh
⏱️ Payback: ${scanData.paybackYears.toFixed(1)} Years
🎯 Confidence: ${scanData.confidenceScore}%

📄 Full report: ${scanData.reportUrl}

Want 3 verified installer quotes? Reply YES.`;
}

/**
 * Formats a wa.me URL with phone number and pre-filled message text.
 */
export function generateWhatsAppUrl(phone: string, message: string): string {
  // Strip non-digits from phone number
  const cleanPhone = phone.replace(/\D/g, "");
  // Prefix India country code 91 if it's a local 10-digit number
  const finalPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
  return `https://wa.me/${finalPhone}?text=${encodeURIComponent(message)}`;
}

/**
 * Optional helper to shorten long URLs using the TinyURL API.
 * Falls back to the original long URL on failure.
 */
export async function shortenUrl(longUrl: string): Promise<string> {
  try {
    const res = await fetch(`https://tinyurl.com/api-create.php?url=${encodeURIComponent(longUrl)}`);
    if (res.ok) {
      const short = await res.text();
      if (short && short.startsWith("http")) {
        return short.trim();
      }
    }
  } catch (err) {
    console.warn("Failed to shorten sharing URL, using original:", err);
  }
  return longUrl;
}
