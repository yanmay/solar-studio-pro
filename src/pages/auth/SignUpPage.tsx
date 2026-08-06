import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, Mail, Lock, User, Phone, ShieldAlert, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function SignUpPage() {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"homeowner" | "installer">("homeowner");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { signUp, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => { if (user) navigate("/", { replace: true }); }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !fullName || !phone) { setErrorMsg("Please fill in all fields."); return; }
    if (!/^[6-9]\d{9}$/.test(phone)) { setErrorMsg("Enter a valid 10-digit Indian mobile number."); return; }
    setSubmitting(true); setErrorMsg("");
    try {
      await signUp(email, password, fullName, phone, role);
      toast({ title: "Registration successful!", description: "Please check your email to verify your account." });
      navigate("/auth/signin");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full px-4 py-3 rounded-xl text-[13px] text-white placeholder:text-white/20 border border-white/[0.08] bg-white/[0.04] focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all duration-150";

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4 py-16 font-['Inter',sans-serif] antialiased text-white selection:bg-[#FF6600]/30"
      style={{ background: "linear-gradient(160deg, #020203 0%, #050506 60%, #0a0a0c 100%)" }}
    >
      {/* Ambient Blobs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.07] blur-[130px]"
          style={{ background: "#FF6600", animation: "signupBlob1 18s ease-in-out infinite alternate" }} />
        <div className="absolute bottom-[-15%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[110px]"
          style={{ background: "#059669", animation: "signupBlob2 24s ease-in-out infinite alternate" }} />
      </div>
      <style>{`
        @keyframes signupBlob1 { to { transform: translate(40px, 60px) scale(1.12); } }
        @keyframes signupBlob2 { to { transform: translate(-40px, -30px) scale(1.1); } }
      `}</style>

      <div className="w-full max-w-md relative z-10 space-y-6">
        <Link to="/" className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors duration-150 text-[12px] font-medium w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Home
        </Link>

        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2.5 mb-3">
            <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain" />
          </div>
          <h1 className="font-['Calistoga',serif] text-3xl text-white tracking-tight">
            Create Account
          </h1>
          <p className="text-[13px] text-white/40">Join SUNPOWER <span className="text-[#FF6600]">LINK</span> to track scans and solar potential</p>
        </div>

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
            <div className="grid grid-cols-2 gap-4">
              <fieldset className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                  <User className="w-3 h-3" /> Full Name
                </label>
                <input type="text" required placeholder="Rahul Sharma" value={fullName} onChange={e => setFullName(e.target.value)} className={inputClass} />
              </fieldset>
              <fieldset className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Mobile
                </label>
                <input type="tel" required maxLength={10} placeholder="9876543210" value={phone} onChange={e => setPhone(e.target.value)} className={inputClass} />
              </fieldset>
            </div>

            <fieldset className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                <Mail className="w-3 h-3" /> Email
              </label>
              <input type="email" required placeholder="name@example.com" value={email} onChange={e => setEmail(e.target.value)} className={inputClass} />
            </fieldset>

            <fieldset className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest flex items-center gap-1">
                <Lock className="w-3 h-3" /> Password
              </label>
              <input type="password" required placeholder="Min. 6 characters" value={password} onChange={e => setPassword(e.target.value)} className={inputClass} />
            </fieldset>

            {/* Role Toggle */}
            <fieldset className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-white/50 uppercase tracking-widest">I am a</label>
              <div className="grid grid-cols-2 gap-3">
                {(["homeowner", "installer"] as const).map(r => (
                  <button
                    key={r} type="button" onClick={() => setRole(r)}
                    className={`py-2.5 px-4 rounded-xl border text-[12px] font-semibold transition-all duration-150 cursor-pointer capitalize ${
                      role === r
                        ? "bg-[#FF6600]/10 border-[#FF6600]/50 text-[#FF6600]"
                        : "bg-white/[0.03] border-white/[0.08] text-white/40 hover:text-white/70 hover:bg-white/[0.06]"
                    }`}
                  >
                    {r === "homeowner" ? "Homeowner" : "Solar Installer"}
                  </button>
                ))}
              </div>
            </fieldset>

            <button
              type="submit" disabled={submitting}
              className="w-full h-12 rounded-xl font-bold text-[13px] text-black flex items-center justify-center gap-2 transition-all duration-200 active:scale-[0.98] disabled:opacity-50 cursor-pointer border-none mt-2"
              style={{
                background: "linear-gradient(135deg, #FF6600 0%, #FF8C38 100%)",
                boxShadow: "0 0 32px rgba(255,102,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
              }}
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating account…</> : "Create Account"}
            </button>
          </form>

          <p className="text-center text-[12px] text-white/30 pt-2 border-t border-white/[0.05]">
            Already have an account?{" "}
            <Link to="/auth/signin" className="text-[#FF6600] hover:text-orange-400 font-semibold transition-colors duration-150">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
