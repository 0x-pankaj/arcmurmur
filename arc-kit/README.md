<div align="center">

# arc-kit ⚡

**Composable Arc + Circle primitives for AI-agent apps.**

x402 (client **+** server) · in-browser session keys · CCTP v2 · ERC-8004 identity · on-chain stigmergy coordination.

`viem`-only. No paymaster, no bundler, no account-abstraction infra. Every primitive produces a **real, verifiable Arc transaction**.

</div>

---

## Why this exists

The `circlefin/arc-*` reference repos give you the *engine parts* — a CCTP burn here, a 402 handler there — mostly **server-side and one primitive at a time**. When you sit down to build an actual agent app on Arc, you still have to write the wiring, the browser UX, and the composition yourself.

**arc-kit is that missing layer.** It's a small set of dependency-light files you copy into your project (or import) to get the patterns that aren't in the reference repos:

- **Browser-driven x402** — a wagmi/viem client that walks `probe → 402 → pay → verify → 200`, no SDK.
- **In-browser session keys** — sign once, then act repeatedly with no MetaMask prompt; budget + expiry bounded; revoke-and-sweep. No ERC-4337 stack.
- **CCTP v2** — `approve → depositForBurn → poll attestation`, end to end.
- **ERC-8004** — `register → lookup → read metadata` against Arc's pre-deployed registry.
- **Stigmergy** — a coordination contract + helpers so multiple agents coordinate purely through on-chain events (no orchestrator, no message bus).

Extracted from **[ArcMurmur](../README.md)** (Agora hackathon, "Where AI agents make markets"), where all of this runs live.

> **Dogfooded.** The ArcMurmur app imports this kit directly — it's the source
> of truth, not a parallel copy:
> - `packages/agents/src/tools/paidIntel.ts` → `arc-kit/x402-client`
> - `apps/web/app/api/intel/[slug]/route.ts` → `arc-kit/x402-server`
> - `apps/web/lib/sessionKey.ts` → `arc-kit/session-keys`

---

## Install

```bash
# the kit's only runtime dependency is viem
npm i viem
# then copy the arc-kit/src files into your project, or add this folder
# to your workspace and import from "arc-kit"
cp arc-kit/.env.example .env   # all values default to Arc Testnet
```

> **No build step.** These are plain TypeScript modules. Drop them into a
> Next.js / Node / Vite project that already transpiles TS.

---

## The primitives

| File | What you get |
| --- | --- |
| [`src/chain.ts`](src/chain.ts) | Arc Testnet `viem` chain, well-known addresses (USDC, CCTP, ERC-8004), client factories, Arcscan helpers. **Configure Arc once, here.** |
| [`src/x402-client.ts`](src/x402-client.ts) | `payAndUnlock()` — pay-to-unlock any gated endpoint. Works for an agent EOA *or* a MetaMask user. |
| [`src/x402-server.ts`](src/x402-server.ts) | `createX402Handler()` — gate any Next.js route behind a USDC payment on Arc. |
| [`src/session-keys.ts`](src/session-keys.ts) | In-browser session keys: generate, fund (one signature), `sessionSend()` with no prompt, `sessionSweepUSDC()` on revoke. |
| [`src/cctp.ts`](src/cctp.ts) | `depositForBurnFromArc()` + `pollAttestation()` — real CCTP v2 cross-chain USDC. |
| [`src/stigmergy.ts`](src/stigmergy.ts) | `postSignal()` / `readRecentSignals()` — agent coordination via on-chain events. |
| [`src/erc8004.ts`](src/erc8004.ts) | `registerAgentIdentity()` / `lookupAgentId()` — on-chain agent identities. |
| [`contracts/StigmergySignal.sol`](contracts/StigmergySignal.sol) | The coordination contract. Deploy it once; ~60 lines. |

---

## Quick recipes

### 1. x402 — gate a route, then pay for it

**Server** (`app/api/intel/[slug]/route.ts`):

```ts
import { createX402Handler } from "arc-kit/x402-server";

export const GET = createX402Handler({
  priceUsdc: "0.01",
  payTo: process.env.INTEL_RECEIVER as `0x${string}`,
  unlock: async () => ({ intel: "the gated payload" }),
});
```

**Client** (agent or browser):

```ts
import { payAndUnlock } from "arc-kit/x402-client";
import { arcPublicClient, arcWalletClient } from "arc-kit/chain";

const res = await payAndUnlock({
  wallet: arcWalletClient(process.env.PRIVATE_KEY as `0x${string}`),
  publicClient: arcPublicClient(),
  url: "https://your.app/api/intel/btc-150k",
});
// res.txHash → the on-chain USDC payment, verifiable on Arcscan
// res.data   → the unlocked payload
```

### 2. Session keys — sign once, act many times (no popups)

```ts
import {
  generateSessionKey, fundingCall, sessionSend, sessionSweepUSDC, saveSession,
} from "arc-kit/session-keys";
import { encodeFunctionData } from "viem";

// 1. fresh key in the browser
const sk = generateSessionKey();

// 2. ONE MetaMask tx funds it (send fundingCall via your wagmi hook)
const { to, data } = fundingCall(sk.address, 500_000n); // 0.5 USDC budget
// const hash = await writeContractAsync({ to, data })  ← user signs once

// 3. now act with NO prompt
const rec = { owner, privateKey: sk.privateKey, address: sk.address,
  expiresAt: Date.now() + 3_600_000, budgetMicro: "500000", spentMicro: "0", autoActions: 0 };
saveSession(rec);
await sessionSend(rec, stigmergyAddr, encodeFunctionData({ /* post(...) */ }));

// 4. done? sweep dust back to the user
await sessionSweepUSDC(rec);
```

### 3. CCTP v2 — burn USDC on Arc, mint on Polygon

```ts
import { depositForBurnFromArc } from "arc-kit/cctp";
import { arcPublicClient, arcWalletClient } from "arc-kit/chain";

const r = await depositForBurnFromArc({
  wallet: arcWalletClient(process.env.PRIVATE_KEY as `0x${string}`),
  publicClient: arcPublicClient(),
  amountUsdc: 1.0,
  destination: "polygon", // or "amoy", or a domain number
});
// r.burnTxHash → real depositForBurn on Arc; r.attestation → Circle's signed msg
```

### 4. Stigmergy — coordinate agents through the chain

```ts
import { postSignal, readRecentSignals } from "arc-kit/stigmergy";
import { arcPublicClient, arcWalletClient } from "arc-kit/chain";

const C = process.env.STIGMERGY_CONTRACT as `0x${string}`;

await postSignal(arcWalletClient(key), C, {
  agentName: "Vega", marketSlug: "btc-150k",
  probBps: 1200, convictionBps: 6500, action: 1, sizeUsdc: 1_000_000,
  rationale: "market underpricing the rally",
});

const swarmMemory = await readRecentSignals(arcPublicClient(), C);
// every other agent reads this next tick — no message bus
```

### 5. ERC-8004 — give an agent an on-chain identity

```ts
import { registerAgentIdentity } from "arc-kit/erc8004";
import { arcPublicClient, arcWalletClient } from "arc-kit/chain";

const meta = "data:application/json;base64," +
  Buffer.from(JSON.stringify({ name: "Vega", agent_type: "trading" })).toString("base64");

await registerAgentIdentity({
  wallet: arcWalletClient(key),
  publicClient: arcPublicClient(),
  metadataURI: meta, // inline data: URI — no IPFS needed
});
```

---

## Deploy the Stigmergy contract

It's a ~60-line contract with no constructor args. Deploy with whatever you use
(Hardhat / Foundry). Example with `viem`:

```ts
import { arcWalletClient, arcPublicClient } from "arc-kit/chain";
// compile StigmergySignal.sol → { abi, bytecode }, then:
const hash = await arcWalletClient(key).deployContract({ abi, bytecode });
const { contractAddress } = await arcPublicClient().waitForTransactionReceipt({ hash });
// set STIGMERGY_CONTRACT=<contractAddress> in your .env
```

> ERC-8004 registries and CCTP contracts are **already deployed by Arc** — you
> only ever deploy your own `StigmergySignal`.

---

## What's intentionally minimal

This is a starter kit, not a framework. A few places to harden for production:

- **x402 server** verifies the tx exists + succeeded. Also assert the decoded
  `transfer(payTo, ≥amount)`, a recent block, and add a replay guard so one
  payment unlocks once.
- **Session keys** are bounded by budget + expiry (good for low-value, high-
  frequency actions). For larger budgets, move to ERC-4337 / a real validator.
- **`getLogs`** windows are bounded constants; some RPCs cap the block range —
  chunk if you scan deep history.

---

<div align="center">

Built for **[Agora · Arc](https://agora.thecanteenapp.com/)**. See it running in **[ArcMurmur](../README.md)**.

</div>
