/**
 * Referral Engine for Organic Growth
 */

export interface ReferralState {
  referralCode: string;
  referredScansCount: number;
  cashbackEarnedInr: number;
  unlockedDiscount: boolean;
}

export const REFERRER_STORAGE_KEY = "sunpower-referrer-code";
export const REFERRAL_STATE_STORAGE_KEY = "sunpower-referral-state";

/**
 * Generates a unique referral code based on random strings or user identification.
 */
export function generateReferralCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "REF-";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

/**
 * Initializes or loads the user's personal referral state.
 */
export function getOrCreateReferralState(): ReferralState {
  try {
    const cached = localStorage.getItem(REFERRAL_STATE_STORAGE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
  } catch {
    /* ignore */
  }

  const newState: ReferralState = {
    referralCode: generateReferralCode(),
    referredScansCount: 0,
    cashbackEarnedInr: 0,
    unlockedDiscount: false
  };

  try {
    localStorage.setItem(REFERRAL_STATE_STORAGE_KEY, JSON.stringify(newState));
  } catch {
    /* ignore */
  }

  return newState;
}

/**
 * Save updated referral state.
 */
export function saveReferralState(state: ReferralState): void {
  try {
    localStorage.setItem(REFERRAL_STATE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/**
 * Capture referral code from URL search parameters and store in localStorage
 */
export function captureReferrerCode(urlParams: URLSearchParams): string | null {
  const ref = urlParams.get("ref");
  if (ref) {
    try {
      localStorage.setItem(REFERRER_STORAGE_KEY, ref.trim());
      // Mark that this user is referred and gets a ₹20 discount
      const state = getOrCreateReferralState();
      state.unlockedDiscount = true;
      saveReferralState(state);
    } catch {
      /* ignore */
    }
    return ref;
  }
  return null;
}

/**
 * Retrieve the active referrer code
 */
export function getReferrerCode(): string | null {
  try {
    return localStorage.getItem(REFERRER_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Clear the referrer code after a successful transaction
 */
export function clearReferrerCode(): void {
  try {
    localStorage.removeItem(REFERRER_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Distribute reward: simulated callback on successful paid PDF download.
 * Referrer gets ₹50 cashback.
 */
export function processReferralConversion(): void {
  try {
    const state = getOrCreateReferralState();
    state.unlockedDiscount = false; // Reset discount after first claim
    saveReferralState(state);
  } catch {
    /* ignore */
  }

  const referrer = getReferrerCode();
  if (referrer) {
    // In a real database environment, we would credit the referrer profile in Supabase.
    // Here we simulate the attribution:
    try {
      // Simulate sending conversion event to the server
      fetch("/api/referral/convert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referrerCode: referrer })
      }).catch(() => {});
      
      // Clear code since discount is claimed
      clearReferrerCode();
    } catch {
      /* ignore */
    }
  }
}

/**
 * Generate viral sharing content
 */
export function getReferralShareContent(referralCode: string, address: string = "my roof") {
  const referralLink = `https://solarscan.ai/?ref=${referralCode}`;
  
  const text = `I just estimated the solar potential for ${address}! ☀️ We can save thousands on electricity bills. Check your roof's solar potential with PM-Surya Ghar subsidies here: ${referralLink}`;
  
  const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(text)}`;
  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(referralLink)}`;
  
  return {
    referralLink,
    text,
    whatsappUrl,
    twitterUrl,
    facebookUrl
  };
}

/**
 * Monthly leaderboard mock data
 */
export interface LeaderboardEntry {
  rank: number;
  name: string;
  referrals: number;
  prize: string;
}

export const MONTHLY_LEADERBOARD: LeaderboardEntry[] = [
  { rank: 1, name: "Aarav Sharma", referrals: 48, prize: "Free solar panel cleaning" },
  { rank: 2, name: "Priya Patel", referrals: 35, prize: "₹500 Amazon voucher" },
  { rank: 3, name: "Vikram Singh", referrals: 29, prize: "₹500 Amazon voucher" },
  { rank: 4, name: "Neha Gupta", referrals: 22, prize: "₹100 off next scan" },
  { rank: 5, name: "Rohan Das", referrals: 19, prize: "₹100 off next scan" },
  { rank: 6, name: "Aditi Rao", referrals: 15, prize: "₹100 off next scan" },
  { rank: 7, name: "Amit Mishra", referrals: 12, prize: "₹100 off next scan" },
  { rank: 8, name: "Ananya Sen", referrals: 10, prize: "₹100 off next scan" },
  { rank: 9, name: "Kunal Verma", referrals: 8, prize: "₹100 off next scan" },
  { rank: 10, name: "Suresh Kumar", referrals: 7, prize: "₹100 off next scan" }
];
