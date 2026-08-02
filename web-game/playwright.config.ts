import { defineConfig, devices } from "@playwright/test";

const env = (globalThis as {
  process?: { env?: { CI?: string; COW_PLAYWRIGHT_BASE_URL?: string } };
}).process?.env;
const ci = env?.CI;
const externalBaseUrl = env?.COW_PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    ...devices["Desktop Chrome"],
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "npm run dev -- --host 127.0.0.1",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !ci,
        timeout: 60_000,
      },
});
