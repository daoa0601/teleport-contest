import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './test/browser',
    outputDir: '.cache/playwright',
    workers: 1,
    reporter: 'line',
    use: {
        browserName: 'chromium',
    },
    projects: [
        { name: 'dev', use: { baseURL: 'http://127.0.0.1:4173' } },
        { name: 'build', use: { baseURL: 'http://127.0.0.1:4174' } },
    ],
    webServer: [
        {
            command: 'npm run dev -- --port 4173',
            url: 'http://127.0.0.1:4173',
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        },
        {
            command: 'npm run preview -- --port 4174',
            url: 'http://127.0.0.1:4174',
            gracefulShutdown: { signal: 'SIGTERM', timeout: 5000 },
        },
    ],
});
