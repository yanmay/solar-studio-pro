import { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Mail, Lock, ShieldAlert, ArrowLeft, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || "/";

  useEffect(() => { if (user) navigate(from, { replace: true }); }, [user, navigate, from]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setErrorMsg("Please fill in all fields."); return; }
    setSubmitting(true); setErrorMsg("");
    try {
      await signIn(email, password);
      toast({ title: "Welcome back!", description: "Successfully signed in." });
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="professional-product-ui min-h-screen flex flex-col items-center justify-center px-4 py-16 antialiased text-white selection:bg-[#FF6600]/30"
      style={{ background: "#050505" }}
    >
      {/* Ambient Blobs */}
      <div className="hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[130px]"
          style={{ background: "#FF6600", animation: "signinBlob1 18s ease-in-out infinite alternate" }} />
        <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[110px]"
          style={{ background: "#10B981", animation: "signinBlob2 22s ease-in-out infinite alternate" }} />
      </div>
      <style>{`
        @keyframes signinBlob1 { to { transform: translate(40px, 60px) scale(1.12); } }
        @keyframes signinBlob2 { to { transform: translate(-40px, -30px) scale(1.1); } }
      `}</style>

      <div className="w-full max-w-sm relative z-10 space-y-6">
        {/* Back link */}
        <Link to="/" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors duration-150 text-[12px] font-medium w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        {/* Logo & Heading */}
        <div className="text-center space-y-2 pb-2">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="font-['Calistoga',serif] text-3xl text-white tracking-tight">
            SUNPOWER <span className="text-[#FF6600]">LINK</span>
          </h1>
          <p className="text-[13px] text-white/40">Sign in to your rooftop solar account</p>
        </div>

        {/* Card */}
        <div
          className="rounded-3xl border border-white/[0.08] p-7 space-y-5"
          style={{
            background: "rgba(255,255,255,0.03)",
            backdropFilter: "blur(32px)",
            boxShadow: "0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)",
          }}
        >
          {errorMsg && (
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-red-500/[0.08] border border-red-500/20 text-red-400 text-[12px] leading-snug animate-in fade-in duration-200">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <fieldset className="space-y-1.5">
              <label htmlFor="email" className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <input
                id="email" type="email" required autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/20 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150"
              />
            </fieldset>

            <fieldset className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                  <Lock className="w-3 h-3" /> Password
                </label>
                <Link to="/auth/forgot-password" className="text-[11px] text-[#FF6600] hover:text-orange-400 transition-colors duration-150">
                  Forgot?
                </Link>
              </div>
              <input
                id="password" type="password" required autoComplete="current-password"
                value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/20 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150"
              />
            </fieldset>

            <button
              type="submit" disabled={submitting}
              className="w-full h-12 rounded-xl font-bold text-[13px] text-black flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none mt-2"
              style={{
                background: "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)",
                boxShadow: "0 0 32px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Signing in…</> : "Sign In"}
            </button>
          </form>

          <p className="text-center text-[12px] text-white/30 pt-2 border-t border-white/[0.05]">
            Don't have an account?{" "}
            <Link to="/auth/signup" className="text-[#FF6600] hover:text-orange-400 font-semibold transition-colors duration-150">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
