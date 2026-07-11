import { defineConfig, devices } from "@playwright/test";

// UI tests run against a running Flight Scanner instance. Use a mock-mode
// container (FLIGHT_SCANNER_MOCK=1) for deterministic, offline results:
//   docker run -d -e FLIGHT_SCANNER_MOCK=1 -p 8422:8000 flight-scanner
//   BASE_URL=http://localhost:8422 npx playwright test
export default defineConfig({
  testDir: "./tests",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  reporter: [["list"]],
  use: {
    baseURL: process.env.BASE_URL || "http://localhost:8422",
    launchOptions: {
      args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"],
    },
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1400, height: 900 } } },
    { name: "mobile", use: { ...devices["Pixel 5"] } },
  ],
});
