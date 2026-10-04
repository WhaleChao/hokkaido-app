import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

export const BASE = '/hokkaido-app/';

/** 啟動 vite preview（吃 dist/ 的正式建置，含 Service Worker）。回傳 { url, stop }。 */
export async function startPreview(port, root = process.cwd()) {
    const child = spawn(process.execPath, [`${root}/node_modules/vite/bin/vite.js`, 'preview', '--port', String(port), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: ['ignore', 'pipe', 'pipe'] });
    let log = '';
    child.stdout.on('data', (d) => (log += d));
    child.stderr.on('data', (d) => (log += d));
    const url = `http://127.0.0.1:${port}${BASE}`;
    for (let i = 0; i < 60; i++) {
        try {
            const r = await fetch(url);
            if (r.ok) return { url, stop: () => child.kill('SIGTERM') };
        } catch {
            /* 還沒起來 */
        }
        await new Promise((r) => setTimeout(r, 250));
    }
    child.kill('SIGTERM');
    throw new Error('preview 伺服器沒有啟動：' + log);
}

export async function launch(opts = {}) {
    // 使用本機已安裝的 Google Chrome（CI 若沒有，可設 E2E_CHANNEL=chromium 並先 npx playwright install chromium）
    return chromium.launch({ channel: process.env.E2E_CHANNEL || 'chrome', ...opts });
}

export function makeChecker() {
    const results = [];
    return {
        results,
        async step(name, fn) {
            try {
                await fn();
                results.push({ name, ok: true });
                console.log(`  ✓ ${name}`);
            } catch (e) {
                results.push({ name, ok: false, error: String(e.message ?? e) });
                console.log(`  ✗ ${name}\n      ${String(e.message ?? e).split('\n')[0]}`);
            }
        },
        done() {
            const failed = results.filter((r) => !r.ok);
            console.log(`\n${results.length - failed.length}/${results.length} 通過`);
            return failed.length === 0;
        },
    };
}
