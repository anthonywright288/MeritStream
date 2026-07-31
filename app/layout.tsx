import type { Metadata } from "next";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Design system (docs/design-system.md): headings/body use the native SF Pro
// stack (pure CSS, no download); IBM Plex Mono covers labels, tags, USDC
// amounts, wallet addresses and tx hashes via the --font-code variable.
const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-code",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MeritStream · Merit in. USDC out.",
  description:
    "GitHub signals in, weighted USDC splits out, one automated settlement on Arc. Deterministic, zero LLM, auditable by anyone.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${ibmPlexMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
