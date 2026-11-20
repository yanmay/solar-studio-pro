import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Mail, ShieldAlert, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { resetPassword } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { setErrorMsg("Please enter your email address."); return; }
    setSubmitting(true); setErrorMsg(""); setSuccessMsg("");
    try {
      await resetPassword(email);
      setSuccessMsg("If this email is registered, we've sent a reset link to your inbox.");
      toast({ title: "Reset link sent!", description: "Please check your inbox." });
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to trigger password reset. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="professional-product-ui min-h-screen flex flex-col items-center justify-center px-4 py-16 antialiased text-white selection:bg-[#FF6600]/30"
      style={{ background: "#050505" }}
    >
      <div className="hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[130px]"
          style={{ background: "#FF6600", animation: "fpBlob 20s ease-in-out infinite alternate" }} />
      </div>
      <style>{`@keyframes fpBlob { to { transform: translate(40px, 60px) scale(1.12); } }`}</style>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        <Link to="/auth/signin" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors duration-150 text-[12px] font-medium w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Sign In
        </Link>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="text-3xl font-semibold text-white">Reset Password</h1>
          <p className="text-[13px] text-white/40">Enter your email and we'll send a recovery link</p>
        </div>

        <div
          className="rounded-3xl border border-white/[0.08] p-7 space-y-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(32px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {successMsg ? (
            <div className="text-center space-y-5">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              </div>
              <p className="text-[13px] text-white/70 leading-relaxed">{successMsg}</p>
              <Link
                to="/auth/signin"
                className="block w-full h-11 rounded-xl font-bold text-[13px] text-black flex items-center justify-center transition-all duration-200 active:scale-[0.98] cursor-pointer border-none"
                style={{ background: "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)", boxShadow: "0 0 24px rgba(255,102,0,0.2)" }}
              >
                Return to Sign In
              </Link>
            </div>
          ) : (
            <>
              {errorMsg && (
                <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-[12px] leading-snug">
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <fieldset className="space-y-1.5">
                  <label htmlFor="email" className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                    <Mail className="w-3 h-3" /> Email address
                  </label>
                  <input
                    id="email" type="email" required placeholder="name@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/20 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150"
                  />
                </fieldset>
                <button
                  type="submit" disabled={submitting}
                  className="w-full h-12 rounded-xl font-bold text-[13px] text-black flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none"
                  style={{ background: "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)", boxShadow: "0 0 32px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)" }}
                >
                  {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending…</> : "Send Reset Link"}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
