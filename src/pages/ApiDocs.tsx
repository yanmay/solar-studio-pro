import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import {
  Sparkles,
  BookOpen,
  Terminal,
  Code,
  Download,
  Copy,
  CheckCircle,
  Play,
  Layers,
  ArrowLeftRight,
  Shield,
  Coins,
  ArrowLeft,
  Zap,
} from "lucide-react";

export default function ApiDocs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [apiKeyInput, setApiKeyInput] = useState("sk_test_underwrite_demo_key");
  const [selectedLang, setSelectedLang] = useState<"curl" | "js" | "python">("curl");
  const [activeRoute, setActiveRoute] = useState<"estimate" | "roof" | "subsidy">("estimate");

  // Try it out states
  const [estimateQuery, setEstimateQuery] = useState({ lat: "19.076", lng: "72.877", area: "100", rate: "8" });
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to Clipboard", description: "Code snippet copied." });
  };

  const handleTryItOut = async () => {
    setLoading(true);
    setApiResponse(null);
    try {
      let url = "";
      let method = "GET";
      let body: any = null;

      if (activeRoute === "estimate") {
        url = `/api/v1/solar-estimate?lat=${estimateQuery.lat}&lng=${estimateQuery.lng}&roofAreaM2=${estimateQuery.area}&electricityRate=${estimateQuery.rate}`;
      } else if (activeRoute === "subsidy") {
        url = `/api/v1/subsidy-check?state=Maharashtra&systemSizeKw=3.5`;
      } else {
        url = `/api/v1/validate-roof`;
        method = "POST";
        body = JSON.stringify({ imageBase64: "data:image/png;base64,iVBORw0KGgoAAA..." });
      }

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": apiKeyInput,
        },
        body
      });
      const data = await res.json();
      setApiResponse(data);
    } catch (e) {
      setApiResponse({ error: "Failed to dispatch request to endpoint." });
    } finally {
      setLoading(false);
    }
  };

  const downloadPostman = () => {
    const postman = {
      info: {
        name: "SUNPOWER LINK Underwriting API v1",
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
      },
      item: [
        {
          name: "Solar Loan Estimate",
          request: {
            method: "GET",
            header: [{ key: "X-API-Key", value: "{{apiKey}}" }],
            url: { raw: "https://api.sunpowerlink.in/api/v1/solar-estimate?lat=19.076&lng=72.877&roofAreaM2=100&electricityRate=8" }
          }
        }
      ]
    };
    const blob = new Blob([JSON.stringify(postman, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "sunpower-underwriting-collection.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast({ title: "Postman Collection Downloaded" });
  };

  const getCodeSnippet = () => {
    if (activeRoute === "estimate") {
      if (selectedLang === "curl") {
        return `curl -X GET "https://api.sunpowerlink.in/api/v1/solar-estimate?lat=${estimateQuery.lat}&lng=${estimateQuery.lng}&roofAreaM2=${estimateQuery.area}&electricityRate=${estimateQuery.rate}" \\\n  -H "X-API-Key: ${apiKeyInput}"`;
      }
      if (selectedLang === "js") {
        return `fetch("https://api.sunpowerlink.in/api/v1/solar-estimate?lat=${estimateQuery.lat}&lng=${estimateQuery.lng}&roofAreaM2=${estimateQuery.area}&electricityRate=${estimateQuery.rate}", {\n  headers: { "X-API-Key": "${apiKeyInput}" }\n})\n.then(res => res.json())\n.then(console.log);`;
      }
      return `import requests\n\nheaders = { "X-API-Key": "${apiKeyInput}" }\nresponse = requests.get(\n  "https://api.sunpowerlink.in/api/v1/solar-estimate",\n  params={"lat": "${estimateQuery.lat}", "lng": "${estimateQuery.lng}", "roofAreaM2": "${estimateQuery.area}", "electricityRate": "${estimateQuery.rate}"},\n  headers=headers\n)\nprint(response.json())`;
    }
    if (activeRoute === "subsidy") {
      if (selectedLang === "curl") {
        return `curl -X GET "https://api.sunpowerlink.in/api/v1/subsidy-check?state=Maharashtra&systemSizeKw=3.5" \\\n  -H "X-API-Key: ${apiKeyInput}"`;
      }
      if (selectedLang === "js") {
        return `fetch("https://api.sunpowerlink.in/api/v1/subsidy-check?state=Maharashtra&systemSizeKw=3.5", {\n  headers: { "X-API-Key": "${apiKeyInput}" }\n})\n.then(res => res.json())\n.then(console.log);`;
      }
      return `import requests\n\nheaders = { "X-API-Key": "${apiKeyInput}" }\nresponse = requests.get(\n  "https://api.sunpowerlink.in/api/v1/subsidy-check",\n  params={"state": "Maharashtra", "systemSizeKw": "3.5"},\n  headers=headers\n)\nprint(response.json())`;
    }
    // validate-roof POST
    if (selectedLang === "curl") {
      return `curl -X POST "https://api.sunpowerlink.in/api/v1/validate-roof" \\\n  -H "X-API-Key: ${apiKeyInput}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"imageBase64": "data:image/png;base64,..."}'`;
    }
    if (selectedLang === "js") {
      return `fetch("https://api.sunpowerlink.in/api/v1/validate-roof", {\n  method: "POST",\n  headers: {\n    "Content-Type": "application/json",\n    "X-API-Key": "${apiKeyInput}"\n  },\n  body: JSON.stringify({ imageBase64: "data:image/png;base64,..." })\n})\n.then(res => res.json())\n.then(console.log);`;
    }
    return `import requests\n\nheaders = {\n  "X-API-Key": "${apiKeyInput}",\n  "Content-Type": "application/json"\n}\npayload = { "imageBase64": "data:image/png;base64,..." }\nresponse = requests.post(\n  "https://api.sunpowerlink.in/api/v1/validate-roof",\n  json=payload,\n  headers=headers\n)\nprint(response.json())`;
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans antialiased relative overflow-x-hidden selection:bg-[#FF6600]/30 selection:text-white pb-20">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] right-[-5%] w-[600px] h-[600px] rounded-full bg-[#FF6600]/5 blur-[140px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-2xl bg-[#050505]/85 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 md:px-12 h-16 flex justify-between items-center">
          <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="flex items-center gap-3 group">
            <img src="/logo.png" alt="SUNPOWER LINK Logo" className="w-8 h-8 object-contain transition-transform duration-200 group-hover:scale-105" />
            <span className="text-[15px] font-bold text-white tracking-tight">
              SUNPOWER <span className="font-serif italic font-light text-[#FF6600]">LINK</span> <span className="font-mono text-xs text-white/40 font-normal">/ DEVELOPERS</span>
            </span>
          </a>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white/60 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl border border-white/10 transition-all active:scale-95 cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Back
            </button>
            <button
              onClick={downloadPostman}
              className="bg-[#FF6600] hover:bg-orange-500 text-black text-xs font-bold font-mono py-2 px-4 rounded-xl flex items-center gap-2 cursor-pointer transition-all active:scale-95 shadow-lg shadow-[#FF6600]/20 border-none"
            >
              <Download className="w-3.5 h-3.5 stroke-[2.5]" /> Postman Spec
            </button>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div className="max-w-6xl mx-auto py-10 px-4 md:px-12 grid grid-cols-1 lg:grid-cols-3 gap-8 relative z-10">
        
        {/* Left Side: Overview & Pricing Plans */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#FF6600] font-mono flex items-center gap-2">
              <Shield className="w-4 h-4" /> API Authentication
            </h2>
            <p className="text-xs text-white/50 leading-relaxed">
              Include the following request header with every underwriting dispatch query.
            </p>
            <div className="space-y-1.5">
              <label className="block text-[10px] font-mono uppercase tracking-wider text-white/40">X-API-Key Header</label>
              <input
                type="text"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                className="w-full text-xs font-mono border border-white/10 rounded-xl p-3 bg-white/[0.04] text-white focus:outline-none focus:border-[#FF6600]/60 focus:ring-2 focus:ring-[#FF6600]/20 transition-all"
              />
            </div>
            <span className="text-[10px] text-white/40 font-mono block">
              Rate Limit: 100 requests/minute per key.
            </span>
          </div>

          <div className="bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-4">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#FF6600] font-mono flex items-center gap-2">
              <Coins className="w-4 h-4" /> Developer API Tiers
            </h2>
            <div className="space-y-4">
              <div className="border-b border-white/5 pb-3">
                <div className="flex justify-between items-center text-xs mb-0.5">
                  <span className="font-bold text-white">Free Sandbox</span>
                  <span className="font-mono text-emerald-400 font-bold">₹0</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">100 scans/month · Standard rate limit</span>
              </div>
              <div className="border-b border-white/5 pb-3">
                <div className="flex justify-between items-center text-xs mb-0.5">
                  <span className="font-bold text-white">Pro Underwriter</span>
                  <span className="font-mono text-[#FF6600] font-bold">₹10,000/mo</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">10,000 scans/month · Dedicated throughput</span>
              </div>
              <div>
                <div className="flex justify-between items-center text-xs mb-0.5">
                  <span className="font-bold text-white">Enterprise API</span>
                  <span className="font-mono text-white/60 font-bold">Custom</span>
                </div>
                <span className="text-[10px] text-white/40 font-mono">Unlimited capacity · Custom SLA</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Side: Swagger Console & Try it out */}
        <div className="lg:col-span-2 space-y-6">
          {/* Endpoint tab selectors */}
          <div className="flex border-b border-white/10 gap-3">
            {[
              { id: "estimate", label: "GET /solar-estimate" },
              { id: "roof", label: "POST /validate-roof" },
              { id: "subsidy", label: "GET /subsidy-check" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveRoute(tab.id as any)}
                className={`pb-3 text-xs font-bold font-mono transition-all border-b-2 cursor-pointer ${
                  activeRoute === tab.id
                    ? "border-[#FF6600] text-[#FF6600]"
                    : "border-transparent text-white/40 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Try it out Form parameters */}
          {activeRoute === "estimate" && (
            <div className="bg-[#0A0A0A]/90 border border-white/10 backdrop-blur-2xl rounded-3xl p-6 shadow-2xl space-y-4">
              <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#FF6600]">
                Query Parameters
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { key: "lat", label: "Latitude", val: estimateQuery.lat },
                  { key: "lng", label: "Longitude", val: estimateQuery.lng },
                  { key: "area", label: "Roof Area (m²)", val: estimateQuery.area },
                  { key: "rate", label: "Tariff Rate (₹/kWh)", val: estimateQuery.rate },
                ].map((item) => (
                  <div key={item.key} className="space-y-1">
                    <label className="text-[10px] font-mono uppercase tracking-wider text-white/40">{item.label}</label>
                    <input
                      type="text"
                      value={item.val}
                      onChange={(e) => setEstimateQuery({ ...estimateQuery, [item.key]: e.target.value })}
                      className="w-full text-xs font-mono border border-white/10 rounded-xl p-2.5 bg-white/[0.04] text-white focus:outline-none focus:border-[#FF6600]/60"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Language selector & Code display block */}
          <div className="bg-[#0A0A0A]/90 rounded-3xl overflow-hidden border border-white/10 text-white space-y-3 p-5 shadow-2xl">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex gap-2">
                {[
                  { id: "curl", label: "cURL" },
                  { id: "js", label: "JavaScript" },
                  { id: "python", label: "Python" },
                ].map((lang) => (
                  <button
                    key={lang.id}
                    onClick={() => setSelectedLang(lang.id as "curl" | "js" | "python")}
                    className={`text-xs font-mono font-bold px-3 py-1.5 rounded-xl cursor-pointer transition-all ${
                      selectedLang === lang.id ? "bg-[#FF6600] text-black" : "bg-white/5 text-white/60 hover:text-white"
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
              <button
                onClick={() => handleCopy(getCodeSnippet())}
                className="text-white/60 hover:text-white flex items-center gap-1.5 text-xs font-mono cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-[#FF6600]" /> Copy
              </button>
            </div>

            <pre className="text-xs font-mono overflow-x-auto select-all max-h-48 whitespace-pre text-white/80 p-2 leading-relaxed">
              {getCodeSnippet()}
            </pre>
          </div>

          {/* Try it out & Live Console outputs */}
          <div className="space-y-4">
            <button
              onClick={handleTryItOut}
              disabled={loading}
              className="bg-[#FF6600] hover:bg-orange-500 text-black font-mono text-xs font-bold py-3.5 px-6 rounded-2xl w-full flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.98] shadow-lg shadow-[#FF6600]/20 border-none"
            >
              <Play className="w-4 h-4 fill-current" />
              {loading ? "Executing Query..." : "Execute Query (Try It Out)"}
            </button>

            {apiResponse && (
              <div className="bg-[#0A0A0A] rounded-3xl p-6 border border-white/10 text-emerald-400 font-mono space-y-3 shadow-2xl">
                <span className="text-[10px] text-white/40 block border-b border-white/10 pb-2 uppercase tracking-wider font-mono">
                  Response Payload (JSON 200 OK)
                </span>
                <pre className="text-xs overflow-x-auto select-all max-h-64 whitespace-pre text-emerald-400">
                  {JSON.stringify(apiResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
