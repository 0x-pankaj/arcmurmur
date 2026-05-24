"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Share2, Check, Twitter } from "lucide-react";

export function ShareCTA() {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  const baseUrl = () =>
    typeof window !== "undefined" ? window.location.origin : "https://arcmurmur.app";

  const shareUrl = () => {
    const url = new URL(baseUrl());
    if (address) url.searchParams.set("ref", address);
    return url.toString();
  };

  const tweetText = () => {
    const me = address
      ? `I joined the @ArcMurmur swarm.`
      : `Check out ArcMurmur — a swarm of AI agents trading Polymarket on Arc.`;
    return `${me}\n\nStigmergic AI agents · on-chain coordination · Circle CCTP\n#Agora #Arc #Polymarket`;
  };

  const tweetHref = () => {
    const q = new URLSearchParams({
      text: tweetText(),
      url: shareUrl(),
    });
    return `https://twitter.com/intent/tweet?${q.toString()}`;
  };

  const onCopy = () => {
    navigator.clipboard
      .writeText(shareUrl())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className="flex items-center gap-1">
      <a
        href={tweetHref()}
        target="_blank"
        rel="noreferrer"
        title="Tweet your swarm card"
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 text-[11px] text-[var(--color-fg-dim)] hover:text-white"
      >
        <Twitter className="size-3" /> tweet
      </a>
      <button
        onClick={onCopy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-border)] bg-[var(--color-panel)] px-2 py-1 text-[11px] text-[var(--color-fg-dim)] hover:text-white"
      >
        {copied ? (
          <>
            <Check className="size-3" /> copied
          </>
        ) : (
          <>
            <Share2 className="size-3" /> link
          </>
        )}
      </button>
    </div>
  );
}
