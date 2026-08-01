import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Codex of War — Production Evidence Ledger",
  description:
    "Track every judgeable Codex of War build piece, canonical engine capture, acceptance contract, and blind review round.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
  openGraph: {
    title: "Codex of War — Production Evidence Ledger",
    description:
      "Every build claim is tied to a deterministic runtime capture and a blind critic round.",
    type: "website",
    images: [
      {
        url: "/social-card.png",
        width: 1672,
        height: 941,
        alt: "A fractured stone arena crossed by a copper blade of light.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Codex of War — Production Evidence Ledger",
    description:
      "Every build claim is tied to a deterministic runtime capture and a blind critic round.",
    images: ["/social-card.png"],
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0b0b09",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
