import { useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Upload, Camera, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-sunpower-accent" />
            Estimate roof area from a photo
          </DialogTitle>
          <DialogDescription>
            Upload a top-down or aerial photo of the roof. We'll segment the image and estimate the area — no drawing needed.
          </DialogDescription>
        </DialogHeader>

        {/* Rough house size slider for calibration */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-sunpower-text-muted mb-1">
            <span>Approx. house floor size</span>
            <span className="font-mono">{houseSizeHint} m²</span>
          </div>
          <input
            type="range" min={40} max={400} step={10} value={houseSizeHint}
            onChange={(e) => setHouseSizeHint(parseInt(e.target.value))}
            className="w-full accent-sunpower-accent"
            aria-label="House size hint"
          />
          <div className="flex justify-between text-[10px] text-sunpower-text-muted mt-0.5">
            <span>Small (40)</span><span>Typical (120)</span><span>Large (400)</span>
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
              className="w-full border-2 border-dashed border-foreground/[0.15] rounded-xl py-8 px-4 flex flex-col items-center gap-2 hover:border-sunpower-accent hover:bg-sunpower-accent/5 transition-all disabled:opacity-60"
            >
              {loading ? (
                <><Loader2 className="w-6 h-6 animate-spin text-sunpower-accent" />
                  <span className="text-sm text-sunpower-text-secondary">Analyzing photo…</span></>
              ) : (
                <><Upload className="w-6 h-6 text-sunpower-accent" />
                  <span className="text-sm font-medium text-sunpower-text-primary">Tap to upload or take photo</span>
                  <span className="text-xs text-sunpower-text-muted">JPEG · PNG · HEIC — top-down view works best</span></>
              )}
            </button>
          </div>
        )}

        {error && !loading && (
          <div className="mt-3 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {result && (
          <div className="mt-4 space-y-3">
            <img
              src={result.overlayDataUrl}
              alt="Detected roof highlighted"
              className="w-full rounded-xl border border-foreground/[0.1]"
            />
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-foreground/[0.03] p-2.5 text-center">
                <div className="text-[10px] text-sunpower-text-muted">Area</div>
                <div className="font-mono text-lg font-semibold text-sunpower-accent">{result.areaM2} m²</div>
              </div>
              <div className="rounded-lg bg-foreground/[0.03] p-2.5 text-center">
                <div className="text-[10px] text-sunpower-text-muted">Confidence</div>
                <div className="font-mono text-lg font-semibold text-sunpower-text-primary">{Math.round(result.confidence * 100)}%</div>
              </div>
              <div className="rounded-lg bg-foreground/[0.03] p-2.5 text-center">
                <div className="text-[10px] text-sunpower-text-muted">Method</div>
                <div className="text-[11px] font-medium text-sunpower-text-primary mt-1 truncate">{result.source === "hf-segformer" ? "AI segmentation" : "Client CV"}</div>
              </div>
            </div>
            {result.confidence < 0.6 && (
              <div className="text-xs text-amber-600 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Low confidence. A clearer top-down photo will improve accuracy.
              </div>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" className="flex-1" onClick={() => { setResult(null); setError(null); }}>
                Try another photo
              </Button>
              <Button variant="cta" className="flex-1" onClick={accept}>
                <CheckCircle2 className="w-4 h-4 mr-1" /> Use this estimate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotoRoofEstimator;
