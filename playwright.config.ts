import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
    testDir: './e2e',
    timeout: 60_000,
    retries: 0,
    use: {
        baseURL: 'http://localhost:5173'
    },
    projects: [
        { name: 'Chromium', use: { ...devices['Desktop Chrome'] } }
    ]
})
