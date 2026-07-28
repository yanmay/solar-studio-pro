import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Camera, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { estimateRoofFromPhoto, type RoofPhotoResult } from "@/lib/roof-from-photo";
import { track } from "@/lib/analytics";

interface Props {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  /** Called with the detected area when user accepts the estimate. */
  onAccept: (areaM2: number, panelCountHint: number) => void;
}

const PhotoRoofEstimator = ({ open, onOpenChange, onAccept }: Props) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RoofPhotoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [houseSizeHint, setHouseSizeHint] = useState(120); // m²

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null); setResult(null); setLoading(true);
    track("Photo Roof Upload", { sizeKB: Math.round(f.size / 1024) });
    try {
      const r = await estimateRoofFromPhoto(f, houseSizeHint);
      setResult(r);
      track("Photo Roof Estimated", { m2: r.areaM2, source: r.source });
    } catch (err) {
      setError((err as Error).message || "Couldn't process the photo.");
    } finally {
      setLoading(false);
    }
  };

  const accept = () => {
    if (!result) return;
    const panelCountHint = Math.max(1, Math.floor((result.areaM2 * 0.75) / 2));
    onAccept(result.areaM2, panelCountHint);
    onOpenChange(false);
    // Reset for next open
    setTimeout(() => { setResult(null); setError(null); }, 250);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl text-white p-6 sm:p-8 backdrop-blur-2xl shadow-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 text-lg font-bold text-white">
            <div className="w-8 h-8 rounded-xl bg-[#FF6600]/10 border border-[#FF6600]/20 text-[#FF6600] flex items-center justify-center">
              <Camera className="w-4 h-4" />
            </div>
            <span>Estimate Roof From Photo</span>
          </DialogTitle>
          <DialogDescription className="text-xs text-white/50 leading-relaxed mt-1 font-light">
            Upload a top-down aerial or drone photo of the roof. We'll automatically segment the building footprint and calculate solar surface area.
          </DialogDescription>
        </DialogHeader>

        {/* House size slider for calibration */}
        <div className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/10 space-y-2">
          <div className="flex justify-between text-xs text-white/60">
            <span className="text-[10px] font-mono uppercase tracking-wider text-white/40">Floor Footprint Hint</span>
            <span className="font-mono text-[#FF6600] font-bold">{houseSizeHint} m²</span>
          </div>
          <input
            type="range" min={40} max={400} step={10} value={houseSizeHint}
            onChange={(e) => setHouseSizeHint(parseInt(e.target.value))}
            className="w-full accent-[#FF6600] bg-white/10 h-2 rounded-lg cursor-pointer"
            aria-label="House size hint"
          />
          <div className="flex justify-between text-[9px] font-mono text-white/40 pt-1">
            <span>Small (40 m²)</span><span>Typical (120 m²)</span><span>Large (400 m²)</span>
          </div>
        </div>

        {!result && (
          <div className="mt-4">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={onFile}
              className="hidden"
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={loading}
              className="w-full border-2 border-dashed border-white/15 rounded-2xl py-8 px-4 flex flex-col items-center gap-2 hover:border-[#FF6600]/50 hover:bg-[#FF6600]/5 transition-all duration-200 disabled:opacity-60 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="w-6 h-6 animate-spin text-[#FF6600]" />
                  <span className="text-xs font-mono text-white/70">Analyzing roof geometry & pitch…</span>
                </>
              ) : (
                <>
                  <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-[#FF6600] mb-1">
                    <Upload className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-bold text-white">Tap to upload aerial or satellite photo</span>
                  <span className="text-[10px] font-mono text-white/40">JPEG · PNG · HEIC — top-down satellite view recommended</span>
                </>
              )}
            </button>
          </div>
        )}

        {error && !loading && (
          <div className="mt-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-2xl text-xs text-red-400 flex items-start gap-2.5 font-mono">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-4">
            <img
              src={result.overlayDataUrl}
              alt="Detected roof highlighted"
              className="w-full rounded-2xl border border-white/15 object-cover max-h-48 shadow-2xl"
            />
            <div className="grid grid-cols-3 gap-2.5 font-mono">
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-center">
                <div className="text-[9px] uppercase tracking-wider text-white/40">Area</div>
                <div className="text-base font-bold text-[#FF6600] mt-0.5">{result.areaM2} m²</div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-center">
                <div className="text-[9px] uppercase tracking-wider text-white/40">Confidence</div>
                <div className="text-base font-bold text-emerald-400 mt-0.5">{Math.round(result.confidence * 100)}%</div>
              </div>
              <div className="rounded-2xl bg-white/[0.03] border border-white/10 p-3 text-center">
                <div className="text-[9px] uppercase tracking-wider text-white/40">Method</div>
                <div className="text-[10px] font-bold text-white mt-1 truncate">{result.source === "hf-segformer" ? "AI Model" : "Computer Vision"}</div>
              </div>
            </div>
            {result.confidence < 0.6 && (
              <div className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 p-3 rounded-xl flex items-start gap-2 font-mono">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                <span>Low confidence. A clearer top-down photo will improve accuracy.</span>
              </div>
            )}
            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => { setResult(null); setError(null); }}
                className="flex-1 py-3 px-4 rounded-xl border border-white/10 text-xs font-mono text-white/60 hover:text-white hover:bg-white/5 transition-all cursor-pointer bg-transparent"
              >
                Try Another Photo
              </button>
              <button
                onClick={accept}
                className="flex-1 py-3 px-4 rounded-xl bg-[#FF6600] hover:bg-orange-500 text-black text-xs font-bold font-mono uppercase tracking-wider transition-all cursor-pointer border-none shadow-lg shadow-[#FF6600]/20 flex items-center justify-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" /> Use Estimate
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoRoofEstimator;

