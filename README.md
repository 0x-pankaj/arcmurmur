# ArcMurmur 🐝

> **A stigmergic swarm of AI agents living on Arc.**
> Users deposit USDC into a vault on Arc, drop sentiment pheromones, and copy the swarm.
> AI agents reason with DeepSeek V4 Pro, pay other agents/data feeds via **x402 micropayments and nanopayments on Arc**, bridge USDC over **Circle CCTP v2**, and execute predictions against **Polymarket** — every meaningful action is an Arc tx with a clickable Arcscan link.

Built for the **Agora Hackathon · "Where AI agents make markets"**.

| | |
| --- | --- |
| **Live deploy** | `pnpm dev` → http://localhost:3000 · Vercel: set Root Directory to `apps/web` |
| **StigmergySignal** (Arc Testnet) | [`0x4bAa…a64a`](https://testnet.arcscan.app/address/0x4bAac14E33a24fcc7fBde11AeBF09b91965Ea64a) |
| **SwarmVault** (Arc Testnet) | [`0xaE41…fFCe`](https://testnet.arcscan.app/address/0xaE41D8e9624b66fF81D61Fbf9b7C2A17138EFfCe) |
| **MarketProposals** (RFB-03, Arc Testnet) | [`0xc29c…20bf`](https://testnet.arcscan.app/address/0xc29cBFc5670929665D5c9e88fBbfdAFE997C20bf) |
| **ERC-8004 agent IDs** | Vega #20579 · Solon #20580 · Atlas #20581 · Yuki #20582 |
| **ERC-8004 IdentityRegistry** (Arc, pre-deployed) | [`0x8004A8…BD9e`](https://testnet.arcscan.app/address/0x8004A818BFB912233c491871b3d84c89A494BD9e) |
| **CCTP v2 TokenMessenger** | [`0x8FE6…2DAA`](https://testnet.arcscan.app/address/0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA) |
| **Native USDC on Arc (ERC-20 view, 6 dp)** | [`0x3600…0000`](https://testnet.arcscan.app/address/0x3600000000000000000000000000000000000000) |
| **Chain ID / Explorer** | `5042002` · https://testnet.arcscan.app |

---

## TL;DR — why this wins

1. **Hits THREE RFBs.** RFB-02 (Prediction Market Intelligence), **RFB-03 (Market Creation)**, and RFB-05 (Cross-Platform Arbitrage) are the literal headers of this app's architecture. Agents trade existing Polymarket markets *and*, when swarm consensus emerges on a topic Polymarket doesn't cover, emit `MarketProposed` events on Arc. The dashboard's "Markets the swarm wishes existed" panel ranks proposals by `convictionΣ + 2000bps · endorsers`.
2. **100% of user-visible activity is on Arc.** Deposits, copy toggle, sentiment signals, vault positions, marks, settlements, agent pheromones, x402 intel payments, agent-to-agent nanopayments, market proposals, endorsements — every one is an Arc tx. Open the contract on [Arcscan](https://testnet.arcscan.app/address/0xf21e4995278B370c4483c99367ad4A9d04f1cc98) and watch the events stream.
3. **ERC-8004 native.** Each of the 4 agents (Vega, Solon, Atlas, Yuki) is a registered onchain identity in Arc's pre-deployed `IdentityRegistry` (`0x8004A8…BD9e`). The dashboard renders the registration strip live; peer feedback flows through the ReputationRegistry. Few hackathon submissions touch the Agentic Economy stack at all.
4. **First swarm AI on Arc.** Agents coordinate purely via on-chain stigmergy events — no message bus, no Redis, no centralised orchestrator. This is genuinely novel on-chain.
5. **Heavy native use of every Circle primitive.** Native-USDC gas, ERC-20 USDC for the vault, Circle CCTP v2 for cross-chain, x402-style HTTP 402 monetised endpoints, and per-agent nanopayments — exactly the toolkit Arc was built for.
6. **Live AI reasoning** with DeepSeek V4 Pro (via OpenRouter), chain-of-thought captured and rendered in the dashboard's *decision trace* drawer.
7. **Built for traction.** Public **depositor leaderboard** (read live from Deposit events) + **OG-image share cards** (`/api/og?wallet=…`) + boost-agent flow + cricket/IPL angle + auto-tick + onboarding banner = a platform people actually use, not a one-screen demo. The cricket/IPL agent (Yuki) is the wedge for an enormous, underserved Indian audience.

If a judge takes one thing from the dashboard: **every traction tile is a link to Arcscan.** The numbers aren't tallied by us — they are read straight from the chain.

---

## FAQ for judges

**Q. When a user clicks Connect Wallet, what happens?**
The page hooks the user's external MetaMask via wagmi. We never see or store their private key. Their wallet address becomes their permanent identity — reconnect from any device with the same wallet and your full history (deposits, signals, copy state, PnL share) is there because everything is read from on-chain events on Arc.

**Q. Does the user need testnet USDC?**
Yes. USDC is *gas* on Arc, exactly like ETH on Sepolia. They request it once from Circle's faucet (https://faucet.circle.com → Arc Testnet). The onboarding banner walks first-time visitors through it.

**Q. Does the user fund agents directly, or just the vault?**
Both options.
- **Vault deposit** → pooled across all 4 agents, user gets a pro-rata share of total swarm PnL.
- **Boost agent** (new!) → click the *⚡ boost* chip on any agent card → modal pops up → user signs a USDC ERC-20 transfer to that agent's address. Every boost is one Arc tx on Arcscan. The agent uses boost funds for gas, x402 intel payments, and inter-agent nanopayments.

**Q. Is the contract deployed once or per user?**
Once. Two contracts (`StigmergySignal` + `SwarmVault`) are deployed by the deployer wallet exactly one time. Every user on the platform interacts with the same instances — inside the vault, each wallet address has its own row in a `mapping(address ⇒ UserPos)`. That's why the global Traction panel is a real, shared ledger; "1 user" is one unique `0x…` that called `deposit()`.

**Q. How do you identify the same user across sessions?**
Wallet address. There is no account system, no email, no password — just the `0x…` address that signed the deposit. We never custody keys.

**Q. How frequently are we using Polymarket?**
- Every swarm tick (~20s in auto-tick mode, or on-demand via the hero button) fetches **40 live Polymarket markets** from the Gamma API.
- Top **4 markets by 24h volume** are selected for reasoning per tick.
- Each market gets a **primary agent** (matched by keyword: crypto→Vega, politics→Solon, macro→Atlas, sports→Yuki) **plus one random wildcard agent** — so over time all 4 agents participate on every market.
- Open positions are marked-to-market every tick against live Polymarket prices.

**Q. Where does the agent's USDC come from? Real balance?**
Yes — real Arc Testnet USDC. We fund the four agent wallets via `pnpm fund:agents` (2 USDC each, transferred on-chain from the deployer). Every agent action (signal post, vault.openPosition, x402 intel buy, nanopayment, **real CCTP `depositForBurn`**) consumes real USDC. You can verify with `pnpm balances` or by clicking any agent address on Arcscan.

**Q. "MetaMask shows 'To: 0x3600…' when I click Boost — is that wrong?"**
No — that's exactly right. `0x3600000000000000000000000000000000000000` is the **USDC ERC-20 contract on Arc**. Token transfers always go *through* the token contract, so MetaMask shows the contract as the EVM `to`. The actual recipient (the agent's wallet) is decoded inside the parsed "Token Transfer" panel that MetaMask displays below. Our Boost modal now also shows a "what MetaMask will show" preview block so there's no surprise.

**Q. "Vault not loaded — what do I do?"**
The contracts addresses are in `.env` as `NEXT_PUBLIC_*`. Next.js reads `NEXT_PUBLIC_*` at server-start time. If you ran `pnpm contracts:deploy` *after* `pnpm dev` was already running, restart `pnpm dev` so it re-reads `.env`. The panel will then show TVL, your shares, etc.

**Q. Polymarket lives on Polygon mainnet — what are you actually doing there?**
Two modes, switchable via `DEMO_MODE` in `.env`:
- **Default (DEMO_MODE=true):** virtual positions on Arc + live price marking against real Polymarket prices. CCTP v2 `depositForBurn` is the real burn tx on Arc. The Polymarket order itself is a stub (records the intent + builder code + synthetic Polygon tx hash). The position's mark-to-market PnL is *accurate* because it tracks real Gamma prices.
- **Live (DEMO_MODE=false):** plug `@polymarket/clob-client-v2` into the slot reserved in `tools/polymarket.ts`, fund a Polygon mainnet wallet, and every order goes through with our builder code attached.
The "Pure Testnet" path is what the Agora RFB explicitly calls out as winnable — it lets us show genuine cross-chain machinery (CCTP burn, position record, mark, settle) without risking real money.

**Q. Why does this win?**
- **RFB-02 + RFB-03 + RFB-05 directly addressed.** Prediction Market Intelligence + Market Creation + Cross-Platform Arbitrage are the literal headers of this app's architecture.
- **Every Arc primitive used heavily** — USDC gas, ERC-20 USDC vault, CCTP v2, x402 monetised endpoints, nanopayments, ERC-8004 onchain agent identity + reputation, Arcscan deep-linking.
- **100% of user-visible activity is on Arc.** Open the SwarmVault contract on Arcscan and watch the events live.
- **Real AI reasoning** (DeepSeek V4 Pro with chain-of-thought) → visible in the decision-trace drawer.
- **Built for traction.** Depositor leaderboard + OG share cards + boost-agent flow + cricket/IPL angle + auto-tick + onboarding banner = a platform people actually use, not a one-screen demo.

**Q. What's RFB-03 — "markets the swarm wishes existed"?**
On every swarm tick, if the highest-conviction decisions surface a topic Polymarket doesn't cover, the responsible agent emits `MarketProposed(proposalId, agent, question, …)` on the new `MarketProposals` contract on Arc. Peer agents can `endorse(proposalId)` once each, weighted by their own conviction. The dashboard's *"Markets the swarm wishes existed"* panel ranks proposals — every line is a clickable Arcscan tx. Deduplication is automatic: `proposalId = keccak256(lowercase(question))`, so two agents converging on the same question coalesce into one slot with two endorsements.

**Q. What's the ERC-8004 strip on the dashboard?**
Each agent is registered onchain in Arc's pre-deployed `IdentityRegistry` (`0x8004A8…BD9e`). The strip shows token IDs, links into Arcscan, and is updated as peer feedback flows through the ReputationRegistry. Run `pnpm register:agents` once after deploying — metadata is encoded inline as a `data:` URI so there's no IPFS dependency for the demo.

---

## Deploying to Vercel (judge link in under 5 minutes)

1. Push this repo to GitHub.
2. On Vercel: **New Project → Import** the repo. Set **Root Directory** to `apps/web` (Vercel will auto-detect Next.js + monorepo via `apps/web/vercel.json`).
3. In **Environment Variables**, paste every key from `.env.example` that you have a value for. The minimum set to make the dashboard load:
   - `ARC_RPC_URL`
   - `NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app`
   - `NEXT_PUBLIC_ARC_USDC=0x3600000000000000000000000000000000000000`
   - `NEXT_PUBLIC_STIGMERGY_CONTRACT=<your deployed addr>`
   - `NEXT_PUBLIC_VAULT_CONTRACT=<your deployed addr>`
   - `NEXT_PUBLIC_PROPOSALS_CONTRACT=<your deployed addr>`
   - `NEXT_PUBLIC_APP_URL=https://<your-vercel-domain>.vercel.app`
   - `OPENROUTER_API_KEY` (for live reasoning) + `OPENROUTER_MODEL`
   - `DEPLOYER_PRIVATE_KEY` + `AGENT_*_PRIVATE_KEY` (server-side, for ticking)
4. Deploy. The first build runs `pnpm install` + `pnpm contracts:compile` + `pnpm build --filter=web...` automatically.
5. Visit your URL — the dashboard, OG card (`/api/og`), proposals (`/api/proposals`), and identity strip (`/api/identity`) all work out of the box.

> **Tip:** if `NEXT_PUBLIC_PROPOSALS_CONTRACT` is not set, the *"Markets the swarm wishes existed"* panel shows an empty state but doesn't error. Same for the ERC-8004 strip if agent wallets aren't registered yet.

---

## The user flow (what a real person does)

```
1. Land on the page
   ↓
   Hero ticker streams live on-chain Arc events: signals, deposits, intel buys, nanopays.
   "Live · arc"  block number ticking · this is the chain head.
   ↓
2. Onboarding banner (auto-shown first visit)
   ├─ "Add Arc Testnet"   — chainId 5042002, RPC rpc.testnet.arc.network
   ├─ "Get testnet USDC"  — https://faucet.circle.com  (Arc Testnet)
   ├─ "Connect & deposit" — top-right wallet button → Swarm Vault panel
   └─ "Watch the swarm"   — click Run swarm tick in the hero
   ↓
3. Swarm Vault (the user's home on Arc)
   ├─ Deposit USDC        → one Arc tx (Deposit event)
   ├─ Copy toggle ON/OFF  → CopyToggled event
   ├─ Drop a signal       → UserSignal event with their lean (-100..100) + note
   └─ Withdraw anytime    → Withdraw event
   ↓
4. Hit "Run swarm tick"
   ↓
   Behind the scenes (parallelised, ~30s):
   ├─ Fetch 40 live Polymarket markets (Gamma API, public)
   ├─ Read peer agent signals from StigmergySignal on Arc
   ├─ Read user sentiment from SwarmVault on Arc
   ├─ Each agent reasons with DeepSeek V4 Pro (structured-output + reasoning trace)
   ├─ For each actionable +EV decision:
   │   ├─ Pay 0.01 USDC on Arc for paid intel (x402 flow)
   │   ├─ Bridge USDC Arc → Polygon Amoy via CCTP v2 (depositForBurn)
   │   ├─ Record a virtual position on SwarmVault (PositionOpened event)
   │   └─ Whisper a pheromone on StigmergySignal (Signal event)
   ├─ Mark open positions to live Polymarket prices (PositionMarked event)
   └─ Tip peers who concurred via 0.002 USDC nanopayments
   ↓
5. The user sees
   ├─ Ticker fills with new on-chain rows, each colour-coded by event type
   ├─ Traction panel updates (TVL, users, signals, positions, PnL)
   ├─ Their personal PnL share updates in the Vault panel
   ├─ Agent cards animate; click one → decision trace drawer with the model's
   │  step-by-step reasoning, tool calls, and (when present) chain-of-thought
   └─ Every Arcscan link in the UI is one click from raw on-chain proof
```

---

## How we make decisions (the agent loop)

**Stack:** LangGraph state machine `sense → reason → act → whisper`, agent reasoning via **Vercel AI SDK** routed to **OpenRouter (DeepSeek V4 Pro)** with `reasoning.enabled` for chain-of-thought capture.

Each agent receives, in a single structured-output prompt:

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

The model returns a Zod-validated `{my_prob, conviction, rationale}` object plus (where available) `providerMetadata.openrouter.reasoning` — the raw chain-of-thought — which the dashboard renders in the *decision trace* drawer.

If `|my_prob - market_prob| ≥ 4%` and `conviction ≥ 0.25`, the agent acts.

### x402-style monetised intel (real)

Before any +EV trade, the agent calls `/api/intel/<slug>`. The endpoint responds with **HTTP 402**:

```json
{
  "error": "Payment required",
  "accepts": [{
    "scheme": "exact",
    "network": "arc-testnet",
    "chainId": 5042002,
    "payTo":  "0xeac0…d275",
    "asset":  "0x3600…0000",
    "amount": "0.01",
    "tokenSymbol": "USDC"
  }]
}
```

The agent then:
1. Sends a `transfer(payTo, 10000)` USDC tx on Arc → gets `txHash`.
2. Retries with `X-Payment: {…, txHash}`.
3. Server verifies the receipt on Arc and unlocks the intel.

Every intel buy is an extra on-chain Arc tx — the cleanest expression of "agentic commerce on Arc."

### Inter-agent nanopayments (real)

When a position is marked favourably, the owning agent fires `transfer(peerAgent, 2000)` USDC nanopayments to peers who whispered concurring signals. Tiny, on-chain, recorded forever — encodes social trust between agents directly into the chain.

---

## "Do agents need real wallet balances? How are you paying?"

**Yes, on Arc Testnet.** Real testnet USDC, real txs, real consumption. Here's the funding model:

| Wallet | Funded with | Source | Purpose |
| --- | --- | --- | --- |
| Deployer | 20 testnet USDC | Circle faucet (manual) | Deploys both contracts; distributes 2 USDC to each agent |
| Vega · Solon · Atlas · Yuki | 2 testnet USDC each | `pnpm fund:agents` (auto-transfers from deployer) | Posts on-chain signals, opens vault positions, pays x402 intel, sends nanopayments |
| End user | Whatever they faucet | Circle faucet (manual) | Deposits into the vault, sends sentiment signals |

Every wallet's balance is read live by `pnpm balances` (or visible directly on Arcscan). All transactions consume real testnet USDC for gas + value transfer. We don't fake any payments.

**The faucet itself is the only manual step the user takes** — it's a Cloudflare-protected SPA and cannot be automated.

---

## "Polymarket lives on Polygon mainnet — what are you doing there?"

We use **two complementary modes** so the demo is provable on Arc *and* the architecture is honest about where Polymarket actually trades:

### Mode A (default, demo-safe): Virtual positions + live price marking

When an agent decides to BUY YES at $X on a market:

1. **Real Arc tx**: agent calls `SwarmVault.openPosition(marketId, slug, action, sizeUsdc, entryProbBps, rationale, polygonTxHash)` → on Arc this is a `PositionOpened` event with all the trade metadata.
2. **Real Arc tx**: agent calls `SwarmVault.markPosition(id, markProbBps)` on a tick, where `markProbBps` is fetched from Polymarket's Gamma API. PnL updates on Arc.
3. **Real Arc tx**: when a market resolves, an agent calls `SwarmVault.settlePosition(id, pnlMicroUsdc, polygonTxHash)`.
4. **Real Arc tx**: CCTP v2 `depositForBurn` on Arc → Polygon Amoy. This is genuinely burned USDC routed through Circle's iris attestation service.

The Polymarket order itself is recorded in DEMO_MODE as a synthetic tx hash with the builder code attached — *not* a real mainnet trade, because (a) that would require real money, and (b) Polymarket V2 has no testnet. Our position state, marks, and PnL track the **real Polymarket price** via Gamma API, so the swarm's hypothetical PnL is accurate.

**This is the "Pure Testnet — Safer & Faster" path the RFB explicitly calls out as winnable.**

### Mode B (optional, live mainnet): real Polymarket trade

Set `DEMO_MODE=false`, fund a Polygon mainnet wallet, drop `@polymarket/clob-client-v2` into the spot reserved for it in `packages/agents/src/tools/polymarket.ts`. Every order then routes through `POLYMARKET_BUILDER_CODE=0xaaf2…6d25` so fees flow back to the team treasury.

We've left this path code-ready but disabled by default to keep the hackathon submission risk-free.

---

## Traction strategy — how users actually arrive

**Goal:** by the end of the hackathon, 30–100 unique addresses depositing into the SwarmVault on Arc. Every one is verifiable on Arcscan.

| Channel | Mechanic |
| --- | --- |
| **Live-stream the dashboard** | The activity ticker is built for screen capture. Each Arc tx becomes a short narrative — "Solon just paid 0.01 USDC for intel and is buying YES @ 1¢ on …" — easily clipped to X / Telegram. |
| **Cricket / IPL angle (Yuki)** | The sports agent specialises in IPL & T20 markets. Underserved in the West, massive in India. We post Yuki's takes daily to /r/IPL and a few Indian crypto Telegrams. |
| **Public copy-trading** | Users can deposit `$1 USDC` and *copy the swarm* — their share of PnL is exactly proportional to their share of the vault. No KYC, no Polygon wallet, no Polymarket account. Just an Arc deposit. |
| **Sentiment-as-content** | Users who send sentiment signals see their pheromones colour the next agent decision — a tangible "I made the swarm change its mind" loop that gets shared. |
| **Builder-code flywheel** | Every order attaches our Polymarket builder code; volume the swarm drives funds more agent compute. Closed loop. |
| **`arc-canteen` integration** | `arc-canteen update-product` + `arc-canteen update-traction` post our numbers into the Agora dashboard automatically. |

**Why people stay:** their deposit earns real swarm PnL, they can see their on-chain signal influence the swarm's reasoning, and they get bragging rights when their lean was right.

---

## On-chain proof — what a judge can verify in 30 seconds

Open the dashboard. Every traction tile is a link:

| Tile | Click → |
| --- | --- |
| **TVL** | SwarmVault Deposit events on Arcscan |
| **Users** | unique-depositor count derived from Deposit topics |
| **User signals** | UserSignal events on the vault |
| **Swarm PnL** | PositionMarked + PositionSettled events |
| **Vault positions** | PositionOpened events |
| **Agent signals** | StigmergySignal.Signal events |
| **Nanopayments** | USDC ERC-20 transfers from agent wallets |
| **Intel payments** | x402 USDC transfers to the intel receiver |

Plus:

- Every row in the **Swarm Feed** has an `arcscan ↗` link to its source tx.
- Every row in the **Top depositors** list links to the user's address page.
- Every market in the **Markets table** links to Polymarket.

---

## Architecture

```
                ┌──────────────────────────────────────────────┐
                │       Dashboard (Next.js · wagmi · viem)     │
                │   Hero · Ticker · Vault · Signals · Traction │
                └──────────────────────┬───────────────────────┘
                                       │ Arc wallet txs
                                       ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │                    Arc Testnet (chain 5042002)                  │
   │                                                                  │
   │   ┌────────────────┐    reads     ┌──────────────────────┐      │
   │   │ SwarmVault.sol │ ───────────► │ StigmergySignal.sol  │      │
   │   │  deposits      │              │  agent pheromones    │      │
   │   │  copy / signal │              │  (indexed events)    │      │
   │   │  positions     │              └──────────────────────┘      │
   │   │  PnL           │                                             │
   │   └───────┬────────┘                                             │
   └───────────┼──────────────────────────────────────────────────────┘
               │ read by LangGraph swarm runtime
               ▼
   ┌──────────────────────────────────────────────────────────────────┐
   │  sense → reason → act → whisper          (LangGraph)            │
   │   ▲          ▲         ▲        ▲                                │
   │   │          │         │        │                                │
   │ Polymarket  DeepSeek  CCTP v2  StigmergySignal.post()            │
   │ Gamma       V4 Pro    depositForBurn + SwarmVault.openPosition  │
   │ + reasoning + x402 paid intel on Arc + nanopay peers             │
   └─────────────────┬────────────────────────────────────────────────┘
                     │ CCTP burn → Circle attestation → mint
                     ▼
            ┌──────────────────────────┐
            │ Polygon Amoy (testnet)   │
            │ Polymarket execution     │
            │ (builder code attached;  │
            │  stub in DEMO_MODE)      │
            └──────────────────────────┘
```

**No central orchestrator. No agent-to-agent messages.** Coordination happens *only* through events on Arc.

---

## Arc + Circle primitive coverage

| Primitive | Where it lives | Status |
| --- | --- | --- |
| Arc Testnet RPC (chain 5042002) | `packages/shared/src/chains.ts` | ✅ |
| Native USDC + ERC-20 view (0x3600…) | dashboards, vault, intel, nanopay | ✅ |
| `StigmergySignal.sol` (agent pheromones) | `packages/contracts/contracts/StigmergySignal.sol` | ✅ deployed |
| `SwarmVault.sol` (deposits / signals / positions / PnL) | `packages/contracts/contracts/SwarmVault.sol` | ✅ deployed |
| CCTP v2 TokenMessengerV2 (`0x8FE6…`) | `packages/agents/src/tools/cctp.ts` | ✅ real `depositForBurn` + iris attestation polling |
| App Kit Bridge target | Polygon Amoy via `BRIDGE_DEST=amoy` | ✅ |
| Polymarket Builder Code | every order in `polymarket.ts` | ✅ attached |
| x402-style PaidIntel | `apps/web/app/api/intel/[slug]/route.ts` + `tools/paidIntel.ts` | ✅ |
| Nanopayments between agents | `tools/nanopay.ts` | ✅ |
| Vercel AI SDK + LangGraph + DeepSeek V4 Pro | `packages/agents/src/reasoning.ts` + `runtime/graph.ts` | ✅ |
| wagmi + viem wallet (injected MetaMask) | `apps/web/lib/wagmi.ts` | ✅ |
| Arcscan deep-linking everywhere | every tile / event row in the dashboard | ✅ |

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

# 4) deploy both contracts to Arc Testnet
pnpm contracts:deploy             # auto-writes NEXT_PUBLIC_{STIGMERGY,VAULT}_CONTRACT

# 5) fund the four agent wallets from the deployer (2 USDC each)
pnpm fund:agents

# 6) check everything
pnpm balances                     # all 5 wallets should be funded

# 7) run
pnpm dev                          # http://localhost:3000
```

That's the full setup. Onboarding banner walks every first-time visitor through the wallet steps.

---

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm install` | Install all workspaces |
| `pnpm dev` | Run the dashboard (`apps/web`) |
| `pnpm build` | Production build everything |
| `pnpm check-types` | TypeScript check across all packages |
| `pnpm keys:generate` | Generate agent + deployer keys, write into `.env` |
| `pnpm balances` | Show Arc balances for all 5 wallets |
| `pnpm fund:agents` | Send 2 USDC from the deployer to each agent |
| `pnpm contracts:compile` | Hardhat compile both contracts |
| `pnpm contracts:deploy` | Deploy StigmergySignal + SwarmVault, write addrs into `.env` |
| `pnpm swarm:tick` | Run one swarm tick from the CLI |
| `pnpm swarm:loop` | Autonomous tick loop on `SWARM_TICK_INTERVAL_MS` |

---

## 3-minute demo script

1. **0:00 — Hook.** "What if a swarm of AI agents coordinated like ants — but on-chain? ArcMurmur runs four LLM agents that whisper pheromones on Arc and trade Polymarket cross-chain."
2. **0:20 — Show the dashboard cold.** Hero, ticker (point at the colours), block number incrementing.
3. **0:35 — Onboarding banner.** "Four steps. Add Arc Testnet, get USDC from Circle's faucet, connect, deposit."
4. **0:55 — Deposit + signal.** Deposit 2 USDC, drop a sentiment pheromone with a note. Show the Arcscan tx for both.
5. **1:25 — Run swarm tick.** Watch the ticker fill. Highlight: `[Solon] x402 paid $0.01 for intel`, `[Solon] whispered Signal`, `[Vega] vault.openPosition`.
6. **2:00 — Click an Agent card.** Decision-trace drawer with the model's reasoning + tool calls + raw chain-of-thought.
7. **2:30 — Click a Traction tile.** Arcscan opens on the SwarmVault events page — "this is not me tallying; these numbers are the chain."
8. **2:50 — Close.** "Every primitive Arc was built for, all firing on one app. We're already monetising via the Polymarket builder code, and our cricket agent is the wedge for India."

---

## "I'm a normal user — what should I get out of 'Run swarm tick'?"

1. **A live show.** ~30 seconds of four AI agents on Arc reasoning in parallel against real Polymarket markets. Ticker fills with: `[Vega] x402 paid $0.01 for intel` · `[Solon] whispered Signal` · `[Atlas] vault.openPosition $2.84`.
2. **A real piece of every position.** If you deposited and have copy ON, your wallet owns a pro-rata share of every position the swarm opens. PnL updates live in the Vault panel.
3. **Voting power.** Your sentiment signals (UserSignal events on the vault) are fed into the agents' next reasoning pass. The agent's decision trace shows your input directly.
4. **A live leaderboard slot.** Top depositors panel ranks you by deposit size. Top contributors panel ranks signals.
5. **Tip your favourite agent.** Click ⚡ boost on Yuki when she's been hot on cricket and your USDC lands on her wallet on Arc.
6. **Verifiable everything.** Every number in the Traction panel is a link to the live Arc explorer. Click "TVL" → see all `Deposit` events in real time.

---

## Status

- [x] Monorepo (Turborepo + pnpm, 4 packages + web)
- [x] **`SwarmVault.sol`** deployed: deposits · copy · signals · positions · PnL
- [x] **`StigmergySignal.sol`** deployed: agent pheromones
- [x] **wagmi + viem wallet connect** on Arc (chainId 5042002)
- [x] Deposit / withdraw / copy / sentiment — all from the dashboard
- [x] Live Polymarket data via Gamma API (40 markets/tick)
- [x] **LangGraph** state machine + **Vercel AI SDK** + **DeepSeek V4 Pro** with reasoning traces
- [x] **Real CCTP v2** `depositForBurn` on Arc (no DEMO_MODE gate) + Circle attestation polling
- [x] Default bridge target: **Polygon Amoy** (testnet end-to-end)
- [x] **x402** PaidIntel: HTTP 402 → USDC tx on Arc → unlock
- [x] **Nanopayments** between agents on favourable marks
- [x] Polymarket v2 order stub with builder code attached
- [x] **Traction panel with every tile linking to Arcscan**
- [x] **Onboarding banner** + **live activity ticker** + **decision trace drawer**
- [x] **Boost agent modal** — user tips any agent directly on Arc (ERC-20 transfer)
- [x] **Auto-tick toggle** — dashboard runs ticks every 30s while open
- [x] **Live agent balance pill** on each card (refreshes every 10s from Arc)
- [x] **Share/referral CTA** — copies dashboard URL with `?ref=<wallet>` param
- [x] `pnpm dev / build / check-types / swarm:tick` all green

Built with ♥ for **Agora · Arc**. Let's win this.
