import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePayment } from "@/hooks/use-payment";
import { PricingModal, type SubscriptionPlan } from "@/components/PricingModal";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Phone,
  Layers,
  Zap,
  TrendingUp,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  PlusCircle,
  Bell,
  Lock,
  Globe,
  Image,
  Sparkles,
  RefreshCw,
  Download,
  FileText,
  UserCheck,
  Check,
  X
} from "lucide-react";
import { AnimatedThemeToggleButton } from "@/components/ui/animated-theme-toggle-button";

import { motion } from "framer-motion";

// ─── Dynamic Dark-First/Light Responsive Palette ─────────────────────────────
const isDarkTheme = () => {
  if (typeof window === "undefined") return true;
  return document.documentElement.classList.contains("dark");
};

const C = {
  get isDark() { return isDarkTheme(); },
  get background() { return this.isDark ? "#050505" : "#fffefc"; },
  get charcoal() { return this.isDark ? "#0c0c0e" : "#fffefc"; },
  get surfaceVariant() { return this.isDark ? "#121214" : "#cfe7d3"; },
  get surfaceContainerHigh() { return this.isDark ? "#18181b" : "#b1dbb8"; },
  get primary() { return this.isDark ? "#FF6600" : "#0f3e17"; },
  get primaryContainer() { return this.isDark ? "#FF6600" : "#0f3e17"; },
  get secondary() { return this.isDark ? "#41e1b4" : "#0f3e17"; },
  get onSurface() { return this.isDark ? "#eae0dd" : "#000000"; },
  get onSurfaceVariant() { return this.isDark ? "#dcc1ae" : "#222222"; },
  get mutedSand() { return this.isDark ? "#909090" : "#333333"; },
  get outline() { return this.isDark ? "#1f1f22" : "#e5e7eb"; },
  get outlineVariant() { return this.isDark ? "#27272a" : "#e5e7eb"; },
  get error() { return this.isDark ? "#ffb4ab" : "#c53030"; },
  get onPrimary() { return this.isDark ? "#000000" : "#fffefc"; },
  get onSecondary() { return this.isDark ? "#000000" : "#fffefc"; },
};

function useDarkMode() {
  const [darkMode, setDarkMode] = useState(() =>
    typeof window !== "undefined" ? document.documentElement.classList.contains("dark") : true
  );
  useEffect(() => {
    const sync = () => setDarkMode(document.documentElement.classList.contains("dark"));
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);
  return darkMode;
}

interface PurchasedLead {
  id: string; // lead request id
  assignment_id: string; // assignment id
  session_id: string;
  homeowner_name: string;
  homeowner_phone: string;
  assignment_status: 'delivered' | 'viewed' | 'contacted' | 'site_visit' | 'quoted' | 'won' | 'lost';
  reminder_date: string | null;
  reminder_note: string | null;
  project_stage: 'lead' | 'survey' | 'design' | 'install' | 'commissioned' | null;
  project_assignee: string | null;
  project_due_date: string | null;
  project_notes: string | null;
  latitude: number | null;
  longitude: number | null;
  address: string | null;
  total_roof_area_sqm: number | null;
  usable_roof_area_sqm: number | null;
  system_size_kwp: number | null;
  capex_estimate: number | null;
  pm_surya_subsidy: number | null;
  payback_years: number | null;
  annual_production_kwh: number | null;
  confidence_level: 'High' | 'Medium' | 'Low' | null;
  confidence_reason: string | null;
}

const CRM_FILTERS = [
  { id: "new", label: "New Leads", statuses: ["delivered", "viewed"], color: "#333333" },
  { id: "contacted", label: "Contacted", statuses: ["contacted"], color: "#316472" },
  { id: "site_visit", label: "Site Visit", statuses: ["site_visit"], color: "#4e3629" },
  { id: "quoted", label: "Quoted", statuses: ["quoted"], color: "#78531e" },
  { id: "won", label: "Won", statuses: ["won"], color: "#0f3e17" },
  { id: "lost", label: "Lost", statuses: ["lost"], color: "#8c3b3b" },
];

const KANBAN_PROJECT_STAGES = [
  { id: "lead", label: "Project Lead", color: "#316472" },
  { id: "survey", label: "Site Survey", color: "#4e3629" },
  { id: "design", label: "CAD Design", color: "#78531e" },
  { id: "install", label: "Installation", color: "#0f3e17" },
  { id: "commissioned", label: "Commissioned", color: "#0f3e17" },
];

export default function InstallerCrmPage() {
  useDarkMode();
  const navigate = useNavigate();
  const { user, role, loginAs, logout } = useAuth();
  const { toast } = useToast();

  const [leads, setLeads] = useState<PurchasedLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Tabs & Filters
  const [activeViewTab, setActiveViewTab] = useState<"leads" | "kanban">("leads");
  const [activeCrmFilter, setActiveCrmFilter] = useState<string>("new");
  const [activeKanbanStage, setActiveKanbanStage] = useState<string>("lead");

  // Detailed Drawer (Leads View)
  const [selectedLead, setSelectedLead] = useState<PurchasedLead | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Project Modal Editor (Kanban View)
  const [selectedProject, setSelectedProject] = useState<PurchasedLead | null>(null);
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [projectAssignee, setProjectAssignee] = useState("");
  const [projectDueDate, setProjectDueDate] = useState("");
  const [projectNotes, setProjectNotes] = useState("");

  // Reminder editing state
  const [activeReminderEdit, setActiveReminderEdit] = useState<string | null>(null); // assignmentId
  const [reminderDate, setReminderDate] = useState("");
  const [reminderNote, setReminderNote] = useState("");

  // Dragging states
  const [draggedProjectAssignmentId, setDraggedProjectAssignmentId] = useState<string | null>(null);

  // Installer subscription & branding state
  const { initiatePayment, isLoading: isUpgrading } = usePayment();
  const [profile, setProfile] = useState<{
    subscription_tier?: string;
    subscription_status?: string;
    trial_scans_remaining?: number | null;
    white_label?: boolean;
    custom_logo_url?: string | null;
    custom_domain?: string | null;
    company_name?: string;
  } | null>(null);

  const [logoUrlInput, setLogoUrlInput] = useState("");
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [brandingSaving, setBrandingSaving] = useState(false);

  // Pricing modal + subscription (provider-agnostic) state
  const [pricingOpen, setPricingOpen] = useState(false);
  const [subscribing, setSubscribing] = useState(false);

  // Custom-domain CNAME verification (F3) state
  const [domainStatus, setDomainStatus] = useState<"idle" | "checking" | "verified" | "failed">("idle");
  const [domainStatusMsg, setDomainStatusMsg] = useState<string | null>(null);

  // Auth/Signup form state
  const [authTab, setAuthTab] = useState<"signup" | "demo">("signup");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupCompany, setSignupCompany] = useState("");
  const [signupGstin, setSignupGstin] = useState("");
  const [signupCity, setSignupCity] = useState("");
  const [signupState, setSignupState] = useState("");
  const [signupLoading, setSignupLoading] = useState(false);
  const [signupError, setSignupError] = useState("");

  // F2: GSTIN verification status for the signup form.
  const [gstinStatus, setGstinStatus] = useState<"idle" | "checking" | "valid" | "invalid">("idle");
  const [gstinStatusMsg, setGstinStatusMsg] = useState<string | null>(null);

  const handleVerifyGstin = async () => {
    if (!signupGstin) return;
    setGstinStatus("checking");
    setGstinStatusMsg(null);
    try {
      const res = await fetch("/api/installer/verify-gstin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gstin: signupGstin }),
      });
      const json = await res.json();
      if (json.valid) {
        setGstinStatus("valid");
        setGstinStatusMsg(null);
      } else {
        setGstinStatus("invalid");
        setGstinStatusMsg(json.reason || "GSTIN not valid. Check for typos.");
      }
    } catch {
      setGstinStatus("invalid");
      setGstinStatusMsg("Could not verify GSTIN. Try again.");
    }
  };

  useEffect(() => {
    document.title = "Installer CRM Portal — SUNPOWER LINK";
    if (role === "installer" || role === "admin") {
      fetchLeads();
    }
  }, [role, user?.id]);

  useEffect(() => {
    if (profile) {
      setLogoUrlInput(profile.custom_logo_url || "");
      setCustomDomainInput(profile.custom_domain || "");
    }
  }, [profile]);

  const fetchLeads = async () => {
    if (!user?.id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/installer/leads/purchased?installerUserId=${user.id}`);
      if (!res.ok) {
        throw new Error("Failed to fetch purchased leads");
      }
      const json = await res.json();
      setLeads(json.leads || []);
      if (json.profile) {
        setProfile(json.profile);
      }
      
      // Update selected states if they are open to reflect refreshed DB data
      if (selectedLead) {
        const updated = json.leads.find((l: PurchasedLead) => l.assignment_id === selectedLead.assignment_id);
        if (updated) setSelectedLead(updated);
      }
      if (selectedProject) {
        const updated = json.leads.find((l: PurchasedLead) => l.assignment_id === selectedProject.assignment_id);
        if (updated) setSelectedProject(updated);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // Open the pricing modal (provider-agnostic subscription, no Razorpay needed).
  const handleUpgrade = () => {
    if (!user?.id) return;
    setPricingOpen(true);
  };

  const handleSubscribe = async (plan: SubscriptionPlan) => {
    if (!user?.id) return;
    setSubscribing(true);
    try {
      const res = await fetch("/api/subscription/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installerUserId: user.id, plan }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Subscription failed");
      toast({
        title: "Pro Activated",
        description: `Your ${plan === "pro_annual" ? "annual" : "monthly"} Pro subscription is now active.`,
      });
      setPricingOpen(false);
      await fetchLeads();
    } catch (e) {
      toast({
        title: "Subscription Error",
        description: e instanceof Error ? e.message : "Could not activate subscription.",
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

  const handleCancelSubscription = async () => {
    if (!user?.id) return;
    setSubscribing(true);
    try {
      const res = await fetch("/api/subscription/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installerUserId: user.id }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Cancellation failed");
      toast({ title: "Subscription Cancelled", description: "You're back on the Free tier." });
      await fetchLeads();
    } catch (e) {
      toast({
        title: "Cancellation Error",
        description: e instanceof Error ? e.message : "Could not cancel subscription.",
        variant: "destructive",
      });
    } finally {
      setSubscribing(false);
    }
  };

  // F3: verify the custom domain's CNAME points at our white-label target.
  const handleVerifyDomain = async () => {
    if (!user?.id || !customDomainInput) return;
    setDomainStatus("checking");
    setDomainStatusMsg(null);
    try {
      const res = await fetch("/api/installer/verify-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: customDomainInput, installerUserId: user.id }),
      });
      const json = await res.json();
      if (json.verified) {
        setDomainStatus("verified");
        setDomainStatusMsg("Domain verified — CNAME is correctly configured.");
      } else {
        setDomainStatus("failed");
        setDomainStatusMsg(json.reason || "CNAME record not found.");
      }
    } catch {
      setDomainStatus("failed");
      setDomainStatusMsg("Verification request failed. Try again.");
    }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.id) return;
    setBrandingSaving(true);
    try {
      const res = await fetch("/api/installer/branding/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installerUserId: user.id,
          customLogoUrl: logoUrlInput || null,
          customDomain: customDomainInput || null
        })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Branding update failed");
      toast({
        title: "Branding Updated",
        description: "Your custom logo and domain have been saved successfully.",
      });
      fetchLeads();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive"
      });
    } finally {
      setBrandingSaving(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSignupError("");
    if (!signupEmail || !signupCompany || !signupGstin || !signupCity || !signupState) {
      setSignupError("All fields are required.");
      return;
    }
    const gstinRegex = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[0-9A-Z]{3}$/;
    if (!gstinRegex.test(signupGstin)) {
      setSignupError("Invalid Indian GSTIN format. Must be 15 alphanumeric characters (e.g. 27AAPCG0818N1ZS).");
      return;
    }
    setSignupLoading(true);
    try {
      const res = await fetch("/api/installer/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: signupEmail,
          companyName: signupCompany,
          gstin: signupGstin,
          city: signupCity,
          state: signupState,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Signup failed");
      toast({
        title: "Registration Successful",
        description: "Self-serve signup complete. Your 10 free scans/month are active!",
      });
      loginAs(signupEmail, "installer", { id: json.profileId, companyName: signupCompany });
    } catch (err: any) {
      setSignupError(err.message || "An error occurred during registration");
    } finally {
      setSignupLoading(false);
    }
  };

  // Drag & Drop for Projects Kanban
  const onProjectDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
    setDraggedProjectAssignmentId(id);
  };

  const onProjectDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onProjectDrop = async (e: React.DragEvent, targetStage: string) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain") || draggedProjectAssignmentId;
    if (!id) return;

    // Optimistic UI update
    setLeads((prev) =>
      prev.map((l) =>
        l.assignment_id === id
          ? { ...l, project_stage: targetStage as any }
          : l
      )
    );

    try {
      const res = await fetch("/api/installer/leads/update-assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: id,
          installerUserId: user?.id,
          projectStage: targetStage
        })
      });
      if (!res.ok) {
        throw new Error("Failed to update project stage on server");
      }
      toast({
        title: "Project Stage Updated",
        description: `Project moved to ${targetStage.toUpperCase()}.`,
      });
      fetchLeads();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive"
      });
      fetchLeads();
    }
    setDraggedProjectAssignmentId(null);
  };

  // Convert Lead manually to Project
  const handleConvertLeadToProject = async (assignmentId: string) => {
    try {
      const res = await fetch("/api/installer/leads/update-assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          installerUserId: user?.id,
          projectStage: "lead"
        })
      });
      if (!res.ok) {
        throw new Error("Failed to promote lead to project");
      }
      toast({
        title: "Promoted to Project",
        description: "Deal converted. Check the Project Kanban Board!",
      });
      fetchLeads();
    } catch (err: any) {
      toast({
        title: "Promotion Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Update CRM Status
  const handleUpdateCrmStatus = async (assignmentId: string, status: string) => {
    try {
      const res = await fetch("/api/installer/leads/update-assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          installerUserId: user?.id,
          status
        })
      });
      if (!res.ok) {
        throw new Error("Failed to update status");
      }
      toast({
        title: "Status Updated",
        description: `CRM status changed to ${status.toUpperCase()}.`,
      });
      fetchLeads();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Save Follow-up Reminder
  const handleSaveReminder = async (assignmentId: string) => {
    try {
      const res = await fetch("/api/installer/leads/update-assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId,
          installerUserId: user?.id,
          reminderDate: reminderDate || null,
          reminderNote: reminderNote || null
        })
      });
      if (!res.ok) {
        throw new Error("Failed to save reminder");
      }
      toast({
        title: "Reminder Configured",
        description: "Follow-up reminder saved successfully.",
      });
      setActiveReminderEdit(null);
      fetchLeads();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Save Project Kanban Details
  const handleSaveProjectDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const res = await fetch("/api/installer/leads/update-assignment", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assignmentId: selectedProject.assignment_id,
          installerUserId: user?.id,
          projectAssignee: projectAssignee || null,
          projectDueDate: projectDueDate || null,
          projectNotes: projectNotes || null
        })
      });
      if (!res.ok) {
        throw new Error("Failed to save project details");
      }
      toast({
        title: "Project Saved",
        description: "Assignee, timeline, and task notes updated.",
      });
      setProjectModalOpen(false);
      fetchLeads();
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Proposal PDF Download Trigger
  const handleDownloadProposal = async (lead: PurchasedLead) => {
    try {
      const customer = {
        name: lead.homeowner_name,
        address: lead.address || "Rooftop Structure",
        phone: lead.homeowner_phone
      };
      const branding = profile ? {
        companyName: profile.company_name,
        logoUrl: profile.custom_logo_url || undefined,
        domain: profile.custom_domain || undefined,
        isWhiteLabeled: profile.white_label
      } : undefined;
      
      const { generateHomeownerProposal } = await import("@/lib/pdf-generator");
      await generateHomeownerProposal(lead, customer, branding);
      
      toast({
        title: "Proposal Generated",
        description: "Homeowner proposal PDF downloaded.",
      });
    } catch (err: any) {
      toast({
        title: "Generation Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };

  // Overdue Reminder calculation
  const overdueReminders = leads.filter((lead) => {
    if (!lead.reminder_date) return false;
    const isPastOrToday = new Date(lead.reminder_date).toDateString() === new Date().toDateString() || new Date(lead.reminder_date) < new Date();
    return isPastOrToday && lead.assignment_status !== 'won' && lead.assignment_status !== 'lost';
  });

  // Gated Role Bypass for Testing & Demonstration
  if (role !== "installer" && role !== "admin") {
    return (
      <div className="min-h-screen text-charcoal font-sans antialiased overflow-x-hidden flex items-center justify-center py-10" style={{ background: C.background }}>
        <div className="max-w-lg w-full mx-4 p-8 rounded-3xl border space-y-6 shadow-2xl" style={{ background: C.charcoal, borderColor: C.outlineVariant }}>
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-[#0f3e17]/10 flex items-center justify-center mx-auto">
              <Lock className="w-6 h-6 text-forest-ink" />
            </div>
            <h1 className="text-2xl font-bold font-display" style={{  }}>Installer CRM Portal</h1>
            <p className="text-xs text-graphite leading-relaxed max-w-sm mx-auto">
              Access customer pipelines, track project leads, manage solar installations, and configure custom report white-labeling.
            </p>
          </div>

          <div className="flex p-0.5 rounded-lg border" style={{ borderColor: C.outlineVariant, background: C.background }}>
            <button
              onClick={() => setAuthTab("signup")}
              style={{
                background: authTab === "signup" ? C.surfaceVariant : "transparent",
                color: authTab === "signup" ? "white" : C.mutedSand
              }}
              className="flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all font-mono border-none outline-none cursor-pointer"
            >
              Self-Serve Sign-up
            </button>
            <button
              onClick={() => setAuthTab("demo")}
              style={{
                background: authTab === "demo" ? C.surfaceVariant : "transparent",
                color: authTab === "demo" ? "white" : C.mutedSand
              }}
              className="flex-1 py-2 text-xs font-bold uppercase tracking-wider rounded-md transition-all font-mono border-none outline-none cursor-pointer"
            >
              Demo Gate Bypass
            </button>
          </div>

          {authTab === "signup" ? (
            <form onSubmit={handleSignup} className="space-y-4">
              {signupError && (
                <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{signupError}</span>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>Company Name</label>
                <input
                  type="text"
                  placeholder="e.g. Maharashtra Solar Pro"
                  value={signupCompany}
                  onChange={(e) => setSignupCompany(e.target.value)}
                  style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>Email Address</label>
                <input
                  type="email"
                  placeholder="e.g. contact@mahasolar.com"
                  value={signupEmail}
                  onChange={(e) => setSignupEmail(e.target.value)}
                  style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider font-mono block" style={{ color: C.mutedSand }}>
                  GSTIN (Indian Tax Identifier)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="e.g. 27AAPCG0818N1ZS"
                    value={signupGstin}
                    onChange={(e) => { setSignupGstin(e.target.value.toUpperCase()); setGstinStatus("idle"); }}
                    onBlur={handleVerifyGstin}
                    style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                    className="w-full px-3 py-2 pr-9 text-xs font-mono rounded-lg border focus:outline-none focus:border-forest-ink"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
                    {gstinStatus === "checking" && <RefreshCw className="w-3.5 h-3.5 animate-spin text-graphite" />}
                    {gstinStatus === "valid" && <CheckCircle2 className="w-3.5 h-3.5 text-forest-ink" />}
                    {gstinStatus === "invalid" && <AlertCircle className="w-3.5 h-3.5 text-[#c53030]" />}
                  </span>
                </div>
                {gstinStatus === "invalid" && gstinStatusMsg && (
                  <p className="text-[10px] font-mono text-[#c53030] leading-relaxed">{gstinStatusMsg}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>City</label>
                  <input
                    type="text"
                    placeholder="e.g. Pune"
                    value={signupCity}
                    onChange={(e) => setSignupCity(e.target.value)}
                    style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider font-mono" style={{ color: C.mutedSand }}>State</label>
                  <input
                    type="text"
                    placeholder="e.g. Maharashtra"
                    value={signupState}
                    onChange={(e) => setSignupState(e.target.value)}
                    style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                    className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={signupLoading}
                style={{ background: C.primaryContainer, color: C.onPrimary }}
                className="w-full py-3 text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity font-mono cursor-pointer border-none outline-none mt-2 flex items-center justify-center gap-2"
              >
                {signupLoading ? "Creating Account..." : "Register & Start Scanning →"}
              </button>
            </form>
          ) : (
            <div className="space-y-3 pt-2">
              <p className="text-[10px] uppercase font-mono tracking-wider text-center" style={{ color: C.mutedSand }}>Quick Bypass (Demo Logins)</p>
              <button
                onClick={() => loginAs("installer@solarpune.com", "installer", { id: "installer-user-a", companyName: "Pune Solar Pros" })}
                className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg border bg-transparent hover:bg-[#0f3e17]/10 transition-colors cursor-pointer"
                style={{ borderColor: C.outlineVariant, color: C.primary }}
              >
                Demo: Pune Solar Pros
              </button>
              <button
                onClick={() => loginAs("installer@solarmumbai.com", "installer", { id: "installer-user-b", companyName: "Mumbai Sun Power" })}
                className="w-full py-2.5 text-xs font-mono font-bold uppercase tracking-wider rounded-lg border bg-transparent hover:bg-emerald-500/10 transition-colors cursor-pointer"
                style={{ borderColor: C.outlineVariant, color: C.secondary }}
              >
                Demo: Mumbai Sun Power
              </button>
            </div>
          )}

          <div className="border-t pt-4 text-center" style={{ borderColor: C.outlineVariant }}>
            <button
              onClick={() => navigate("/")}
              className="py-1 text-xs font-bold uppercase tracking-widest text-graphite hover:text-charcoal transition-colors cursor-pointer bg-transparent border-none"
            >
              ← Back to Homepage
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Filter lists
  const collapsedNewCrmStatus = (status: string) => status === 'delivered' || status === 'viewed';
  
  const filteredCrmLeads = leads.filter((lead) => {
    if (activeCrmFilter === "new") return collapsedNewCrmStatus(lead.assignment_status);
    return lead.assignment_status === activeCrmFilter;
  });

  const promotedKanbanProjects = leads.filter((lead) => lead.project_stage !== null);

  return (
    <div className="min-h-screen text-charcoal font-sans antialiased overflow-x-hidden" style={{ background: C.background }}>
      <style>{`
        .kanban-scroll::-webkit-scrollbar {
          height: 6px;
        }
        .kanban-scroll::-webkit-scrollbar-track {
          background: #fffefc;
        }
        .kanban-scroll::-webkit-scrollbar-thumb {
          background: #e5e7eb;
          border-radius: 99px;
        }
      `}</style>

      {/* Header */}
      <header className="sticky top-0 z-40 backdrop-blur-md bg-linen-white/80" style={{ borderBottom: `1px solid ${C.outlineVariant}` }}>
        <div className="flex justify-between items-center px-4 md:px-16 py-3 mx-auto max-w-[1280px]">
          <div style={{ color: C.mutedSand, fontWeight: 500 }} className="flex items-center gap-1.5 text-sm sm:text-base md:text-xl shrink-0">
            <span className="text-black font-light">SUNPOWER</span>
            <span className="font-serif italic font-light text-forest-ink">LINK</span>
            <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-[#0f3e17]/10 text-forest-ink">CRM</span>
          </div>
          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden md:inline text-[11px] font-mono" style={{ color: C.mutedSand }}>
              Logged in as: <strong className="text-black font-semibold">{user?.companyName || "Verified Installer"}</strong>
            </span>
            {profile && (
              <span className="text-[9px] uppercase font-mono px-2 py-0.5 rounded-full font-bold border" style={{
                background: profile.subscription_tier === "pro" ? `${C.secondary}15` : `${C.primary}15`,
                color: profile.subscription_tier === "pro" ? C.secondary : C.primary,
                borderColor: profile.subscription_tier === "pro" ? `${C.secondary}30` : `${C.primary}30`
              }}>
                {profile.subscription_tier === "pro" ? "Pro Plan" : "Trial Plan"}
              </span>
            )}
            <AnimatedThemeToggleButton type="vertical" />
            <button onClick={logout}
              className="px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider font-mono hover:opacity-85"
              style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}` }}>
              Logout
            </button>
            <button onClick={() => navigate("/")}
              style={{ background: C.charcoal, border: `1px solid ${C.outlineVariant}`, color: C.onSurface }}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider hover:opacity-80 transition-opacity">
              <ArrowLeft className="w-3 h-3" /> Exit
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <motion.main
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="max-w-[1280px] mx-auto px-4 md:px-16 py-8 flex flex-col gap-6"
      >

        {/* Reminder Overdue Warning Bar */}
        {overdueReminders.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col gap-2 sp-fade-up">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#c53030]">
              <Bell className="w-4 h-4 animate-bounce" />
              <span>Overdue Follow-up Reminders:</span>
            </div>
            <div className="flex flex-col gap-1.5 pl-6">
              {overdueReminders.map((lead) => (
                <button
                  key={lead.assignment_id}
                  onClick={() => {
                    setSelectedLead(lead);
                    setDrawerOpen(true);
                  }}
                  className="text-left text-xs text-neutral-700 hover:text-charcoal transition-colors hover:underline block bg-transparent border-none outline-none cursor-pointer font-mono"
                >
                  📍 {lead.homeowner_name} (+91 {lead.homeowner_phone}) — Due: {new Date(lead.reminder_date!).toLocaleDateString("en-IN")} {lead.reminder_note ? `("${lead.reminder_note}")` : ""}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {/* Account & Subscription Manager Section */}
        {profile && (
          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 sp-fade-up">
            {/* Left Column: Plan Info */}
            <div
              style={{ background: C.charcoal, borderColor: C.outlineVariant }}
              className="lg:col-span-6 p-6 rounded-2xl border flex flex-col justify-between gap-4"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: C.mutedSand }}>
                      Account Tier
                    </span>
                    <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: C.onSurface }}>
                      {profile.subscription_tier === "pro" ? (
                        <>
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          Pro Subscription
                        </>
                      ) : (
                        <>
                          <Zap className="w-5 h-5 text-forest-ink" />
                          Trial Plan (Free Tier)
                        </>
                      )}
                    </h2>
                  </div>
                  <span
                    style={{
                      background: profile.subscription_tier === "pro" ? `${C.secondary}15` : `${C.primary}15`,
                      color: profile.subscription_tier === "pro" ? C.secondary : C.primary,
                      borderColor: profile.subscription_tier === "pro" ? C.secondary : C.primary,
                    }}
                    className="text-[10px] font-bold uppercase tracking-wider font-mono px-3 py-1 rounded-full border"
                  >
                    {profile.subscription_status || "Active"}
                  </span>
                </div>

                <p className="text-xs leading-relaxed" style={{ color: C.mutedSand }}>
                  {profile.subscription_tier === "pro"
                    ? "Enjoy unlimited scans, custom white-labeled PDFs, and custom branding overrides."
                    : "Get 10 free scans per month with SUNPOWER LINK branding on reports. Upgrade to unlock white-label features."}
                </p>

                {profile.subscription_tier !== "pro" && (
                  <div className="p-3.5 rounded-xl border space-y-2 mt-2" style={{ background: `${C.primary}08`, borderColor: `${C.primary}20` }}>
                    <div className="flex justify-between text-xs font-mono">
                      <span style={{ color: C.mutedSand }}>Scan Balance</span>
                      <span className="font-bold text-charcoal">{profile.trial_scans_remaining ?? 10} / 10 remaining</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.surfaceVariant }}>
                      <div
                        className="h-full transition-all"
                        style={{
                          width: `${((profile.trial_scans_remaining ?? 10) / 10) * 100}%`,
                          background: C.primary,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  onClick={() => navigate("/map")}
                  style={{ background: C.secondary, color: "#fffefc" }}
                  className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity font-mono cursor-pointer border-none outline-none"
                >
                  Start New Scan
                </button>
                
                {profile.subscription_tier !== "pro" ? (
                  <button
                    onClick={handleUpgrade}
                    style={{ background: C.primaryContainer, color: C.onPrimary }}
                    className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity font-mono cursor-pointer border-none outline-none flex items-center justify-center gap-1.5"
                  >
                    View Plans (₹3,500/mo)
                  </button>
                ) : (
                  <button
                    onClick={handleCancelSubscription}
                    disabled={subscribing}
                    style={{ background: "transparent", border: `1px solid ${C.outlineVariant}`, color: C.mutedSand }}
                    className="flex-1 py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity font-mono cursor-pointer outline-none flex items-center justify-center gap-1.5"
                  >
                    {subscribing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Cancel Subscription"
                    )}
                  </button>
                )}
              </div>
            </div>

            {/* Right Column: Custom Branding Settings */}
            <div
              style={{ background: C.charcoal, borderColor: C.outlineVariant }}
              className="lg:col-span-6 p-6 rounded-2xl border flex flex-col justify-between gap-4 relative overflow-hidden"
            >
              {profile.subscription_tier !== "pro" && (
                <div
                  style={{ background: `${C.charcoal}e6`, backdropFilter: "blur(4px)" }}
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center text-center p-6 space-y-3"
                >
                  <Lock className="w-8 h-8 text-graphite" />
                  <div className="space-y-1">
                    <h3 className="text-sm font-bold text-charcoal uppercase tracking-wider font-mono">White-Label Branding Locked</h3>
                    <p className="text-[11px] text-graphite max-w-xs leading-relaxed">
                      Upgrade to Pro to customize reports with your company logo and host PDFs on your own custom domain.
                    </p>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    disabled={isUpgrading}
                    style={{ background: `${C.primaryContainer}20`, border: `1px solid ${C.primaryContainer}`, color: C.primary }}
                    className="px-4 py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg hover:opacity-90 disabled:opacity-50 transition-all font-mono cursor-pointer"
                  >
                    Unlock White-Label Settings
                  </button>
                </div>
              )}

              <form onSubmit={handleSaveBranding} className="space-y-4 flex-1 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-widest font-mono" style={{ color: C.mutedSand }}>
                      Custom Logo & Domain
                    </span>
                    <h2 className="text-sm font-bold uppercase tracking-wider font-mono" style={{ color: C.onSurface }}>
                      Branding Configuration
                    </h2>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" style={{ color: C.mutedSand }}>
                      <Image className="w-3.5 h-3.5" /> Company Logo URL
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://yourdomain.com/assets/logo.png"
                      value={logoUrlInput}
                      onChange={(e) => setLogoUrlInput(e.target.value)}
                      style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                      className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold uppercase tracking-wider font-mono flex items-center gap-1.5" style={{ color: C.mutedSand }}>
                      <Globe className="w-3.5 h-3.5" /> Custom Domain
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. solar.yourcompany.com"
                      value={customDomainInput}
                      onChange={(e) => { setCustomDomainInput(e.target.value); setDomainStatus("idle"); setDomainStatusMsg(null); }}
                      style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                      className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink font-mono"
                    />
                    {/* F3: CNAME verification */}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleVerifyDomain}
                        disabled={!customDomainInput || domainStatus === "checking"}
                        style={{ borderColor: C.outlineVariant, color: C.onSurface }}
                        className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider rounded-lg border hover:opacity-90 disabled:opacity-40 transition-opacity font-mono cursor-pointer flex items-center gap-1.5"
                      >
                        {domainStatus === "checking" ? (
                          <><RefreshCw className="w-3 h-3 animate-spin" /> Checking...</>
                        ) : (
                          "Verify Domain"
                        )}
                      </button>
                      {domainStatus === "verified" && (
                        <span className="text-[10px] font-mono flex items-center gap-1 text-forest-ink">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                        </span>
                      )}
                      {domainStatus === "failed" && (
                        <span className="text-[10px] font-mono flex items-center gap-1 text-[#c53030]">
                          <AlertCircle className="w-3.5 h-3.5" /> Pending
                        </span>
                      )}
                    </div>
                    {domainStatus !== "idle" && domainStatusMsg && (
                      <p className="text-[10px] font-mono leading-relaxed pt-1" style={{ color: C.mutedSand }}>
                        {domainStatusMsg}
                      </p>
                    )}
                    <p className="text-[10px] font-mono leading-relaxed pt-1" style={{ color: C.mutedSand }}>
                      Add a CNAME record: <span className="text-charcoal">{customDomainInput ? customDomainInput.split(".")[0] : "solar"}</span> → <span className="text-charcoal">cname.solarscan.in</span>
                    </p>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={brandingSaving}
                  style={{ background: C.secondary, color: "#fffefc" }}
                  className="w-full py-2.5 text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity font-mono cursor-pointer border-none outline-none mt-4 flex items-center justify-center gap-2"
                >
                  {brandingSaving ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Branding Settings"
                  )}
                </button>
              </form>
            </div>
          </section>
        )}

        {/* Dashboard Title & View Tab Switcher */}
        <section className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-t pt-6" style={{ borderColor: C.outlineVariant }}>
          <div className="space-y-3">
            <div className="space-y-1">
              <div className="text-xs font-mono uppercase tracking-[0.2em]" style={{ color: C.primary }}>
                Installer Portal
              </div>
              <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-charcoal font-display" style={{  }}>
                Workflow <span className="text-forest-ink italic font-serif font-light">Layer</span>
              </h1>
            </div>
            {/* View Tab Swapping */}
            <div className="flex border-b border-hairline-gray gap-6">
              <button
                onClick={() => setActiveViewTab("leads")}
                className={`pb-3 text-sm font-bold uppercase tracking-wider relative transition-all border-none bg-transparent outline-none cursor-pointer ${
                  activeViewTab === "leads" ? "text-forest-ink" : "text-graphite hover:text-black"
                }`}
              >
                Leads Pipeline
                {activeViewTab === "leads" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0f3e17]" />
                )}
              </button>
              <button
                onClick={() => setActiveViewTab("kanban")}
                className={`pb-3 text-sm font-bold uppercase tracking-wider relative transition-all border-none bg-transparent outline-none cursor-pointer ${
                  activeViewTab === "kanban" ? "text-forest-ink" : "text-graphite hover:text-black"
                }`}
              >
                Project Kanban Board
                {activeViewTab === "kanban" && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#0f3e17]" />
                )}
              </button>
            </div>
          </div>
          <button
            onClick={fetchLeads}
            disabled={loading}
            className="px-4 py-2 text-xs font-bold uppercase tracking-wider hover:opacity-90 disabled:opacity-50 font-mono"
            style={{ background: C.primaryContainer, color: "#fffefc" }}
          >
            {loading ? "Refreshing..." : "Sync Portal"}
          </button>
        </section>

        {error && (
          <div className="p-4 rounded-xl border flex items-center gap-2 text-xs" style={{ background: `${C.error}08`, borderColor: C.error, color: C.error }}>
            <AlertCircle className="w-4 h-4" />
            <span>Error: {error}</span>
          </div>
        )}

        {/* View Layouts */}
        {loading && leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-10 h-10 border-2 border-t-transparent animate-spin rounded-full" style={{ borderColor: `${C.primary} transparent transparent transparent` }}></div>
            <span className="text-xs font-mono text-graphite">Syncing database data...</span>
          </div>
        ) : activeViewTab === "leads" ? (
          /* ==================================================== */
          /* ================== LEADS PIPELINE VIEW ============= */
          /* ==================================================== */
          <div className="space-y-4">
            {/* Filter buttons */}
            <div className="flex flex-wrap gap-2">
              {CRM_FILTERS.map((f) => {
                const count = leads.filter((l) => {
                  if (f.id === "new") return collapsedNewCrmStatus(l.assignment_status);
                  return l.assignment_status === f.id;
                }).length;

                return (
                  <button
                    key={f.id}
                    onClick={() => setActiveCrmFilter(f.id)}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-mono uppercase tracking-wider transition-all cursor-pointer border flex items-center gap-1.5"
                    style={{
                      background: activeCrmFilter === f.id ? f.color : "transparent",
                      color: activeCrmFilter === f.id ? C.onPrimary : C.onSurfaceVariant,
                      borderColor: activeCrmFilter === f.id ? f.color : `${C.outlineVariant}50`
                    }}
                  >
                    <span>{f.label}</span>
                    <span className="px-1.5 py-0.2 rounded bg-black/15 text-[10px]">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Leads list grid */}
            {filteredCrmLeads.length === 0 ? (
              <div className="py-20 text-center border border-dashed rounded-2xl border-hairline-gray" style={{ background: `${C.charcoal}20` }}>
                <span className="text-xs text-graphite font-mono">No leads found in this stage.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredCrmLeads.map((lead) => {
                  const showReminder = lead.reminder_date || lead.reminder_note;
                  const isOverdue = lead.reminder_date && new Date(lead.reminder_date) < new Date();

                  return (
                    <div
                      key={lead.assignment_id}
                      onClick={() => {
                        setSelectedLead(lead);
                        setDrawerOpen(true);
                      }}
                      className="p-5 rounded-2xl border flex flex-col justify-between gap-4 cursor-pointer hover:border-[#0f3e17]/50 hover:shadow-xl transition-all"
                      style={{ background: C.charcoal, borderColor: `${C.outlineVariant}60` }}
                    >
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <h3 className="font-semibold text-sm text-charcoal flex items-center gap-1.5">
                            <User className="w-4 h-4 text-forest-ink" />
                            {lead.homeowner_name}
                          </h3>
                          {lead.project_stage && (
                            <span className="text-[8px] uppercase tracking-widest font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-forest-ink border border-emerald-500/20">
                              Project active
                            </span>
                          )}
                        </div>

                        <div className="space-y-1 text-xs">
                          <div className="flex items-center gap-1 text-graphite">
                            <Phone className="w-3.5 h-3.5" />
                            <span>+91 {lead.homeowner_phone}</span>
                          </div>
                          {lead.address && (
                            <div className="text-graphite font-mono text-[10px] truncate max-w-xs">
                              📍 {lead.address}
                            </div>
                          )}
                        </div>

                        <div className="bg-linen-white/60 rounded-xl p-3 grid grid-cols-3 gap-2 text-[10px] font-mono text-center">
                          <div>
                            <span className="text-graphite block">Capacity</span>
                            <span className="text-charcoal font-semibold block mt-0.5">
                              {lead.system_size_kwp ? `${lead.system_size_kwp} kW` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-graphite block">Payback</span>
                            <span className="text-charcoal font-semibold block mt-0.5">
                              {lead.payback_years ? `${lead.payback_years} yr` : "N/A"}
                            </span>
                          </div>
                          <div>
                            <span className="text-graphite block">Net CapEx</span>
                            <span className="text-charcoal font-semibold block mt-0.5">
                              {lead.capex_estimate && lead.pm_surya_subsidy
                                ? `₹${((lead.capex_estimate - lead.pm_surya_subsidy) / 100000).toFixed(1)}L`
                                : "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Reminder bar inside card */}
                      {showReminder && (
                        <div
                          className="p-2 rounded-lg border text-[9px] flex flex-col gap-0.5"
                          style={{
                            background: isOverdue ? "rgba(239, 68, 68, 0.08)" : "rgba(65, 225, 180, 0.08)",
                            borderColor: isOverdue ? "rgba(239, 68, 68, 0.2)" : "rgba(65, 225, 180, 0.2)",
                          }}
                        >
                          <span className="font-semibold flex items-center gap-1 uppercase" style={{ color: isOverdue ? "#f87171" : "#41e1b4" }}>
                            <Bell className="w-2.5 h-2.5" />
                            {isOverdue ? "Overdue Alert" : "Reminder Due"}
                            {lead.reminder_date && ` · ${new Date(lead.reminder_date).toLocaleDateString("en-IN")}`}
                          </span>
                          {lead.reminder_note && (
                            <span className="text-graphite truncate">"{lead.reminder_note}"</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ==================================================== */
          /* =================== KANBAN BOARD VIEW ============== */
          /* ==================================================== */
          <div className="space-y-4">
            {/* Mobile Kanban Stage Switcher */}
            <div className="flex md:hidden overflow-x-auto no-scrollbar gap-1.5 p-1 bg-linen-white rounded-xl border border-hairline-gray mb-2">
              {KANBAN_PROJECT_STAGES.map((stage) => (
                <button
                  key={stage.id}
                  onClick={() => setActiveKanbanStage(stage.id)}
                  style={{
                    background: activeKanbanStage === stage.id ? stage.color : "transparent",
                    color: activeKanbanStage === stage.id ? "black" : "#eae0dd",
                  }}
                  className={`flex-1 min-w-[95px] py-2 text-[10px] font-bold uppercase tracking-wider rounded-lg border-none outline-none transition-all cursor-pointer text-center`}
                >
                  {stage.label.replace("Project ", "").replace("Site ", "").replace("CAD ", "")}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 overflow-x-auto pb-4 kanban-scroll">
              {KANBAN_PROJECT_STAGES.map((stage) => {
                const stageProjects = promotedKanbanProjects.filter((lead) => lead.project_stage === stage.id);
                const isStageActive = activeKanbanStage === stage.id;

                return (
                  <div
                    key={stage.id}
                    onDragOver={onProjectDragOver}
                    onDrop={(e) => onProjectDrop(e, stage.id)}
                    className={`flex-col rounded-2xl p-3 min-h-[400px] md:flex ${
                      isStageActive ? "flex" : "hidden md:flex"
                    }`}
                    style={{ background: `${C.charcoal}40`, border: `1px solid ${C.outlineVariant}30` }}
                  >
                    {/* Column Header */}
                    <div className="flex justify-between items-center mb-3 pb-2 border-b border-hairline-gray">
                      <span className="text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5" style={{ color: stage.color }}>
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: stage.color }}></span>
                        {stage.label}
                      </span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-graphite">
                        {stageProjects.length}
                      </span>
                    </div>

                    {/* Project Cards List */}
                    <div className="flex-1 space-y-3">
                      {stageProjects.length === 0 ? (
                        <div className="h-full flex items-center justify-center py-12 text-center border border-dashed rounded-xl border-hairline-gray">
                          <span className="text-[9px] font-mono text-graphite">Drag projects here</span>
                        </div>
                      ) : (
                        stageProjects.map((proj) => {
                          const showReminder = proj.reminder_date || proj.reminder_note;
                          const isOverdue = proj.reminder_date && new Date(proj.reminder_date) < new Date();

                          return (
                            <div
                              key={proj.assignment_id}
                              draggable
                              onDragStart={(e) => onProjectDragStart(e, proj.assignment_id)}
                              onClick={() => {
                                setSelectedProject(proj);
                                setProjectAssignee(proj.project_assignee || "");
                                setProjectDueDate(proj.project_due_date ? proj.project_due_date.substring(0, 10) : "");
                                setProjectNotes(proj.project_notes || "");
                                setProjectModalOpen(true);
                              }}
                              className="p-4 rounded-xl border space-y-3 relative group hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all cursor-grab active:cursor-grabbing hover:border-amber-400/30"
                              style={{ background: C.charcoal, borderColor: C.outlineVariant }}
                            >
                              <div className="space-y-1">
                                <span className="font-semibold text-xs text-charcoal block">
                                  {proj.homeowner_name}
                                </span>
                                {proj.address && (
                                  <span className="text-[9px] text-graphite block truncate max-w-[150px]">
                                    📍 {proj.address}
                                  </span>
                                )}
                              </div>

                              <div className="bg-linen-white/60 border border-hairline-gray rounded-lg p-2 grid grid-cols-2 gap-2 text-[9px] font-mono text-center">
                                <div>
                                  <span className="text-graphite block">Capacity</span>
                                  <span className="text-charcoal font-bold block mt-0.5">{proj.system_size_kwp ? `${proj.system_size_kwp} kW` : "N/A"}</span>
                                </div>
                                <div>
                                  <span className="text-graphite block">Assignee</span>
                                  <span className="text-forest-ink font-bold block mt-0.5 truncate max-w-[70px]">{proj.project_assignee || "Unassigned"}</span>
                                </div>
                              </div>

                              {proj.project_due_date && (
                                <div className="flex items-center gap-1 text-[9px] font-mono text-graphite">
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>Due: {new Date(proj.project_due_date).toLocaleDateString("en-IN")}</span>
                                </div>
                              )}

                              {showReminder && (
                                <div
                                  className="p-2 rounded-lg border text-[9px] flex flex-col gap-0.5"
                                  style={{
                                    background: isOverdue ? "rgba(239, 68, 68, 0.08)" : "rgba(65, 225, 180, 0.08)",
                                    borderColor: isOverdue ? "rgba(239, 68, 68, 0.2)" : "rgba(65, 225, 180, 0.2)",
                                  }}
                                >
                                  <span className="font-semibold flex items-center gap-0.5 uppercase" style={{ color: isOverdue ? "#f87171" : "#41e1b4" }}>
                                    <Bell className="w-2.5 h-2.5" />
                                    Reminder
                                  </span>
                                  {proj.reminder_note && <span className="text-graphite truncate">"{proj.reminder_note}"</span>}
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </motion.main>

      {/* ==================================================== */}
      /* ============= LEADS DETAILED SLIDE DRAWER ========== */
      /* ==================================================== */
      {selectedLead && (
        <div
          className={`fixed inset-0 z-50 transition-opacity duration-300 flex justify-end ${
            drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          }`}
          style={{ background: "rgba(0, 0, 0, 0.6)", backdropFilter: "blur(4px)" }}
          onClick={() => setDrawerOpen(false)}
        >
          <div
            className={`w-full max-w-lg min-h-screen p-6 md:p-8 flex flex-col justify-between shadow-2xl transition-transform duration-300 overflow-y-auto ${
              drawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
            style={{ background: C.charcoal, borderLeft: `1px solid ${C.outlineVariant}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div className="space-y-4">
              <div className="flex justify-between items-start">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-forest-ink">Lead Details</span>
                  <h2 className="text-xl font-bold text-charcoal flex items-center gap-2" style={{  }}>
                    {selectedLead.homeowner_name}
                  </h2>
                </div>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1 rounded-full bg-neutral-100 text-graphite hover:text-charcoal transition-colors border-none outline-none cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Homeowner metadata */}
              <div className="p-4 rounded-xl space-y-2.5 border text-xs" style={{ background: C.background, borderColor: C.outlineVariant }}>
                <div className="flex items-center gap-2 text-neutral-700">
                  <Phone className="w-4 h-4 text-graphite" />
                  <span>+91 {selectedLead.homeowner_phone}</span>
                </div>
                {selectedLead.address && (
                  <div className="flex items-start gap-2 text-neutral-700 font-mono text-[10px]">
                    <span className="text-neutral-500 font-sans block shrink-0">Address:</span>
                    <span>{selectedLead.address}</span>
                  </div>
                )}
                {selectedLead.latitude && selectedLead.longitude && (
                  <div className="flex items-center gap-2 text-graphite text-[10px] font-mono">
                    <Globe className="w-3.5 h-3.5 text-graphite" />
                    <span>Coordinates: {selectedLead.latitude.toFixed(6)}, {selectedLead.longitude.toFixed(6)}</span>
                  </div>
                )}
              </div>

              {/* Gated Technical Metrics from Database */}
              <div className="space-y-2">
                <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-graphite">Technical Assessment Metrics</span>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl border space-y-1" style={{ background: C.background, borderColor: `${C.outlineVariant}30` }}>
                    <span className="text-[9px] font-mono text-graphite uppercase block">Total Roof Area</span>
                    <span className="text-charcoal font-bold text-sm">{selectedLead.total_roof_area_sqm ? `${selectedLead.total_roof_area_sqm} m²` : "N/A"}</span>
                  </div>
                  <div className="p-3 rounded-xl border space-y-1" style={{ background: C.background, borderColor: `${C.outlineVariant}30` }}>
                    <span className="text-[9px] font-mono text-graphite uppercase block">Usable Solar Area</span>
                    <span className="text-charcoal font-bold text-sm">{selectedLead.usable_roof_area_sqm ? `${selectedLead.usable_roof_area_sqm} m²` : "N/A"}</span>
                  </div>
                  <div className="p-3 rounded-xl border space-y-1" style={{ background: C.background, borderColor: `${C.outlineVariant}30` }}>
                    <span className="text-[9px] font-mono text-graphite uppercase block">Recommended System Size</span>
                    <span className="text-forest-ink font-bold text-sm">{selectedLead.system_size_kwp ? `${selectedLead.system_size_kwp} kWp` : "N/A"}</span>
                  </div>
                  <div className="p-3 rounded-xl border space-y-1" style={{ background: C.background, borderColor: `${C.outlineVariant}30` }}>
                    <span className="text-[9px] font-mono text-graphite uppercase block">Annual Production Yield</span>
                    <span className="text-charcoal font-bold text-sm">{selectedLead.annual_production_kwh ? `${selectedLead.annual_production_kwh.toLocaleString()} kWh` : "N/A"}</span>
                  </div>
                  <div className="p-3 rounded-xl border space-y-1" style={{ background: C.background, borderColor: `${C.outlineVariant}30` }}>
                    <span className="text-[9px] font-mono text-graphite uppercase block">Turnkey Installation Cost</span>
                    <span className="text-charcoal font-bold text-sm">{selectedLead.capex_estimate ? `₹${selectedLead.capex_estimate.toLocaleString()}` : "N/A"}</span>
                  </div>
                  <div className="p-3 rounded-xl border space-y-1" style={{ background: C.background, borderColor: `${C.outlineVariant}30` }}>
                    <span className="text-[9px] font-mono text-graphite uppercase block">Govt. Subsidy Slab</span>
                    <span className="text-forest-ink font-bold text-sm">{selectedLead.pm_surya_subsidy ? `₹${selectedLead.pm_surya_subsidy.toLocaleString()}` : "N/A"}</span>
                  </div>
                  <div className="p-3 rounded-xl border col-span-2 space-y-1" style={{ background: C.background, borderColor: `${C.outlineVariant}30` }}>
                    <span className="text-[9px] font-mono text-graphite uppercase block">Net Out-of-pocket CapEx</span>
                    <span className="text-charcoal font-bold text-sm">
                      {selectedLead.capex_estimate && selectedLead.pm_surya_subsidy
                        ? `₹${(selectedLead.capex_estimate - selectedLead.pm_surya_subsidy).toLocaleString()}`
                        : "N/A"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Data Confidence parameters */}
              {selectedLead.confidence_level && (
                <div className="p-3.5 rounded-xl border space-y-1" style={{
                  background: selectedLead.confidence_level === "High" ? "rgba(52, 211, 153, 0.05)" : selectedLead.confidence_level === "Medium" ? "rgba(245, 158, 11, 0.05)" : "rgba(239, 68, 68, 0.05)",
                  borderColor: selectedLead.confidence_level === "High" ? "rgba(52, 211, 153, 0.2)" : selectedLead.confidence_level === "Medium" ? "rgba(245, 158, 11, 0.2)" : "rgba(239, 68, 68, 0.2)"
                }}>
                  <span className="text-[9px] font-bold font-mono uppercase tracking-wider flex items-center gap-1.5" style={{
                    color: selectedLead.confidence_level === "High" ? "#34d399" : selectedLead.confidence_level === "Medium" ? "#f59e0b" : "#f87171"
                  }}>
                    <Sparkles className="w-3.5 h-3.5 animate-pulse" />
                    Scan Accuracy: {selectedLead.confidence_level} Confidence
                  </span>
                  {selectedLead.confidence_reason && (
                    <span className="text-[10px] text-graphite leading-normal block italic mt-1 font-mono">
                      "{selectedLead.confidence_reason}"
                    </span>
                  )}
                </div>
              )}

              {/* CRM Lead Status Dropdown Selector */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold font-mono uppercase tracking-wider text-graphite">Update Lead Pipeline Stage</label>
                <select
                  value={selectedLead.assignment_status}
                  onChange={(e) => handleUpdateCrmStatus(selectedLead.assignment_id, e.target.value)}
                  className="w-full bg-linen-white border rounded-lg px-3 py-2 text-xs text-charcoal outline-none focus:ring-1 focus:ring-forest-ink font-mono"
                  style={{ borderColor: C.outlineVariant }}
                >
                  <option value="delivered">New Lead</option>
                  <option value="contacted">Contacted</option>
                  <option value="site_visit">Site Visit Scheduled</option>
                  <option value="quoted">Quoted Proposal</option>
                  <option value="won">Won Deal (Promote)</option>
                  <option value="lost">Lost Deal</option>
                </select>
              </div>

              {/* Set Reminder Inside Lead Drawer */}
              <div className="bg-linen-white/40 rounded-xl p-4 space-y-3 border border-hairline-gray">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold font-mono uppercase tracking-wider text-graphite">Set Follow-up Reminder</span>
                  {selectedLead.reminder_date && (
                    <span className="text-[9px] font-mono text-forest-ink font-bold uppercase">Reminder Active</span>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase text-graphite">Reminder Date</label>
                    <input
                      type="date"
                      value={activeReminderEdit === selectedLead.assignment_id ? reminderDate : (selectedLead.reminder_date ? selectedLead.reminder_date.substring(0,10) : "")}
                      onChange={(e) => {
                        setActiveReminderEdit(selectedLead.assignment_id);
                        setReminderDate(e.target.value);
                      }}
                      className="w-full bg-linen-white border border-hairline-gray rounded px-2.5 py-1.5 text-[10px] text-charcoal"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-mono uppercase text-graphite">Short Note</label>
                    <input
                      type="text"
                      placeholder="e.g. Call at 5 PM"
                      value={activeReminderEdit === selectedLead.assignment_id ? reminderNote : (selectedLead.reminder_note || "")}
                      onChange={(e) => {
                        setActiveReminderEdit(selectedLead.assignment_id);
                        setReminderNote(e.target.value);
                      }}
                      className="w-full bg-linen-white border border-hairline-gray rounded px-2.5 py-1.5 text-[10px] text-charcoal"
                    />
                  </div>
                </div>
                {activeReminderEdit === selectedLead.assignment_id && (
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      onClick={() => {
                        setReminderDate("");
                        setReminderNote("");
                        handleSaveReminder(selectedLead.assignment_id);
                      }}
                      className="px-2.5 py-1 text-[8px] uppercase font-bold text-[#c53030] hover:underline border-none bg-transparent"
                    >
                      Clear
                    </button>
                    <button
                      onClick={() => handleSaveReminder(selectedLead.assignment_id)}
                      className="px-3 py-1 text-[8px] uppercase font-bold rounded"
                      style={{ background: C.secondary, color: "#fffefc" }}
                    >
                      Apply
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons in Drawer */}
            <div className="space-y-3 pt-6 border-t mt-6" style={{ borderColor: `${C.outlineVariant}30` }}>
              <button
                onClick={() => handleDownloadProposal(selectedLead)}
                style={{ background: `${C.primary}15`, border: `1px solid ${C.primary}`, color: C.primary }}
                className="w-full py-3 text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity font-mono cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" /> Download Homeowner Proposal PDF
              </button>

              {/* Promotion button */}
              {selectedLead.project_stage === null ? (
                <button
                  onClick={() => handleConvertLeadToProject(selectedLead.assignment_id)}
                  style={{ background: C.secondary, color: "#fffefc" }}
                  className="w-full py-3 text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-90 transition-opacity font-mono cursor-pointer flex items-center justify-center gap-2 border-none outline-none"
                >
                  <UserCheck className="w-4 h-4" /> Convert to Active Project
                </button>
              ) : (
                <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-center text-xs text-forest-ink font-mono">
                  ✓ Active Project in stage: <strong className="uppercase">{selectedLead.project_stage}</strong>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================== */}
      /* ============= KANBAN PROJECT DETAILS MODAL ========= */
      /* ==================================================== */
      {selectedProject && projectModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setProjectModalOpen(false)}
        >
          <div
            className="w-full max-w-md p-6 rounded-2xl border space-y-4 shadow-2xl relative"
            style={{ background: C.charcoal, borderColor: C.outlineVariant }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setProjectModalOpen(false)}
              className="absolute top-4 right-4 p-1 rounded-full bg-neutral-100 text-graphite hover:text-charcoal transition-colors border-none outline-none cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="space-y-1">
              <span className="text-[10px] font-bold font-mono uppercase tracking-widest text-secondary">Project Management</span>
              <h2 className="text-lg font-bold text-charcoal tracking-tight" style={{  }}>
                {selectedProject.homeowner_name}
              </h2>
            </div>

            <form onSubmit={handleSaveProjectDetails} className="space-y-4 pt-2">
              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-graphite">Project Stage</label>
                <select
                  value={selectedProject.project_stage || "lead"}
                  onChange={(e) => {
                    const newStage = e.target.value;
                    setSelectedProject({ ...selectedProject, project_stage: newStage as any });
                    onProjectDrop(null as any, newStage);
                  }}
                  className="w-full bg-linen-white border rounded-lg px-3 py-2 text-xs text-charcoal outline-none focus:ring-1 focus:ring-forest-ink font-mono"
                  style={{ borderColor: C.outlineVariant }}
                >
                  {KANBAN_PROJECT_STAGES.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-graphite">Assigned Engineer</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Kumar"
                  value={projectAssignee}
                  onChange={(e) => setProjectAssignee(e.target.value)}
                  style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-graphite">Target Commission Date</label>
                <input
                  type="date"
                  value={projectDueDate}
                  onChange={(e) => setProjectDueDate(e.target.value)}
                  style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-mono uppercase tracking-wider text-graphite">Project Progress Notes</label>
                <textarea
                  placeholder="Notes about site audit status, CAD engineering drawings, or MNRE subsidy clearances..."
                  value={projectNotes}
                  onChange={(e) => setProjectNotes(e.target.value)}
                  style={{ background: C.background, borderColor: C.outlineVariant, color: C.onSurface }}
                  className="w-full px-3 py-2 text-xs rounded-lg border focus:outline-none focus:border-forest-ink min-h-[80px]"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setProjectModalOpen(false)}
                  className="px-4 py-2 text-xs border font-mono font-bold uppercase rounded-lg hover:bg-neutral-100 cursor-pointer bg-transparent"
                  style={{ borderColor: C.outlineVariant, color: C.onSurface }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-mono font-bold uppercase rounded-lg hover:opacity-90 cursor-pointer border-none outline-none"
                  style={{ background: C.secondary, color: "#fffefc" }}
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <footer className="mt-20 py-8 text-center border-t text-xs font-mono" style={{ borderColor: C.outlineVariant, color: C.mutedSand }}>
        <div className="max-w-[1280px] mx-auto px-4 md:px-16">
          <span>© {new Date().getFullYear()} SUNPOWER LINK Installer Portal. All Rights Reserved.</span>
        </div>
      </footer>

      <PricingModal
        open={pricingOpen}
        onClose={() => setPricingOpen(false)}
        currentTier={profile?.subscription_tier}
        busy={subscribing}
        onSubscribe={handleSubscribe}
      />
    </div>
  );
}
