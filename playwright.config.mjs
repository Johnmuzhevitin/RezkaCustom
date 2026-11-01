import { defineConfig } from '@playwright/test';
import { resolve } from 'node:path';
process.env.PLAYWRIGHT_BROWSERS_PATH ||= resolve('.browser-binaries');
export default defineConfig({
    testDir: './tests/browser',
    timeout: 30000,
    workers: 1,
    reporter: 'list',
    use: { trace: 'retain-on-failure' }
});
