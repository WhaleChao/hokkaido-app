/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const base = '/hokkaido-app/';

// https://vite.dev/config/
export default defineConfig({
    base,
    plugins: [
        react(),
        VitePWA({
            // 更新策略：新版下載好後「通知使用者」，按了才切換（見 src/pwa.ts），不會在旅途中突然換畫面
            registerType: 'prompt',
            injectRegister: false,
            // 沿用舊版檔名，已安裝在主畫面的 App 仍然找得到 manifest
            manifestFilename: 'manifest.json',
            includeAssets: ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'prohibited_rules.json'],
            manifest: {
                id: base,
                name: '旅遊行程',
                short_name: '旅遊行程',
                description: '離線可用的旅遊行程、記帳、票夾與行李清單',
                lang: 'zh-Hant',
                start_url: base,
                scope: base,
                display: 'standalone',
                orientation: 'portrait',
                background_color: '#f6f2ea',
                theme_color: '#12233a',
                icons: [
                    { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
                    { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
                    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,png,svg,json}'],
                navigateFallback: `${base}index.html`,
                cleanupOutdatedCaches: true,
                clientsClaim: true,
                runtimeCaching: [
                    {
                        // 景點背景圖（維基百科縮圖）：看過的離線也還在，最多存 80 張、30 天
                        urlPattern: ({ url }) => url.hostname === 'upload.wikimedia.org',
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'wiki-thumbs',
                            expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
                            cacheableResponse: { statuses: [0, 200] },
                        },
                    },
                ],
            },
        }),
    ],
    test: {
        environment: 'jsdom',
        setupFiles: ['./src/test/setup.ts'],
        include: ['src/**/*.test.{ts,tsx}'],
        css: false,
        restoreMocks: true,
    },
});
