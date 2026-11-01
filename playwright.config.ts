import { defineConfig, devices } from '@playwright/test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Starts its own app on a fresh database, so runs never touch the dev server or its data.
export default defineConfig({
	testDir: './tests/e2e',
	fullyParallel: false,
	workers: 1,
	use: { baseURL: 'http://localhost:4180', trace: 'retain-on-failure' },
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
	webServer: {
		command: 'pnpm dev --port 4180 --strictPort',
		url: 'http://localhost:4180/health',
		reuseExistingServer: false,
		timeout: 120000,
		env: {
			NODE_ENV: 'development',
			ORIGIN: 'http://localhost:4180',
			DATA_DIR: join(tmpdir(), `capstone-playwright-${Date.now()}`)
		}
	}
});
