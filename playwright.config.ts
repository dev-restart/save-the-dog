import { defineConfig } from '@playwright/test';

export default defineConfig({
	webServer: { command: 'npm run dev -- --host 127.0.0.1 --port 4173', port: 4173, reuseExistingServer: true },
	testMatch: '**/*.e2e.{ts,js}'
});
