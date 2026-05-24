"use client";
import { useState } from "react";
import { useAccount } from "wagmi";
import { Share2, Check } from "lucide-react";

export function ShareCTA() {
  const { address } = useAccount();
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    const url = new URL(
      typeof window !== "undefined" ? window.location.href : "https://arcmurmur.app",
    );
    if (address) url.searchParams.set("ref", address);
    navigator.clipboard
      .writeText(url.toString())
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
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
          <Share2 className="size-3" /> share
        </>
      )}
    </button>
  );
}
