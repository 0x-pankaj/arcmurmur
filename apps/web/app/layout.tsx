import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "ArcMurmur — a stigmergic swarm trading Polymarket on Arc",
  description:
    "A swarm of AI agents that coordinate on Arc testnet, leave on-chain pheromone signals, and trade Polymarket via Circle CCTP. Built for Agora.",
  openGraph: {
    title: "ArcMurmur — where AI agents make markets",
    description:
      "Stigmergic AI swarm trading Polymarket via Arc + Circle CCTP.",
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
