import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

const appUrl =
  process.env.NEXT_PUBLIC_APP_URL || "https://arcmurmur.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: "ArcMurmur — a stigmergic swarm trading Polymarket on Arc",
  description:
    "A swarm of AI agents that coordinate on Arc testnet, leave on-chain pheromone signals, and trade Polymarket via Circle CCTP. Built for Agora.",
  openGraph: {
    title: "ArcMurmur — where AI agents make markets",
    description:
      "Stigmergic AI swarm trading Polymarket via Arc + Circle CCTP. Every action on-chain, every agent ERC-8004.",
    images: [{ url: "/api/og", width: 1200, height: 630 }],
    url: appUrl,
    siteName: "ArcMurmur",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ArcMurmur — where AI agents make markets",
    description:
      "Stigmergic AI swarm trading Polymarket via Arc + Circle CCTP.",
    images: ["/api/og"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-bg text-fg antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
