import { createContext, useContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

// Check whether the Supabase client is actually initialized.
// `supabase` is typed as SupabaseClient but is null at runtime when env vars are missing.
const isSupabaseReady = !!supabase;

export interface Profile {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: "homeowner" | "installer" | "admin";
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  signUp: (email: string, password: string, fullName: string, phone: string, role: "homeowner" | "installer") => Promise<any>;
  signIn: (email: string, password: string) => Promise<any>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<any>;
  updatePassword: (password: string) => Promise<any>;
  claimAnonymousData: (email: string, localScanId?: string | null) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(isSupabaseReady); // only show loading if supabase is ready
  const { toast } = useToast();

  const fetchProfile = async (userId: string) => {
    if (!isSupabaseReady) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Error fetching user profile:", err);
      setProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  useEffect(() => {
    if (!isSupabaseReady) {
      // No Supabase — stay logged out with no loading spinner
      setLoading(false);
      return;
    }

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        fetchProfile(currentUser.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
        
        if (currentUser) {
          await fetchProfile(currentUser.id);
          // Try to claim any anonymous data for this user's email
          if (currentUser.email) {
            const urlParams = new URLSearchParams(window.location.search);
            const scan = urlParams.get("scan");
            let localScanId = null;
            if (scan) {
              try {
                const decoded = JSON.parse(atob(scan));
                localScanId = decoded?.scanInput?.siteId || decoded?.analysisId;
              } catch {
                // ignore invalid base64 or json
              }
            }
            await claimAnonymousData(currentUser.email, localScanId);
          }
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const claimAnonymousData = async (email: string, localScanId?: string | null) => {
    if (!isSupabaseReady) return;
    const currentUser = (await supabase.auth.getSession()).data.session?.user;
    if (!currentUser) return;

    try {
      await supabase
        .from("analysis_sessions")
        .update({ user_id: currentUser.id })
        .eq("customer_email", email)
        .is("user_id", null);

      await supabase
        .from("payments")
        .update({ user_id: currentUser.id })
        .eq("customer_email", email)
        .is("user_id", null);

      if (localScanId) {
        await supabase
          .from("analysis_sessions")
          .update({ user_id: currentUser.id })
          .eq("site_id", localScanId)
          .is("user_id", null);
      }
    } catch (error) {
      console.error("Failed to claim anonymous data:", error);
    }
  };

  const signUp = async (email: string, password: string, fullName: string, phone: string, role: "homeowner" | "installer") => {
    if (!isSupabaseReady) throw new Error("Auth is not configured in this environment.");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, phone, role },
        },
      });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseReady) throw new Error("Auth is not configured in this environment.");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (!isSupabaseReady) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseReady) throw new Error("Auth is not configured in this environment.");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    if (!isSupabaseReady) throw new Error("Auth is not configured in this environment.");
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return data;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        claimAnonymousData,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
