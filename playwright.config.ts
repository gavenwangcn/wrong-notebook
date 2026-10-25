import { defineConfig, devices } from '@playwright/test';

// 本机 3000 端口被占用时，可用 E2E_BASE_URL 指向另行启动的开发服务器
const baseURL = process.env.E2E_BASE_URL || 'http://127.0.0.1:3000';

export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 2 : 0,
    workers: process.env.CI ? 1 : undefined,
    reporter: [['html', { host: '0.0.0.0' }]],
    use: {
        baseURL,
        trace: 'on-first-retry',
    },
    webServer: {
        command: process.env.CI ? 'npm run start' : 'npm run dev',
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 120 * 1000,
        // 注册默认关闭，注册流程用例需要开启
        env: { ...process.env as Record<string, string>, ALLOW_REGISTRATION: 'true' },
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],
});
