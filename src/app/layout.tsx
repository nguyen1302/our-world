import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "We Were Here",
  description: "Bản đồ ký ức của hai người",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
