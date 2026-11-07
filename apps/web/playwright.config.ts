import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke E2E de la landing (M6/M7/M12 de docs/specs/01_ACCEPTANCE_MATRIX.md).
 *
 * Servidor: por defecto `pnpm build && pnpm start` (producción, lo que se prueba
 * en el gate). Para iterar rápido: `E2E_DEV=1 pnpm test:e2e` usa `pnpm dev`.
 * Para apuntar a un servidor ya levantado: `E2E_BASE_URL=http://localhost:3000`.
 */
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";
const useDev = process.env.E2E_DEV === "1";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "es-AR",
    colorScheme: "dark",
    trace: "retain-on-failure",
  },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: useDev ? "pnpm dev -p 3000" : "pnpm build && pnpm start -p 3000",
        url: baseURL,
        reuseExistingServer: true,
        timeout: 240_000,
      },
});
