import type { Metadata, Viewport } from "next";
import { Inter, Instrument_Serif } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-serif" });

export const metadata: Metadata = {
  title: "CampusOS · Get it done",
  description: "Your AI execution layer for college. Give it an outcome and it plans, acts across Opportunity OS, InternPrep AI and CaseForge with your approval, and reports back.",
  applicationName: "CampusOS",
};

export const viewport: Viewport = { themeColor: "#09090c", colorScheme: "dark" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
