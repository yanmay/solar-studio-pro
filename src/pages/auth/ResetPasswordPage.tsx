import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Lock, ShieldAlert, KeyRound } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !confirmPassword) { setErrorMsg("Please fill in all fields."); return; }
    if (password !== confirmPassword) { setErrorMsg("Passwords do not match."); return; }
    if (password.length < 6) { setErrorMsg("Password must be at least 6 characters."); return; }
    setSubmitting(true); setErrorMsg("");
    try {
      await updatePassword(password);
      toast({ title: "Password updated!", description: "You can now sign in with your new password." });
      navigate("/auth/signin");
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to reset password. Link may have expired.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/20 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16 font-['Inter',sans-serif] antialiased text-white"
      style={{ background: "linear-gradient(160deg, #020203 0%, #050506 60%, #0a0a0c 100%)" }}
    >
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.06] blur-[130px]"
          style={{ background: "#FF6600", animation: "rpBlob 20s ease-in-out infinite alternate" }} />
      </div>
      <style>{`@keyframes rpBlob { to { transform: translate(-40px, 60px) scale(1.12); } }`}</style>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-[#FF6600]/10 border border-[#FF6600]/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7 text-[#FF6600]" />
          </div>
          <h1 className="font-['Calistoga',serif] text-3xl text-white tracking-tight">New Password</h1>
          <p className="text-[13px] text-white/40">Set your new credentials below</p>
        </div>

        <div
          className="rounded-3xl border border-white/[0.08] p-7 space-y-4"
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(32px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-[12px] leading-snug">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <fieldset className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-3 h-3" /> New Password
              </label>
              <input type="password" required placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
            </fieldset>
            <fieldset className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-3 h-3" /> Confirm New Password
              </label>
              <input type="password" required placeholder="••••••••" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className={inputClass} />
            </fieldset>
            <button
              type="submit" disabled={submitting}
              className="w-full h-12 rounded-xl font-bold text-[13px] text-black flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none mt-2"
              style={{ background: "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)", boxShadow: "0 0 32px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)" }}
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</> : "Set New Password"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
