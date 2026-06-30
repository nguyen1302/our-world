import type { Metadata } from "next";
import { Spectral, Be_Vietnam_Pro } from "next/font/google";
import "./globals.css";

const spectral = Spectral({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

const beVietnam = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "We Were Here",
  description: "Bản đồ ký ức của hai người",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${spectral.variable} ${beVietnam.variable}`}>
      <body>{children}</body>
    </html>
  );
}
