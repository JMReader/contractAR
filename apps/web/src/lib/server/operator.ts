import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  createWalletClient,
  http,
  parseEther,
  parseEventLogs,
  type Abi,
  type Account,
  type Address,
  type Hex,
  type TransactionReceipt,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { toHumanError } from "../../../../../shared/errors";
import { ApiError } from "./http";
import { chainConfig, getChain, getPublicClient, ERC20_ABI } from "./chain";
import { setChainAddress } from "./ledger";

// Clave pública de desarrollo de Anvil/Hardhat (cuenta #0). Sólo se usa como
// funder/gas+mint cuando el RPC apunta a localhost — nunca en Fuji ni mainnet.
const ANVIL_DEV_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

interface KeystoreData {
  users: Record<string, { address: Address; privateKey: Hex; createdAt: string }>;
}

function keystorePath(): string {
  const p = process.env.DEMO_KEYSTORE_PATH?.trim() || "data/demo-keys.json";
  // turbopackIgnore: path env-configurado a data/ (gitignored), no trazable.
  return path.resolve(/*turbopackIgnore: true*/ process.cwd(), p);
}

function loadKeystore(): KeystoreData {
  const file = keystorePath();
  if (!existsSync(/*turbopackIgnore: true*/ file)) return { users: {} };
  try {
    return JSON.parse(readFileSync(/*turbopackIgnore: true*/ file, "utf8")) as KeystoreData;
  } catch {
    return { users: {} };
  }
}

function saveKeystore(data: KeystoreData): void {
  const file = keystorePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2), { mode: 0o600 });
}

// Cuenta efímera por usuario demo; la clave vive sólo en el keystore local
// (data/, gitignored) y jamás sale del servidor.
export function ensureUserAccount(userId: string): { address: Address } {
  const ks = loadKeystore();
  const existing = ks.users[userId];
  if (existing) {
    setChainAddress(userId, existing.address);
    return { address: existing.address };
  }
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  ks.users[userId] = {
    address: account.address,
    privateKey,
    createdAt: new Date().toISOString(),
  };
  saveKeystore(ks);
  setChainAddress(userId, account.address);
  return { address: account.address };
}

function accountForUser(userId: string): Account {
  const { address } = ensureUserAccount(userId);
  const ks = loadKeystore();
  const rec = ks.users[userId];
  if (!rec || rec.address !== address) {
    throw new ApiError("InternalError", 500, "Keystore inconsistente para el usuario.");
  }
  return privateKeyToAccount(rec.privateKey);
}

// Funder de demo = dueño del token mock (deployer). Sin él no hay mint ni gas.
export function funderAccount(): Account | null {
  const envKey = process.env.DEMO_FUNDER_KEY?.trim();
  if (envKey) return privateKeyToAccount(envKey as Hex);
  const { rpcUrl } = chainConfig();
  if (/^https?:\/\/(127\.0\.0\.1|localhost)/.test(rpcUrl)) {
    return privateKeyToAccount(ANVIL_DEV_KEY);
  }
  return null;
}

export interface ContractCall {
  to: Address;
  abi: Abi;
  functionName: string;
  args?: readonly unknown[];
  value?: bigint;
}

function walletFor(account: Account) {
  const cfg = chainConfig();
  return createWalletClient({
    account,
    chain: getChain(cfg),
    transport: http(cfg.rpcUrl),
  });
}

export interface SendResult {
  txHash: Hex;
  receipt: TransactionReceipt;
}

async function sendAndWait(account: Account, call: ContractCall): Promise<SendResult> {
  const client = getPublicClient();
  let txHash: Hex;
  try {
    txHash = await walletFor(account).writeContract({
      address: call.to,
      abi: call.abi,
      functionName: call.functionName,
      args: (call.args ?? []) as never,
      value: call.value,
    });
  } catch (err) {
    throw new ApiError("OnchainError", 502, toHumanError(err));
  }
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status !== "success") {
    throw new ApiError("OnchainError", 502, "La transacción fue rechazada por el contrato.");
  }
  return { txHash, receipt };
}

// Firma con la clave del usuario que ocupa el rol (la resolución rol→usuario se
// hace en agreements.ts contra la metadata del acuerdo).
export async function signAndSend(userId: string, call: ContractCall): Promise<SendResult> {
  const account = accountForUser(userId);
  await ensureGas(account.address);
  return sendAndWait(account, call);
}

// Firma como dueño/funder (mint del token mock, fondos de gas).
export async function signAsOwner(call: ContractCall): Promise<SendResult> {
  const funder = funderAccount();
  if (!funder) {
    throw new ApiError(
      "OnchainError",
      502,
      "Sin cuenta funder configurada (DEMO_FUNDER_KEY) para firmar operaciones de plataforma.",
    );
  }
  return sendAndWait(funder, call);
}

const MIN_GAS = parseEther("0.005");
const GAS_TOPUP = parseEther("0.05");

async function ensureGas(address: Address): Promise<void> {
  const client = getPublicClient();
  const balance = await client.getBalance({ address });
  if (balance >= MIN_GAS) return;
  const funder = funderAccount();
  if (!funder) {
    throw new ApiError(
      "OnchainError",
      502,
      "La cuenta demo no tiene gas y no hay funder configurado (DEMO_FUNDER_KEY).",
    );
  }
  const wallet = walletFor(funder);
  const txHash = await wallet.sendTransaction({ to: address, value: GAS_TOPUP });
  await client.waitForTransactionReceipt({ hash: txHash });
}

// Antes de fund: garantiza tARGt (mint del owner si falta) y approve al escrow.
export async function ensureFundable(
  depositorUserId: string,
  amountUnits: bigint,
): Promise<{ txHashes: Hex[] }> {
  const cfg = chainConfig();
  if (!cfg.tokenAddress || !cfg.escrowAddress) {
    throw new ApiError("OnchainError", 502, "Token o escrow no configurados.");
  }
  const client = getPublicClient();
  const { address: depositor } = ensureUserAccount(depositorUserId);
  const txHashes: Hex[] = [];

  const balance = (await client.readContract({
    address: cfg.tokenAddress,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: [depositor],
  })) as bigint;
  if (balance < amountUnits) {
    const res = await signAsOwner({
      to: cfg.tokenAddress,
      abi: ERC20_ABI,
      functionName: "mint",
      args: [depositor, amountUnits - balance],
    });
    txHashes.push(res.txHash);
  }

  const allowance = (await client.readContract({
    address: cfg.tokenAddress,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: [depositor, cfg.escrowAddress],
  })) as bigint;
  if (allowance < amountUnits) {
    const res = await signAndSend(depositorUserId, {
      to: cfg.tokenAddress,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [cfg.escrowAddress, amountUnits],
    });
    txHashes.push(res.txHash);
  }
  return { txHashes };
}

export function eventsFromReceipt<TName extends string>(
  receipt: TransactionReceipt,
  abi: Abi,
  eventName: TName,
) {
  return parseEventLogs({ abi, logs: receipt.logs, eventName });
}
