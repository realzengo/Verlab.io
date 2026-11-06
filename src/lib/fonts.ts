import { Caveat } from "next/font/google";
import localFont from "next/font/local";

export const europaGrotesk = localFont({
  src: "../fonts/EuropaGroteskSH-DemiBold.woff2",
  weight: "700",
  style: "normal",
  display: "swap",
  variable: "--font-europa-grotesk",
});

// Handwriting for margin notes (the Transcripts link field's annotation).
export const caveat = Caveat({
  subsets: ["latin"],
  weight: ["500"],
  display: "swap",
});
