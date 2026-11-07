---
name: avalanche-escrow
description: Design, implement or test ERC-20 escrow contracts on Avalanche C-Chain using Solidity, Foundry, OpenZeppelin and Viem.
---

# Avalanche escrow

Use Avalanche Fuji (chain ID 43113, RPC https://api.avax-test.network/ext/bc/C/rpc) for development; confirm token address and decimals on that network. Never use real funds or deploy without authorization.

Define a state machine CREATED → FUNDED → RELEASED / REFUNDED / DISPUTED with explicit transitions, depositant, beneficiary and arbiter permissions, deadlines, dispute resolution and failure recovery. Explain who can act, trusted authorities, centralized powers, and what happens when a party disappears; never imply off-chain facts are automatically verified.

Use currently supported OpenZeppelin contracts and SafeERC20 for token handling; apply checks-effects-interactions and appropriate reentrancy protections. Protect against repeated funding, double withdrawal, invalid state transitions and unauthorized releases. Decide explicitly whether fee-on-transfer, rebasing and nonstandard tokens are supported; do not assume USDC and ARGt have the same decimals. Emit events for meaningful transitions.

Use Foundry tests for authorized and unauthorized calls, fund conservation, time boundaries, refunds, disputes, adversarial ERC-20 behavior, fuzzing and state invariants. Exercise failure paths and do not count simulated outcomes as onchain evidence.

For Viem integrate explicit chain, contract addresses, wallet connection, approvals, receipt confirmations and human-readable transaction errors. Review official Avalanche and OpenZeppelin documentation for version-specific behavior.
