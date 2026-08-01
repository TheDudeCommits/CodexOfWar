import { defineConfig, devices } from "@playwright/test";

const ci = (globalThis as { process?: { env?: { CI?: string } } }).process?.env?.CI;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !ci,
    timeout: 60_000,
  },
});
