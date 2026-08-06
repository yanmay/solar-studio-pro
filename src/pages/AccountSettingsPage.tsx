import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, User, Phone, Lock, ArrowLeft, ShieldCheck, CheckCircle2, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/lib/supabase";

export default function AccountSettingsPage() {
  const { user, profile, updatePassword, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    document.title = "Account Settings — SUNPOWER LINK";
    if (profile) { setFullName(profile.full_name || ""); setPhone(profile.phone || ""); }
  }, [profile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (phone && !/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Validation Error", description: "Enter a valid 10-digit Indian mobile number.", variant: "destructive" });
      return;
    }
    setProfileSaving(true);
    try {
      if (!supabase) throw new Error("Database connection unconfigured.");
      const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone || null }).eq("id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast({ title: "Profile Updated", description: "Your changes have been saved successfully." });
    } catch (err) {
      toast({ title: "Error Updating Profile", description: err instanceof Error ? err.message : "Failed to save profile.", variant: "destructive" });
    } finally { setProfileSaving(false); }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) { toast({ title: "Validation Error", description: "Please fill in all password fields.", variant: "destructive" }); return; }
    if (password !== confirmPassword) { toast({ title: "Validation Error", description: "Passwords do not match.", variant: "destructive" }); return; }
    if (password.length < 6) { toast({ title: "Validation Error", description: "Password must be at least 6 characters.", variant: "destructive" }); return; }
    setPasswordSaving(true);
    try {
      await updatePassword(password);
      setPassword(""); setConfirmPassword("");
      toast({ title: "Password Changed", description: "Your password has been successfully updated." });
    } catch (err) {
      toast({ title: "Error Updating Password", description: err instanceof Error ? err.message : "Failed to update password.", variant: "destructive" });
    } finally { setPasswordSaving(false); }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-xs text-white placeholder:text-white/20 border border-white/10 bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150 font-mono";

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased pb-20 selection:bg-[#FF6600]/30 selection:text-white relative overflow-x-hidden">
      {/* Background Glow Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-[#FF6600]/5 blur-[140px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[450px] h-[450px] rounded-full bg-emerald-500/3 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#050505]/85 backdrop-blur-2xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold text-white tracking-tight">
              SUNPOWER <span className="font-serif italic font-light text-[#FF6600]">LINK</span>
            </span>
          </Link>
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white/50 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10 relative z-10 space-y-8">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-white/5 border border-white/10 text-[#FF6600] text-[10px] font-mono font-bold uppercase tracking-[0.12em] mb-3">
            <User className="w-3.5 h-3.5" />
            <span>Account Management</span>
          </div>
          <h1
            className="text-3xl sm:text-4xl text-white leading-tight"
            style={{ fontFamily: "'Calistoga', serif", fontWeight: 400 }}
          >
            Account Settings
          </h1>
          <p className="text-sm text-white/50 mt-1 font-light">Manage your personal profile and security credentials</p>
        </div>

        {/* Profile Card */}
        <div className="rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="pb-4 border-b border-white/10 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <User className="w-5 h-5 text-[#FF6600]" /> Profile Details
              </h2>
              <p className="text-xs text-white/40 mt-1 font-mono">
                System Role: <span className="text-[#FF6600] font-bold uppercase tracking-wider">{profile?.role || "homeowner"}</span>
              </p>
            </div>
            <span className="px-3 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-mono font-bold uppercase tracking-wider">
              Verified Session
            </span>
          </div>

          <form onSubmit={handleUpdateProfile} className="space-y-5">
            <fieldset className="space-y-1.5 border-none p-0">
              <label className="block text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">Full Name</label>
              <input type="text" required placeholder="Rahul Sharma" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
            </fieldset>

            <fieldset className="space-y-1.5 border-none p-0">
              <label className="block text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#FF6600]" /> Mobile Number
              </label>
              <div className="flex gap-0">
                <span className="px-4 py-3 rounded-l-xl border border-r-0 border-white/10 bg-white/5 text-xs text-white/50 font-mono flex items-center shrink-0">+91</span>
                <input type="tel" maxLength={10} placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)}
                  className="flex-1 px-4 py-3 rounded-r-xl text-xs text-white placeholder:text-white/20 border border-white/10 bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all font-mono" />
              </div>
            </fieldset>

            <button
              type="submit" disabled={profileSaving}
              className="h-11 px-8 rounded-xl font-bold text-xs text-black flex items-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none bg-[#FF6600] hover:bg-orange-500 shadow-lg shadow-[#FF6600]/20"
            >
              {profileSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving Changes…</> : "Save Profile Changes"}
            </button>
          </form>
        </div>

        {/* Password Card */}
        <div className="rounded-3xl border border-white/10 bg-[#0A0A0A]/90 backdrop-blur-2xl p-6 sm:p-8 space-y-6 shadow-2xl">
          <div className="pb-4 border-b border-white/10">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-[#FF6600]" /> Security & Password
            </h2>
            <p className="text-xs text-white/40 mt-1 font-mono">
              Update your account password across all authenticated sessions
            </p>
          </div>

          <form onSubmit={handleUpdatePassword} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <fieldset className="space-y-1.5 border-none p-0">
                <label className="block text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">New Password</label>
                <input type="password" required placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
              </fieldset>
              <fieldset className="space-y-1.5 border-none p-0">
                <label className="block text-[10px] font-mono font-bold text-white/40 uppercase tracking-widest">Confirm New Password</label>
                <input type="password" required placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
              </fieldset>
            </div>
            <button
              type="submit" disabled={passwordSaving}
              className="h-11 px-8 rounded-xl font-bold text-xs text-black flex items-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none bg-[#FF6600] hover:bg-orange-500 shadow-lg shadow-[#FF6600]/20"
            >
              {passwordSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating Security…</> : "Update Password"}
            </button>
          </form>
        </div>

        {/* Footer trust badge */}
        <div className="flex justify-center items-center gap-2 text-xs text-white/30 pt-2 pb-6 font-mono">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>Sessions encrypted via Supabase Auth Security</span>
        </div>
      </main>
    </div>
  );
}
