import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "src/**/*.test.ts"],
    env: {
      // Modo sin-chain para tests: sin escrow/token configurados la capa
      // onchain queda inactiva y el estado vive en agreements_meta.
      LEDGER_DB_PATH: ":memory:",
      DEMO_KEYSTORE_PATH: "data/test-demo-keys.json",
      NEXT_PUBLIC_ESCROW_ADDRESS: "",
      NEXT_PUBLIC_TOKEN_ADDRESS: "",
      NEXT_PUBLIC_TREASURY_ADDRESS: "",
      NEXT_PUBLIC_FUJI_RPC: "",
      NEXT_PUBLIC_CHAIN_ID: "31337",
      DEMO_FUNDER_KEY: "",
    },
  },
});
