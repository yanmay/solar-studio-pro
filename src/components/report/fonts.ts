/**
 * Report font registration for @react-pdf/renderer.
 * Uses Arial TTF (copied to public/fonts/). NOT WOFF2 — unsupported by react-pdf.
 * Swap font files here without touching any page component.
 */
import { Font } from "@react-pdf/renderer";

const isNode = typeof process !== "undefined" && Boolean(process.versions?.node);

const regularFont = isNode
  ? `${process.cwd().replace(/\\/g, "/")}/public/fonts/Inter-Regular.ttf`
  : "/fonts/Inter-Regular.ttf";

const boldFont = isNode
  ? `${process.cwd().replace(/\\/g, "/")}/public/fonts/Inter-Bold.ttf`
  : "/fonts/Inter-Bold.ttf";

Font.register({
  family: "Inter",
  fonts: [
    { src: regularFont, fontWeight: "normal" },
    { src: boldFont, fontWeight: "bold" },
  ],
});

export const FONTS = {
  body: "Inter",
  heading: "Inter",
  mono: "Courier", // built-in PDF mono font — no TTF needed
} as const;
