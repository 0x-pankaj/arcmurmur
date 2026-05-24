"use client";
import { Github, ExternalLink } from "lucide-react";

export function Footer() {
  return (
    <footer className="mx-auto max-w-7xl px-6 py-10 text-xs text-[var(--color-fg-soft)]">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 border-t border-[var(--color-border)] pt-6">
        <div className="flex items-center gap-3">
          <span className="font-mono">ArcMurmur</span>
          <span>·</span>
          <span>Built for Agora · Where AI agents make markets.</span>
        </div>
        <div className="flex items-center gap-4">
          <a
            href="https://agora.thecanteenapp.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            Agora <ExternalLink className="size-3" />
          </a>
          <a
            href="https://polymarket.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            Polymarket <ExternalLink className="size-3" />
          </a>
          <a
            href="https://github.com/"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-white"
          >
            <Github className="size-3" /> source
          </a>
        </div>
      </div>
    </footer>
  );
}
