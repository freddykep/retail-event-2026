import type { Metadata } from "next";
import { Manrope, Inter } from "next/font/google";
import "./globals.css";

// Klavika (adesso Hausschrift) ist proprietär/lizenzpflichtig und nicht frei verfügbar.
// Manrope (Headlines) + Inter (Fließtext) sind freie, geometrische Sans-Alternativen,
// die die adesso-Anmutung nachbilden, ohne eine Lizenz zu benötigen.
const heading = Manrope({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["600", "700", "800"],
});

const body = Inter({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Workshop-Anmeldung",
  description: "Workshop-Buchungsplattform für das Event",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="de"
      className={`${heading.variable} ${body.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-white text-adesso-blue-4">{children}</body>
    </html>
  );
}
