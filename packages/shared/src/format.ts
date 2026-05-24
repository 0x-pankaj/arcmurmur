export function fmtUsdc(n: number, fractionDigits = 2): string {
  if (!Number.isFinite(n)) return "$0.00";
  const sign = n < 0 ? "-" : "";
  const abs = Math.abs(n);
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

export function fmtPct(p: number, fractionDigits = 1): string {
  if (!Number.isFinite(p)) return "0%";
  return `${(p * 100).toFixed(fractionDigits)}%`;
}

export function shortAddr(a?: string): string {
  if (!a) return "0x…";
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

export function timeAgo(ts: number): string {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function clamp(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}
