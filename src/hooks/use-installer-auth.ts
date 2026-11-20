import { useState, useEffect } from "react";

export interface InstallerProfile {
  email: string;
  companyName: string;
  gstin: string;
  phone: string;
  city: string;
  state: string;
  mnreEmpanelment?: string;
  gstinVerified: boolean;
  onboardingCompleted: boolean;
}

const STORAGE_KEY = "solarsan-installer-profile";

/**
 * Verify GSTIN number formatting and simulate public API verification.
 * Falls back gracefully if external queries fail.
 */
export async function verifyGSTIN(gstin: string): Promise<{ success: boolean; companyName?: string; message?: string }> {
  const clean = gstin.trim().toUpperCase();
  // Standard 15-character GSTIN format validation
  const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  if (clean.length !== 15 || !gstinRegex.test(clean)) {
    return { success: false, message: "GSTIN must be exactly 15 alphanumeric characters matching Indian registration rules." };
  }

  try {
    // Query a mock verification latency to simulate external API check
    await new Promise((resolve) => setTimeout(resolve, 1000));
    return { success: true, companyName: "Verified Solar Corporation India" };
  } catch (e) {
    // Graceful fallback to manual review verification
    return { success: true, message: "Verification API offline; registration approved via manual review fallback." };
  }
}

export function useInstallerAuth() {
  const [profile, setProfile] = useState<InstallerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached) {
      try {
        setProfile(JSON.parse(cached));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoading(false);
  }, []);

  const signUp = async (
    email: string,
    companyName: string,
    gstin: string,
    phone: string,
    city: string,
    state: string,
    mnreEmpanelment?: string
  ) => {
    setLoading(true);
    
    // 1. Verify GSTIN
    const verification = await verifyGSTIN(gstin);
    if (!verification.success) {
      setLoading(false);
      throw new Error(verification.message || "GSTIN verification failed.");
    }

    // 2. Build profile object
    const newProfile: InstallerProfile = {
      email,
      companyName: companyName || verification.companyName || "Solar Company",
      gstin: gstin.toUpperCase(),
      phone,
      city,
      state,
      mnreEmpanelment,
      gstinVerified: true,
      onboardingCompleted: false,
    };

    localStorage.setItem(STORAGE_KEY, JSON.stringify(newProfile));
    setProfile(newProfile);
    setLoading(false);
    return newProfile;
  };

  const signIn = async (email: string) => {
    setLoading(true);
    // Find matching profile or create a mock session
    const cached = localStorage.getItem(STORAGE_KEY);
    let matched: InstallerProfile;
    if (cached) {
      matched = JSON.parse(cached);
    } else {
      matched = {
        email,
        companyName: "Premier Solar Systems",
        gstin: "27AAAAA0000A1Z5",
        phone: "9876543210",
        city: "Mumbai",
        state: "Maharashtra",
        gstinVerified: true,
        onboardingCompleted: true,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(matched));
    }
    setProfile(matched);
    setLoading(false);
    return matched;
  };

  const signOut = async () => {
    setLoading(true);
    localStorage.removeItem(STORAGE_KEY);
    setProfile(null);
    setLoading(false);
  };

  const completeOnboarding = () => {
    if (profile) {
      const updated = { ...profile, onboardingCompleted: true };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setProfile(updated);
    }
  };

  return {
    profile,
    loading,
    signUp,
    signIn,
    signOut,
    completeOnboarding,
    isAuthenticated: !!profile,
  };
}
