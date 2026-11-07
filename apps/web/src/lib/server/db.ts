import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import path from "node:path";

let cached: Database.Database | null = null;

export function ledgerDbPath(): string {
  const p = process.env.LEDGER_DB_PATH?.trim() || "data/ledger.db";
  // turbopackIgnore: path env-configurado a data/ (gitignored), no trazable.
  return p === ":memory:" ? p : path.resolve(/*turbopackIgnore: true*/ process.cwd(), p);
}

export function getDb(): Database.Database {
  if (cached) return cached;
  const file = ledgerDbPath();
  if (file !== ":memory:") mkdirSync(path.dirname(file), { recursive: true });
  cached = new Database(file);
  cached.pragma("journal_mode = WAL");
  cached.pragma("foreign_keys = ON");
  migrate(cached);
  return cached;
}

function migrate(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      chain_address TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL CHECK (kind IN ('load','withdraw')),
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      status TEXT NOT NULL CHECK (status IN ('pending','approved','rejected','refunded')),
      idempotency_key TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL,
      resolved_at TEXT
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      bucket TEXT NOT NULL CHECK (bucket IN ('available','inEscrow','withdrawing')),
      kind TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      ref TEXT,
      idempotency_key TEXT UNIQUE,
      tx_hash TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agreements_meta (
      id TEXT PRIMARY KEY,
      template INTEGER NOT NULL,
      state TEXT NOT NULL,
      creator_user_id TEXT NOT NULL,
      depositor_user_id TEXT,
      beneficiary_user_id TEXT NOT NULL,
      arbiter_user_id TEXT NOT NULL,
      creator_address TEXT,
      depositor_address TEXT,
      beneficiary_address TEXT,
      arbiter_address TEXT,
      amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
      remaining_cents INTEGER NOT NULL CHECK (remaining_cents >= 0),
      terms_json TEXT NOT NULL,
      terms_hash TEXT NOT NULL,
      outcome_proposer_user_id TEXT,
      proposed_to_beneficiary_cents INTEGER,
      chain_id INTEGER,
      contract_agreement_id INTEGER,
      onchain_pending INTEGER NOT NULL DEFAULT 1,
      tx_hashes TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
}

// Sólo tests: vuelve las tablas a vacío sobre la misma conexión.
export function resetAll(): void {
  const db = getDb();
  db.exec(
    "DELETE FROM ledger_entries; DELETE FROM payments; DELETE FROM agreements_meta; DELETE FROM users;",
  );
}

export function nowIso(): string {
  return new Date().toISOString();
}
