import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";

interface StateIconProps {
  size?: number;
  color?: string;
  className?: string;
  duration?: number;
}

function useAutoToggle(interval: number) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setOn((v) => !v), interval);
    return () => clearInterval(id);
  }, [interval]);
  return on;
}

/* ─── 1. LOADING → SUCCESS ─── spinner morphs into checkmark */
export function SuccessIcon({ size = 40, color = "currentColor", className, duration = 2200 }: StateIconProps) {
  const done = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.circle cx="20" cy="20" r="16" stroke={color} strokeWidth={2}
        animate={done ? { pathLength: 1, opacity: 1 } : { pathLength: 0.7, opacity: 0.4 }}
        transition={{ duration: 0.5 }}
      />
      {!done && (
        <motion.circle cx="20" cy="20" r="16" stroke={color} strokeWidth={2}
          strokeLinecap="round" strokeDasharray="25 75"
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{ transformOrigin: "20px 20px" }}
        />
      )}
      <motion.path d="M12 20l6 6 10-12" stroke={color} strokeWidth={2.5}
        strokeLinecap="round" strokeLinejoin="round"
        animate={done ? { pathLength: 1, opacity: 1 } : { pathLength: 0, opacity: 0 }}
        transition={{ duration: 0.4, delay: done ? 0.2 : 0 }}
      />
    </svg>
  );
}

/* ─── 2. MENU → CLOSE ─── hamburger morphs to X */
export function MenuCloseIcon({ size = 40, color = "currentColor", className, duration = 2000 }: StateIconProps) {
  const open = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.line x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={open ? { y1: 20, y2: 20, rotate: 45 } : { y1: 12, y2: 12, rotate: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: "20px 20px" }}
      />
      <motion.line x1="10" y1="20" x2="30" y2="20" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={open ? { opacity: 0, scaleX: 0 } : { opacity: 1, scaleX: 1 }}
        transition={{ duration: 0.2 }}
        style={{ transformOrigin: "20px 20px" }}
      />
      <motion.line x1="10" x2="30" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={open ? { y1: 20, y2: 20, rotate: -45 } : { y1: 28, y2: 28, rotate: 0 }}
        transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: "20px 20px" }}
      />
    </svg>
  );
}

/* ─── 3. PLAY → PAUSE ─── */
export function PlayPauseIcon({ size = 40, color = "currentColor", className, duration = 2400 }: StateIconProps) {
  const playing = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <AnimatePresence mode="wait">
        {playing ? (
          <motion.g key="pause"
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.25 }} style={{ transformOrigin: "20px 20px" }}>
            <rect x="12" y="10" width="5" height="20" rx="1.5" fill={color} />
            <rect x="23" y="10" width="5" height="20" rx="1.5" fill={color} />
          </motion.g>
        ) : (
          <motion.g key="play"
            initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}
            transition={{ duration: 0.25 }} style={{ transformOrigin: "20px 20px" }}>
            <polygon points="14,10 30,20 14,30" fill={color} />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ─── 4. LOCK → UNLOCK ─── shackle lifts */
export function LockUnlockIcon({ size = 40, color = "currentColor", className, duration = 2600 }: StateIconProps) {
  const unlocked = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <rect x="9" y="18" width="22" height="16" rx="3" stroke={color} strokeWidth={2} />
      <motion.path d="M14 18V13a6 6 0 0112 0v5" stroke={color} strokeWidth={2} strokeLinecap="round"
        animate={unlocked ? { d: "M14 18V13a6 6 0 0112 0v2" } : { d: "M14 18V13a6 6 0 0112 0v5" }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      />
      <motion.circle cx="20" cy="26" r="2" fill={color}
        animate={unlocked ? { scale: 0.6, opacity: 0.4 } : { scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  );
}

/* ─── 5. COPY → COPIED ─── clipboard with checkmark flash */
export function CopiedIcon({ size = 40, color = "currentColor", className, duration = 2200 }: StateIconProps) {
  const copied = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <rect x="12" y="10" width="18" height="22" rx="2" stroke={color} strokeWidth={2} />
      <path d="M10 14h-0a2 2 0 00-2 2v18a2 2 0 002 2h14" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.3} />
      <AnimatePresence mode="wait">
        {copied ? (
          <motion.path key="check" d="M16 21l4 4 6-8" stroke={color} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0 }}
            transition={{ duration: 0.3 }}
          />
        ) : (
          <motion.g key="lines" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <line x1="17" y1="18" x2="25" y2="18" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
            <line x1="17" y1="23" x2="25" y2="23" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
            <line x1="17" y1="28" x2="22" y2="28" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ─── 6. BELL → NOTIFICATION ─── bell rings then dot appears */
export function NotificationIcon({ size = 40, color = "currentColor", className, duration = 2800 }: StateIconProps) {
  const notif = useAutoToggle(duration);
  return (
    <motion.svg viewBox="0 0 40 40" fill="none" className={cn("", className)}
      animate={notif ? { rotate: [0, 8, -8, 6, -6, 3, 0] } : { rotate: 0 }}
      transition={{ duration: 0.6 }}
      style={{ width: size, height: size, transformOrigin: "20px 6px" }}>
      <path d="M28 16a8 8 0 00-16 0c0 8-4 10-4 10h24s-4-2-4-10" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17.5 30a3 3 0 005 0" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <motion.circle cx="28" cy="10" r="4" fill="#EF4444"
        animate={notif ? { scale: [0, 1.3, 1], opacity: 1 } : { scale: 0, opacity: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      />
    </motion.svg>
  );
}

/* ─── 7. HEART → FILLED ─── heart fills with bounce */
export function HeartIcon({ size = 40, color = "currentColor", className, duration = 2000 }: StateIconProps) {
  const filled = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path
        d="M20 34s-12-7.5-12-16a7.5 7.5 0 0112-6 7.5 7.5 0 0112 6c0 8.5-12 16-12 16z"
        stroke={filled ? "#EF4444" : color} strokeWidth={2} fill={filled ? "#EF4444" : "none"}
        animate={filled ? { scale: [1, 1.25, 1] } : { scale: 1 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
        style={{ transformOrigin: "20px 22px" }}
      />
    </svg>
  );
}

/* ─── 8. DOWNLOAD → DONE ─── arrow drops into tray then checks */
export function DownloadDoneIcon({ size = 40, color = "currentColor", className, duration = 2400 }: StateIconProps) {
  const done = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M8 28v4a2 2 0 002 2h20a2 2 0 002-2v-4" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <AnimatePresence mode="wait">
        {done ? (
          <motion.path key="check" d="M14 22l6 6 8-10" stroke={color} strokeWidth={2.5}
            strokeLinecap="round" strokeLinejoin="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} exit={{ pathLength: 0, opacity: 0 }}
            transition={{ duration: 0.35 }}
          />
        ) : (
          <motion.g key="arrow"
            initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 8, opacity: 0 }}
            transition={{ duration: 0.35, ease: [0.32, 0.72, 0, 1] }}>
            <line x1="20" y1="6" x2="20" y2="24" stroke={color} strokeWidth={2} strokeLinecap="round" />
            <polyline points="14,18 20,24 26,18" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </motion.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* ─── 9. SEND ─── paper plane flies off then resets */
export function SendIcon({ size = 40, color = "currentColor", className, duration = 2600 }: StateIconProps) {
  const sent = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.g
        animate={sent ? { x: 30, y: -30, opacity: 0, scale: 0.5 } : { x: 0, y: 0, opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}>
        <path d="M34 6L16 20l-6-2L34 6z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <path d="M34 6L22 34l-6-14" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <line x1="16" y1="20" x2="22" y2="34" stroke={color} strokeWidth={2} />
      </motion.g>
    </svg>
  );
}

/* ─── 10. TOGGLE ─── switch flips with spring */
export function ToggleIcon({ size = 40, color = "currentColor", className, duration = 1800 }: StateIconProps) {
  const on = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.rect x="5" y="13" width="30" height="14" rx="7"
        animate={on ? { fill: color, opacity: 0.2 } : { fill: color, opacity: 0.08 }}
        transition={{ duration: 0.3 }}
      />
      <rect x="5" y="13" width="30" height="14" rx="7" stroke={color} strokeWidth={2} opacity={on ? 1 : 0.4} />
      <motion.circle cy="20" r="5" fill={color}
        animate={on ? { cx: 28 } : { cx: 12 }}
        transition={{ type: "spring", stiffness: 500, damping: 25 }}
      />
    </svg>
  );
}

/* ─── 11. EYE → HIDDEN ─── eye opens/closes with slash */
export function EyeToggleIcon({ size = 40, color = "currentColor", className, duration = 2200 }: StateIconProps) {
  const hidden = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="M4 20s6-10 16-10 16 10 16 10-6 10-16 10S4 20 4 20z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        animate={hidden ? { opacity: 0.3 } : { opacity: 1 }} transition={{ duration: 0.3 }}
      />
      <motion.circle cx="20" cy="20" r="5" stroke={color} strokeWidth={2}
        animate={hidden ? { scale: 0.6, opacity: 0.2 } : { scale: 1, opacity: 1 }} transition={{ duration: 0.3 }}
      />
      <motion.line x1="6" y1="34" x2="34" y2="6" stroke={color} strokeWidth={2.5} strokeLinecap="round"
        animate={hidden ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.25 }}
      />
    </svg>
  );
}

/* ─── 12. VOLUME ─── mute/unmute with wave fade */
export function VolumeIcon({ size = 40, color = "currentColor", className, duration = 2400 }: StateIconProps) {
  const muted = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M8 16h5l7-6v20l-7-6H8a1 1 0 01-1-1V17a1 1 0 011-1z" stroke={color} strokeWidth={2} strokeLinejoin="round" />
      <motion.path d="M26 14a8 8 0 010 12" stroke={color} strokeWidth={2} strokeLinecap="round"
        animate={muted ? { opacity: 0, x: -3 } : { opacity: 1, x: 0 }} transition={{ duration: 0.3 }}
      />
      <motion.path d="M30 10a14 14 0 010 20" stroke={color} strokeWidth={2} strokeLinecap="round"
        animate={muted ? { opacity: 0, x: -5 } : { opacity: 0.5, x: 0 }} transition={{ duration: 0.3, delay: 0.05 }}
      />
      <motion.g animate={muted ? { opacity: 1 } : { opacity: 0 }} transition={{ duration: 0.25 }}>
        <line x1="26" y1="16" x2="34" y2="24" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
        <line x1="34" y1="16" x2="26" y2="24" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}

/* ─── Solar-specific animated icons ─── */

/* Brain/AI icon — morphs between brain and sparkle (for AI features) */
export function AIIcon({ size = 40, color = "currentColor", className, duration = 3000 }: StateIconProps) {
  const active = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="M20 8c-2 0-4 1-5 3-1.5 0-3 1-3.5 2.5C9 14 8 16 8 18c0 3 2 5.5 5 6.5V28h14v-3.5c3-1 5-3.5 5-6.5 0-2-1-4-3.5-4.5C28 12 26.5 11 25 11c-1-2-3-3-5-3z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        animate={active ? { pathLength: [1, 0.6, 1], opacity: [1, 0.6, 1] } : { pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, repeat: active ? Infinity : 0, ease: "easeInOut" }}
      />
      <motion.path d="M16 28v4M24 28v4M14 32h12" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <AnimatePresence>
        {active && (
          <>
            <motion.circle key="s1" cx="32" cy="10" r="2" fill={color}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 1, delay: 0, repeat: Infinity, repeatDelay: 0.5 }}
            />
            <motion.circle key="s2" cx="8" cy="12" r="1.5" fill={color}
              initial={{ scale: 0, opacity: 0 }} animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }}
              transition={{ duration: 1, delay: 0.4, repeat: Infinity, repeatDelay: 0.5 }}
            />
          </>
        )}
      </AnimatePresence>
    </svg>
  );
}

/* Sun icon — rays pulse outward (for solar irradiance) */
export function SunPulseIcon({ size = 40, color = "currentColor", className, duration = 2000 }: StateIconProps) {
  const bright = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.circle cx="20" cy="20" r="7" fill={color}
        animate={bright ? { r: 8, opacity: 1 } : { r: 6, opacity: 0.7 }}
        transition={{ duration: 0.6, ease: "easeInOut" }}
      />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
        const rad = (angle * Math.PI) / 180;
        const x1 = 20 + 10 * Math.cos(rad);
        const y1 = 20 + 10 * Math.sin(rad);
        const x2 = 20 + 14 * Math.cos(rad);
        const y2 = 20 + 14 * Math.sin(rad);
        return (
          <motion.line key={angle} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={2} strokeLinecap="round"
            animate={bright
              ? { x1: 20 + 11 * Math.cos(rad), y1: 20 + 11 * Math.sin(rad), x2: 20 + 16 * Math.cos(rad), y2: 20 + 16 * Math.sin(rad), opacity: 1 }
              : { x1, y1, x2, y2, opacity: 0.5 }}
            transition={{ duration: 0.6, delay: i * 0.04 }}
          />
        );
      })}
    </svg>
  );
}

/* Location pin — drops in with bounce (for map/location) */
export function LocationPinIcon({ size = 40, color = "currentColor", className, duration = 2400 }: StateIconProps) {
  const dropped = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.g
        animate={dropped ? { y: 0 } : { y: -6 }}
        transition={dropped ? { type: "spring", stiffness: 400, damping: 15 } : { duration: 0.3 }}>
        <path d="M20 6a10 10 0 00-10 10c0 7 10 18 10 18s10-11 10-18A10 10 0 0020 6z" stroke={color} strokeWidth={2} />
        <circle cx="20" cy="16" r="4" fill={color} />
      </motion.g>
      <motion.ellipse cx="20" cy="36" rx="6" ry="2" fill={color}
        animate={dropped ? { opacity: 0.3, scaleX: 1 } : { opacity: 0, scaleX: 0 }}
        transition={{ duration: 0.3 }}
        style={{ transformOrigin: "20px 36px" }}
      />
    </svg>
  );
}

/* Chart/Bar icon — bars fill up (for analytics) */
export function ChartIcon({ size = 40, color = "currentColor", className, duration = 2200 }: StateIconProps) {
  const full = useAutoToggle(duration);
  const heights = full ? [20, 28, 16, 24] : [10, 14, 8, 18];
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <line x1="7" y1="33" x2="33" y2="33" stroke={color} strokeWidth={2} strokeLinecap="round" opacity={0.4} />
      {[0, 1, 2, 3].map((i) => {
        const x = 10 + i * 7;
        const h = heights[i];
        return (
          <motion.rect key={i} x={x} width="5" rx="1.5" fill={color}
            animate={{ height: h, y: 33 - h }}
            transition={{ duration: 0.5, delay: i * 0.07, ease: [0.32, 0.72, 0, 1] }}
          />
        );
      })}
    </svg>
  );
}

/* Zap/Lightning — flashes (for real-time / energy) */
export function ZapIcon({ size = 40, color = "currentColor", className, duration = 1800 }: StateIconProps) {
  const flash = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <motion.path d="M22 6L10 22h12l-4 12L34 18H22L26 6z"
        stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
        fill={flash ? color : "none"}
        animate={flash ? { scale: [1, 1.15, 1], opacity: [1, 0.8, 1] } : { scale: 1, opacity: 0.7 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        style={{ transformOrigin: "22px 20px" }}
      />
    </svg>
  );
}

/* File/PDF icon — page flips open (for reports) */
export function FileIcon({ size = 40, color = "currentColor", className, duration = 2600 }: StateIconProps) {
  const open = useAutoToggle(duration);
  return (
    <svg viewBox="0 0 40 40" fill="none" className={cn("", className)} style={{ width: size, height: size }}>
      <path d="M12 6h12l8 8v22a2 2 0 01-2 2H12a2 2 0 01-2-2V8a2 2 0 012-2z" stroke={color} strokeWidth={2} />
      <path d="M24 6v8h8" stroke={color} strokeWidth={2} strokeLinecap="round" />
      <motion.g animate={open ? { opacity: 1 } : { opacity: 0.3 }} transition={{ duration: 0.4 }}>
        <line x1="16" y1="20" x2="26" y2="20" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <line x1="16" y1="25" x2="26" y2="25" stroke={color} strokeWidth={2} strokeLinecap="round" />
        <line x1="16" y1="30" x2="22" y2="30" stroke={color} strokeWidth={2} strokeLinecap="round" />
      </motion.g>
    </svg>
  );
}
