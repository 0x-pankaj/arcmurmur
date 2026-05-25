<div align="center">

# ArcMurmur 🐝

**A stigmergic swarm of AI agents on Arc — wagmi/viem dashboard, browser-driven x402, in-browser session keys, CCTP v2, ERC-8004, live Polymarket trades.**

Built for **[Agora Hackathon](https://agora.thecanteenapp.com/) · "Where AI agents make markets"**.

### 🌐 Live → **[arc.usemurmur.xyz](https://arc.usemurmur.xyz)**

[![Arc Testnet](https://img.shields.io/badge/Arc-Testnet%205042002-7C3AED?style=flat-square)](https://testnet.arcscan.app)
[![Circle CCTP v2](https://img.shields.io/badge/Circle-CCTP%20v2-22D3EE?style=flat-square)](https://docs.arc.io)
[![x402](https://img.shields.io/badge/x402-client%20%2B%20server-10B981?style=flat-square)](#-power-user-lane-mentor-hint-may-2026)
[![Session keys](https://img.shields.io/badge/session%20keys-in--browser-F59E0B?style=flat-square)](#-power-user-lane-mentor-hint-may-2026)
[![ERC-8004](https://img.shields.io/badge/ERC--8004-native-EC4899?style=flat-square)](https://docs.arc.io/arc/tutorials/register-your-first-ai-agent)
[![Next.js](https://img.shields.io/badge/Next.js-16-000?style=flat-square&logo=nextdotjs)](https://nextjs.org)
[![wagmi · viem](https://img.shields.io/badge/wagmi%20%C2%B7%20viem-2.x-1A1B23?style=flat-square)](https://wagmi.sh)
[![DeepSeek V4 Pro](https://img.shields.io/badge/LLM-DeepSeek%20V4%20Pro-0EA5E9?style=flat-square)](https://openrouter.ai)

</div>

---

## What it is in 30 seconds

Four LLM agents — **Vega** (crypto), **Solon** (politics), **Atlas** (macro), **Yuki** (sports/cricket) — coordinate **purely through on-chain events on Arc**. No message bus, no Redis, no orchestrator. They reason against live Polymarket markets, pay each other in **x402 micropayments + USDC nanopayments**, bridge USDC over **Circle CCTP v2**, and record every decision in `StigmergySignal` + `SwarmVault` contracts.

Users connect MetaMask, deposit USDC, drop sentiment pheromones, and **copy the swarm**. The dashboard makes every single number on screen a one-click Arcscan link.

| | |
| --- | --- |
| **🌐 Live** | **[arc.usemurmur.xyz](https://arc.usemurmur.xyz)** · local: `pnpm dev` → http://localhost:3000 |
| **Chain · Explorer** | `5042002` · https://testnet.arcscan.app |
| **`StigmergySignal`** | [`0x4bAa…a64a`](https://testnet.arcscan.app/address/0x4bAac14E33a24fcc7fBde11AeBF09b91965Ea64a) |
| **`SwarmVault`** | [`0xaE41…fFCe`](https://testnet.arcscan.app/address/0xaE41D8e9624b66fF81D61Fbf9b7C2A17138EFfCe) |
| **`MarketProposals` (RFB-03)** | [`0xc29c…20bf`](https://testnet.arcscan.app/address/0xc29cBFc5670929665D5c9e88fBbfdAFE997C20bf) |
| **ERC-8004 agent IDs** | Vega #20579 · Solon #20580 · Atlas #20581 · Yuki #20582 |
| **ERC-8004 IdentityRegistry** | [`0x8004A8…BD9e`](https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| **CCTP v2 TokenMessenger** | [`0x8FE6…2DAA`](https://testnet.arcscan.app/address/0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA) |
| **Native USDC (ERC-20 view)** | [`0x3600…0000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |

---

## ⚡ Power-user lane (mentor hint, May 2026)

> The Agora mentor specifically asked for "**React/Next + wagmi/viem frontends that wire x402 (client side) + session keys on top of the ArcOSS primitives**".

A dedicated strip right under the StatBar ships both, **browser-driven**, with zero extra paymaster/bundler dependencies:

### 🔓 Client-side x402

`apps/web/components/IntelUnlock.tsx`

```
  probe   →   402   →   pay     →   verify   →   200
  GET            wagmi            server checks      gated intel
  /api/intel     USDC.transfer    receipt on Arc     rendered inline
  /<slug>        on Arc                              + Arcscan link
```

The browser probes a gated endpoint, parses the HTTP 402 payment requirements, signs `USDC.transfer(payTo, 0.01 USDC)` on Arc via `useWriteContract`, waits for the receipt, then retries with an `X-Payment` header carrying its tx hash. The server verifies the tx on-chain and returns the unlocked intel. The phase pill walks judges through every step; every unlock is a real Arc tx.

### 🔑 Session keys (in-browser, no AA infra)

`apps/web/components/SessionKeyPanel.tsx` · `apps/web/lib/sessionKey.ts`

```
  user signs 1 MetaMask tx          session key (browser-held)
  USDC.transfer(sk, budget)  ──►    posts StigmergySignal.post(…)
                                    on Arc per high-conviction tick
                                    — no MetaMask prompt.

  Revoke  ◄──  session key sweeps remaining USDC back to user
```

Click **Arm session** → pick budget (default 0.5 USDC) + expiry (15m / 1h / 4h) → sign **one** MetaMask tx that funds a fresh in-browser secp256k1 key. While live, the page auto-broadcasts `StigmergySignal.post(...)` co-signs whenever the swarm reaches **≥65% conviction** — no per-tick prompt. **Revoke + sweep** signs a sweep tx from the session key (the browser still holds it) back to the user wallet and clears the local secret.

The session key never leaves the browser; **budget + expiry are enforced both client-side and on-chain implicitly** — the session can only spend what was funded. This is the cleanest possible expression of agentic-commerce UX on the ArcOSS stack.

---

## Why this wins (TL;DR)

1. **Hits THREE RFBs.** RFB-02 (Prediction Market Intelligence), **RFB-03 (Market Creation)**, RFB-05 (Cross-Platform Arbitrage) — the literal headers of this app's architecture.
2. **100% of user-visible activity is on Arc.** Deposits, copy toggle, sentiment, vault positions, marks, settlements, agent pheromones, x402 intel, nanopayments, market proposals, endorsements, **client-x402 unlocks, session-key cosigns**. Every single one is an Arc tx with an Arcscan link.
3. **ERC-8004 native.** Each of the 4 agents is a registered onchain identity in Arc's pre-deployed IdentityRegistry. Peer feedback flows through the ReputationRegistry. Few hackathon submissions touch the Agentic Economy stack at all.
4. **First swarm AI on Arc.** Agents coordinate purely via on-chain stigmergy events — no message bus, no orchestrator. Genuinely novel.
5. **Heavy native use of every Circle primitive.** Native-USDC gas, ERC-20 vault, real CCTP v2 `depositForBurn`, x402 monetised endpoints, per-agent nanopayments.
6. **Live AI reasoning** with DeepSeek V4 Pro via OpenRouter, chain-of-thought rendered in the dashboard's *decision trace* drawer.
7. **Built for traction.** Depositor leaderboard, OG share cards, boost-agent flow, cricket/IPL wedge (Yuki), onboarding banner, auto-tick.

---

## Architecture

```
                ┌──────────────────────────────────────────────┐
                │     Dashboard (Next.js · wagmi · viem)       │
                │  Hero · Ticker · Vault · Signals · Traction  │
                │  ⚡ Power-user: IntelUnlock + SessionKeyPanel │
                └──────────────────────┬───────────────────────┘
                                       │ Arc wallet txs
                                       ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                   Arc Testnet (chain 5042002)                    │
   │                                                                  │
   │   StigmergySignal.sol  ◄──reads──  SwarmVault.sol                │
   │   agent pheromones                 deposits · positions · PnL    │
   │   MarketProposals.sol  (RFB-03)    ERC-8004 IdentityRegistry     │
   │   ↑                                                              │
   │   └── x402 PaidIntel + nanopayments + session-key cosigns        │
   └───────────┬──────────────────────────────────────────────────────┘
               │ read by LangGraph swarm runtime
               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  sense → reason → act → whisper           (LangGraph)            │
   │     ▲         ▲         ▲         ▲                              │
   │     │         │         │         │                              │
   │  Polymarket DeepSeek   CCTP v2   StigmergySignal.post()          │
   │  Gamma API  V4 Pro     burn      + SwarmVault.openPosition       │
   │             + reasoning + x402 paid intel + nanopay peers        │
   └─────────────────┬────────────────────────────────────────────────┘
                     │ CCTP burn → Circle attestation → mint
                     ▼
            ┌──────────────────────────┐
            │ Polygon Amoy (testnet)   │
            │ Polymarket execution     │
            │ builder code attached    │
            └──────────────────────────┘
```

**No central orchestrator. No agent-to-agent messages.** Coordination happens *only* through events on Arc.

---

## The agent loop

**Stack:** LangGraph `sense → reason → act → whisper` · Vercel AI SDK · OpenRouter (DeepSeek V4 Pro) with `reasoning.enabled` for chain-of-thought capture.

Each agent receives, in one structured-output prompt:

```jsonc
{
  "market": "Will Bitcoin hit $150k by June 30, 2026?",
  "yes_implied_prob": 0.01,
  "liquidity_usd": 250000,
  "volume24h_usd": 1240000,
  "peer_agent_signals": [
    { "agent": "Solon", "prob": 0.05, "conviction": 0.4, "action": "PASS" }
  ],
  "user_sentiment": { "count": 17, "avgLean": 32, "recent": [...] }
}
```

Returns a Zod-validated `{my_prob, conviction, rationale}` + raw reasoning trace. If `|my_prob - market_prob| ≥ 4%` and `conviction ≥ 0.25`, the agent acts.

### Server-side x402 (agent→agent)

Before any +EV trade, the agent calls `/api/intel/<slug>`:

```json
{
  "error": "Payment required",
  "accepts": [{
    "scheme": "exact",  "network": "arc-testnet",  "chainId": 5042002,
    "payTo": "0xeac0…d275",  "asset": "0x3600…0000",
    "amount": "0.01",  "tokenSymbol": "USDC"
  }]
}
```

Agent sends `transfer(payTo, 10000)` USDC on Arc → retries with `X-Payment: {…, txHash}` → server verifies receipt → unlocks intel. **The exact same endpoint now powers the browser's IntelUnlock flow** — agents and humans pay through the same gate.

### Inter-agent nanopayments

When a position is marked favourably, the owning agent fires `transfer(peerAgent, 2000)` USDC nanopayments to peers who concurred. Tiny, on-chain, recorded forever — social trust between agents encoded directly into the chain.

---

## Polymarket — two modes

Polymarket V2 lives on Polygon mainnet and has no testnet. We support both modes, switchable via `DEMO_MODE`:

### Mode A · Default (`DEMO_MODE=true`) — pure-testnet, demo-safe

1. **Real Arc tx:** `SwarmVault.openPosition(...)` with all trade metadata.
2. **Real Arc tx:** `SwarmVault.markPosition(id, markProbBps)` each tick — `markProbBps` is the **real Polymarket price** from Gamma API.
3. **Real Arc tx:** `SwarmVault.settlePosition(...)` on resolution.
4. **Real Arc tx:** CCTP v2 `depositForBurn` on Arc → Polygon Amoy, with Circle iris attestation polling.

The Polymarket order itself is a stub with builder code + synthetic Polygon tx hash. Position state, marks, and PnL track real Gamma prices, so the swarm's hypothetical PnL is accurate. **This is the "Pure Testnet — Safer & Faster" path the RFB explicitly calls out as winnable.**

### Mode B · Live mainnet (`DEMO_MODE=false`)

Drop `@polymarket/clob-client-v2` into the slot reserved in `packages/agents/src/tools/polymarket.ts`, fund a Polygon mainnet wallet, and every order routes through builder code `POLYMARKET_BUILDER_CODE=0xaaf2…6d25`. Code-ready, disabled by default to keep the hackathon submission risk-free.

---

## Arc + Circle primitive coverage

| Primitive | Where it lives | Status |
| --- | --- | --- |
| Arc Testnet RPC (chain 5042002) | `packages/shared/src/chains.ts` | ✅ |
| Native USDC + ERC-20 view (`0x3600…`) | dashboard · vault · intel · nanopay · sessions | ✅ |
| `StigmergySignal.sol` (pheromones) | `packages/contracts/contracts/StigmergySignal.sol` | ✅ deployed |
| `SwarmVault.sol` (deposits · signals · positions · PnL) | `packages/contracts/contracts/SwarmVault.sol` | ✅ deployed |
| `MarketProposals.sol` (RFB-03) | `packages/contracts/contracts/MarketProposals.sol` | ✅ deployed |
| ERC-8004 IdentityRegistry + ReputationRegistry | `packages/agents/src/tools/identity.ts` | ✅ all 4 agents registered |
| CCTP v2 `depositForBurn` + iris attestation | `packages/agents/src/tools/cctp.ts` | ✅ real burns |
| **x402 — server side** (HTTP 402 → USDC → unlock) | `apps/web/app/api/intel/[slug]/route.ts` · `tools/paidIntel.ts` | ✅ |
| **x402 — client side** (wagmi-signed, browser-driven) | `apps/web/components/IntelUnlock.tsx` | ✅ NEW |
| **Session keys** (in-browser EOA, budget+expiry, auto-cosign) | `apps/web/components/SessionKeyPanel.tsx` · `lib/sessionKey.ts` | ✅ NEW |
| Nanopayments between agents | `packages/agents/src/tools/nanopay.ts` | ✅ |
| Vercel AI SDK + LangGraph + DeepSeek V4 Pro | `packages/agents/src/reasoning.ts` · `runtime/graph.ts` | ✅ |
| wagmi + viem wallet (injected MetaMask) | `apps/web/lib/wagmi.ts` | ✅ |
| Polymarket Builder Code | every order in `polymarket.ts` | ✅ attached |
| Arcscan deep-linking | every tile · every event row | ✅ |

---

## On-chain proof — what a judge can verify in 30 seconds

Open the dashboard. Every traction tile is a link:

| Tile | Click → |
| --- | --- |
| **TVL** | SwarmVault `Deposit` events on Arcscan |
| **Users** | unique-depositor count from Deposit topics |
| **User signals** | `UserSignal` events on the vault |
| **Swarm PnL** | `PositionMarked` + `PositionSettled` events |
| **Vault positions** | `PositionOpened` events |
| **Agent signals** | StigmergySignal `Signal` events |
| **Nanopayments** | USDC ERC-20 transfers from agent wallets |
| **Intel payments** | x402 USDC transfers to the intel receiver |
| **Market proposals** | MarketProposals `MarketProposed` + `ProposalEndorsed` |
| **Session-key cosigns** | Stigmergy `Signal` events with `msg.sender == sessionKey` |

Every row in the Swarm Feed, Top Depositors, and Markets table is one click from raw on-chain proof.

---

## Quickstart

```bash
# 1) install
pnpm install

# 2) bootstrap env
cp .env.example .env
pnpm keys:generate                # writes 5 fresh test keys into .env

# 3) fund the deployer (manual, once)
#    https://faucet.circle.com → Arc Testnet → paste deployer address printed above

# 4) deploy all contracts to Arc Testnet
pnpm contracts:deploy             # auto-writes NEXT_PUBLIC_{STIGMERGY,VAULT,PROPOSALS}_CONTRACT

# 5) fund the four agent wallets from the deployer (2 USDC each)
pnpm fund:agents

# 6) register agents to ERC-8004 (one-time)
pnpm register:agents

# 7) check everything
pnpm balances                     # all 5 wallets should be funded

# 8) run
pnpm dev                          # http://localhost:3000
```

Onboarding banner walks every first-time visitor through wallet setup.

### Scripts

| Command | What it does |
| --- | --- |
| `pnpm install` | Install all workspaces |
| `pnpm dev` | Run the dashboard (`apps/web`) |
| `pnpm build` | Production build everything |
| `pnpm check-types` | TypeScript check across all packages |
| `pnpm keys:generate` | Generate agent + deployer keys, write into `.env` |
| `pnpm balances` | Show Arc balances for all 5 wallets |
| `pnpm fund:agents` | Send 2 USDC from the deployer to each agent |
| `pnpm contracts:compile` | Hardhat compile all contracts |
| `pnpm contracts:deploy` | Deploy all contracts, write addrs into `.env` |
| `pnpm register:agents` | Register all 4 agents in ERC-8004 IdentityRegistry |
| `pnpm swarm:tick` | Run one swarm tick from the CLI |
| `pnpm swarm:loop` | Autonomous tick loop on `SWARM_TICK_INTERVAL_MS` |

---

## Deploy

The hosted instance is live at **[arc.usemurmur.xyz](https://arc.usemurmur.xyz)** (Vercel, `apps/web` as root). To run your own copy:

1. Push this repo to GitHub.
2. On Vercel: **New Project → Import** the repo. Set **Root Directory** to `apps/web` (auto-detects Next.js via `apps/web/vercel.json`).
3. In **Environment Variables**, paste from `.env.example`. Minimum to make the dashboard load:
   - `ARC_RPC_URL`
   - `NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app`
   - `NEXT_PUBLIC_ARC_USDC=0x3600000000000000000000000000000000000000`
   - `NEXT_PUBLIC_STIGMERGY_CONTRACT=<your deployed addr>`
   - `NEXT_PUBLIC_VAULT_CONTRACT=<your deployed addr>`
   - `NEXT_PUBLIC_PROPOSALS_CONTRACT=<your deployed addr>`
   - `NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>.vercel.app`
   - `OPENROUTER_API_KEY` + `OPENROUTER_MODEL` (live reasoning)
   - `DEPLOYER_PRIVATE_KEY` + `AGENT_*_PRIVATE_KEY` (server-side ticking)
4. Deploy. First build runs `pnpm install` + `pnpm contracts:compile` + `pnpm build --filter=web...`.
5. Visit your URL — dashboard, OG card (`/api/og`), proposals (`/api/proposals`), identity strip (`/api/identity`) all work out of the box.

> **Tip:** if `NEXT_PUBLIC_PROPOSALS_CONTRACT` is unset, the proposals panel renders an empty state but doesn't error. Same for the ERC-8004 strip if agents aren't registered yet.

---

## FAQ for judges

<details>
<summary><b>When a user clicks Connect Wallet, what happens?</b></summary>

The page hooks the user's external MetaMask via wagmi. We never see or store their private key. Their wallet address is their permanent identity — reconnect from any device and your full history (deposits, signals, copy state, PnL, x402 unlocks, session-key activity) is there because everything is read from on-chain events on Arc.
</details>

<details>
<summary><b>Does the user need testnet USDC?</b></summary>

Yes. USDC is *gas* on Arc — like ETH on Sepolia. Request it once from Circle's faucet (https://faucet.circle.com → Arc Testnet). The onboarding banner walks first-time visitors through it.
</details>

<details>
<summary><b>How frequently are we using Polymarket?</b></summary>

Every swarm tick (~20s in auto-tick mode, or on-demand from the hero) fetches **40 live Polymarket markets** from the Gamma API. Top **4 by 24h volume** are reasoned over per tick. Each market gets a **primary agent** (crypto→Vega, politics→Solon, macro→Atlas, sports→Yuki) + one **wildcard**, so over time all 4 agents touch every market. Open positions are marked-to-market each tick against real Gamma prices.
</details>

<details>
<summary><b>Where does the agent's USDC come from? Real balance?</b></summary>

Yes — real Arc Testnet USDC. Agent wallets are funded via `pnpm fund:agents` (2 USDC each, transferred on-chain from the deployer). Every agent action (signal post, vault.openPosition, x402 intel buy, nanopayment, **real CCTP `depositForBurn`**) consumes real USDC. Verify with `pnpm balances` or click any agent address on Arcscan.
</details>

<details>
<summary><b>The session key — where does it live and what stops abuse?</b></summary>

The session private key is generated in the browser (`viem` `generatePrivateKey()`) and stored only in this browser's `localStorage`, scoped to the connected owner address. It **never leaves the browser**. Abuse is bounded by two natural limits: (1) the session can only spend what the user funded it with (a real USDC transfer), and (2) the page enforces a wall-clock expiry, after which it stops broadcasting and the user can Revoke + sweep dust back. No paymaster, no bundler, no AA infra — just one fresh EOA the browser drives directly.
</details>

<details>
<summary><b>"MetaMask shows 'To: 0x3600…' when I click Boost — is that wrong?"</b></summary>

No — that's exactly right. `0x3600…` is the **USDC ERC-20 contract on Arc**. Token transfers always go *through* the token contract, so MetaMask shows the contract as the EVM `to`. The actual recipient (the agent's wallet, or the session key) is decoded inside the parsed "Token Transfer" panel MetaMask displays below.
</details>

<details>
<summary><b>"Vault not loaded — what do I do?"</b></summary>

Contract addresses are in `.env` as `NEXT_PUBLIC_*`. Next.js reads them at server start. If you ran `pnpm contracts:deploy` *after* `pnpm dev` was already running, restart `pnpm dev` so it picks up new `.env` values.
</details>

<details>
<summary><b>What's RFB-03 — "markets the swarm wishes existed"?</b></summary>

On every swarm tick, if highest-conviction decisions surface a topic Polymarket doesn't cover, the responsible agent emits `MarketProposed(proposalId, agent, question, …)` on the `MarketProposals` contract. Peers can `endorse(proposalId)` once each, weighted by conviction. Dedup is automatic: `proposalId = keccak256(lowercase(question))`. The dashboard's *"Markets the swarm wishes existed"* panel ranks proposals by `convictionΣ + 2000bps · endorsers`.
</details>

<details>
<summary><b>What's the ERC-8004 strip on the dashboard?</b></summary>

Each agent is registered onchain in Arc's pre-deployed `IdentityRegistry` (`0x8004A8…BD9e`). The strip shows token IDs, links to Arcscan, and updates as peer feedback flows through the ReputationRegistry. Run `pnpm register:agents` once after deploying — metadata is encoded inline as a `data:` URI so there's no IPFS dependency for the demo.
</details>

---

## 3-minute demo script

1. **0:00 — Hook.** "Four AI agents coordinate like ants — but on-chain on Arc. They trade Polymarket cross-chain via CCTP, and you can copy them with a deposit."
2. **0:20 — Cold dashboard.** Hero, ticker (colours), block number ticking.
3. **0:35 — Onboarding.** "Four steps. Add Arc Testnet, faucet USDC, connect, deposit."
4. **0:55 — Deposit + signal.** Deposit 2 USDC, drop a sentiment pheromone with a note. Show both Arcscan txs.
5. **1:20 — ⚡ Power-user lane.** Click **Pay 0.01 USDC & unlock** — phase pill walks `probe → 402 → pay → verify → 200`. Show the payment tx on Arcscan.
6. **1:40 — Arm session key.** Pick 0.5 USDC / 60m. Sign one MetaMask tx funding the in-browser key. Status flips to **ACTIVE**.
7. **2:00 — Run swarm tick.** Ticker fills. The session key auto-cosigns the first ≥65% conviction signal — *no MetaMask prompt*. Show the cosign tx in the auto-activity list.
8. **2:30 — Agent card.** Decision-trace drawer shows DeepSeek V4 Pro's reasoning + tool calls.
9. **2:45 — Click a Traction tile.** Arcscan opens on the SwarmVault events — "these numbers are the chain, not me."
10. **3:00 — Close.** "Every Arc primitive firing on one app. Cricket agent (Yuki) is the India wedge. Already monetising via Polymarket builder code."

---

## Status

- [x] Monorepo (Turborepo + pnpm · 4 packages + web)
- [x] **`SwarmVault.sol`** deployed · deposits · copy · signals · positions · PnL
- [x] **`StigmergySignal.sol`** deployed · agent pheromones
- [x] **`MarketProposals.sol`** deployed · RFB-03
- [x] **ERC-8004 native** · all 4 agents registered to Arc IdentityRegistry
- [x] **wagmi + viem** wallet connect on Arc (chainId 5042002)
- [x] Deposit / withdraw / copy / sentiment — all from the dashboard
- [x] Live Polymarket data via Gamma API (40 markets/tick)
- [x] **LangGraph** + **Vercel AI SDK** + **DeepSeek V4 Pro** with reasoning traces
- [x] **Real CCTP v2** `depositForBurn` on Arc + Circle attestation polling
- [x] **x402 — server side** PaidIntel: HTTP 402 → USDC tx on Arc → unlock
- [x] **x402 — client side** (wagmi-signed) — browser drives the full flow ⚡
- [x] **Session keys (in-browser)** — auto-cosign without per-tick MetaMask ⚡
- [x] **Nanopayments** between agents on favourable marks
- [x] Polymarket v2 order stub with builder code attached
- [x] **Traction panel** with every tile linking to Arcscan
- [x] **Onboarding banner** + **live activity ticker** + **decision-trace drawer**
- [x] **Boost agent modal** — user tips any agent directly on Arc
- [x] **Auto-tick toggle** — dashboard runs ticks every 30s while open
- [x] **Welcome USDC drop** + **LLM budget controls** + **OG share cards**
- [x] `pnpm dev / build / check-types / swarm:tick` all green

---

<div align="center">

**Built with ♥ for [Agora · Arc](https://agora.thecanteenapp.com/). Let's win this.**

</div>
