import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const short = (addr?: string) =>
  addr && addr.length > 12 ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : (addr ?? "");

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const wallet = searchParams.get("wallet") ?? "";
  const pnl = Number(searchParams.get("pnl") ?? 0);
  const deposited = Number(searchParams.get("deposited") ?? 0);
  const rank = searchParams.get("rank") ?? "—";
  const headline =
    searchParams.get("headline") ??
    (wallet ? "I'm in the swarm." : "ArcMurmur — AI agents make markets.");

  const pnlColor = pnl > 0 ? "#a3e635" : pnl < 0 ? "#fb7185" : "#a1a1aa";
  const pnlSign = pnl > 0 ? "+" : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          background:
            "linear-gradient(135deg, #0a0a0c 0%, #1a1024 55%, #0a0a0c 100%)",
          color: "#f4f4f5",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          padding: "60px 70px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* glow */}
        <div
          style={{
            position: "absolute",
            top: -200,
            right: -200,
            width: 600,
            height: 600,
            background: "radial-gradient(circle, #7c5cff44 0%, transparent 70%)",
            display: "flex",
          }}
        />

        {/* top bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            zIndex: 1,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 12,
                background: "#7c5cff22",
                color: "#a78bfa",
                fontSize: 36,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✶
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 36, fontWeight: 600, letterSpacing: -0.5 }}>
                ArcMurmur
              </span>
              <span style={{ fontSize: 18, color: "#a1a1aa" }}>
                stigmergic AI swarm · Arc + Circle CCTP · Polymarket
              </span>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 18,
              color: "#a78bfa",
              border: "1px solid #7c5cff66",
              borderRadius: 999,
              padding: "8px 18px",
            }}
          >
            Agora hackathon
          </div>
        </div>

        {/* headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            zIndex: 1,
            marginTop: 30,
          }}
        >
          <div
            style={{
              fontSize: 80,
              fontWeight: 600,
              lineHeight: 1.05,
              letterSpacing: -2,
              maxWidth: 1000,
              display: "flex",
            }}
          >
            {headline}
          </div>

          {wallet && (
            <div style={{ display: "flex", marginTop: 14, color: "#a1a1aa", fontSize: 22 }}>
              wallet · {short(wallet)} · rank #{rank}
            </div>
          )}
        </div>

        {/* stats row */}
        {wallet && (
          <div
            style={{
              display: "flex",
              gap: 30,
              zIndex: 1,
            }}
          >
            <Stat label="my PnL share" value={`${pnlSign}$${Math.abs(pnl).toFixed(2)}`} color={pnlColor} />
            <Stat label="deposited" value={`$${deposited.toFixed(2)}`} />
            <Stat label="agents working" value="4" />
            <Stat label="chain" value="Arc Testnet" />
          </div>
        )}

        {/* footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 36,
            fontSize: 20,
            color: "#a1a1aa",
            zIndex: 1,
          }}
        >
          <span>arcmurmur.app</span>
          <span>where AI agents make markets</span>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#ffffff08",
        border: "1px solid #ffffff14",
        borderRadius: 14,
        padding: "14px 22px",
        minWidth: 200,
      }}
    >
      <span style={{ fontSize: 16, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 1 }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 38,
          fontWeight: 600,
          color: color ?? "#f4f4f5",
          marginTop: 4,
        }}
      >
        {value}
      </span>
    </div>
  );
}
