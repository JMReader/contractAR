import {
  createPublicClient,
  defineChain,
  http,
  parseAbi,
  type Address,
  type Chain,
  type PublicClient,
} from "viem";
import { avalancheFuji } from "viem/chains";

// Firmas EXACTAS de docs/specs/03_INTERFACE_CONTRACT.md §1. Si shared/abi llega
// con una ABI sana distinta, prevalece la de fondos (H1) y se reetiqueta esto.
export const ESCROW_ABI = parseAbi([
  "function create(uint8 template, address depositor, address beneficiary, address arbiter, uint256 deposit, bytes32 termsHash, uint40 acceptDeadline, uint40 reviewDeadline) returns (uint256 id)",
  "function accept(uint256 id)",
  "function cancel(uint256 id)",
  "function fund(uint256 id)",
  "function proposeOutcome(uint256 id, uint256 toBeneficiary)",
  "function acceptOutcome(uint256 id)",
  "function dispute(uint256 id) returns (uint256 disputeId)",
  "function rule(uint256 id, uint256 toBeneficiary, uint256 toDepositor)",
  "function refundAfterTimeout(uint256 id)",
  "function agreements(uint256 id) view returns ((uint8 template, uint8 state, address creator, address depositor, address beneficiary, address arbiter, uint256 deposit, uint256 remaining, bytes32 termsHash, uint40 acceptDeadline, uint40 reviewDeadline, address outcomeProposer, uint256 proposedToBeneficiary, uint256 disputeId) agreement)",
  "event AgreementCreated(uint256 indexed id, uint8 template, address depositor, address beneficiary, uint256 deposit, bytes32 termsHash)",
  "event Funded(uint256 indexed id, uint256 amount)",
  "event Settled(uint256 indexed id, uint256 toBeneficiary, uint256 fee, uint256 toDepositor)",
  "event Dispute(uint256 indexed id, uint256 indexed disputeId)",
]);

export const ERC20_ABI = parseAbi([
  "function mint(address to, uint256 amount)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function transferFrom(address from, address to, uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function decimals() pure returns (uint8)",
]);

export interface ChainConfig {
  rpcUrl: string;
  chainId: number;
  escrowAddress: Address | null;
  tokenAddress: Address | null;
  treasuryAddress: Address | null;
  enabled: boolean;
}

function env(name: string): string | undefined {
  const v = process.env[name]?.trim();
  return v ? v : undefined;
}

export function chainConfig(): ChainConfig {
  const rpcUrl = env("CHAIN_RPC_URL") ?? env("NEXT_PUBLIC_FUJI_RPC") ?? "http://127.0.0.1:8545";
  const chainId = Number(env("NEXT_PUBLIC_CHAIN_ID") ?? 31337);
  const escrowAddress = (env("NEXT_PUBLIC_ESCROW_ADDRESS") ?? null) as Address | null;
  const tokenAddress = (env("NEXT_PUBLIC_TOKEN_ADDRESS") ?? null) as Address | null;
  const treasuryAddress = (env("NEXT_PUBLIC_TREASURY_ADDRESS") ?? null) as Address | null;
  return {
    rpcUrl,
    chainId,
    escrowAddress,
    tokenAddress,
    treasuryAddress,
    enabled: Boolean(escrowAddress && tokenAddress),
  };
}

export function getChain(cfg: ChainConfig = chainConfig()): Chain {
  if (cfg.chainId === avalancheFuji.id) return avalancheFuji;
  return defineChain({
    id: cfg.chainId,
    name: cfg.chainId === 31337 ? "anvil" : `chain-${cfg.chainId}`,
    nativeCurrency: { name: "AVAX", symbol: "AVAX", decimals: 18 },
    rpcUrls: { default: { http: [cfg.rpcUrl] } },
    testnet: true,
  });
}

let cachedClient: { key: string; client: PublicClient } | null = null;

export function getPublicClient(cfg: ChainConfig = chainConfig()): PublicClient {
  const key = `${cfg.rpcUrl}|${cfg.chainId}`;
  if (cachedClient?.key === key) return cachedClient.client;
  const client = createPublicClient({ chain: getChain(cfg), transport: http(cfg.rpcUrl) });
  cachedClient = { key, client };
  return client;
}

// Convención demo: 1 tARGt (18 dec) = 1 ARS = 100 centavos.
const CENTS_PER_TOKEN = 100n;
const TOKEN_DECIMALS = 18n;

export function arsCentsToTokenUnits(cents: number): bigint {
  return BigInt(cents) * 10n ** TOKEN_DECIMALS / CENTS_PER_TOKEN;
}

export function tokenUnitsToArsCents(units: bigint): number {
  const cents = units / (10n ** TOKEN_DECIMALS / CENTS_PER_TOKEN);
  return Number(cents);
}

// fee = floor(toBeneficiary * 100 / 10_000) — D5, mismo orden de operaciones.
export function feeCents(toBeneficiaryCents: number): number {
  return Math.floor((toBeneficiaryCents * 100) / 10_000);
}
