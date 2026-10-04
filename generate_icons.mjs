// 產生 PWA 圖示：node generate_icons.mjs（需要本機 Google Chrome；以 Playwright 截圖）
import { chromium } from 'playwright';

const svg = (size, inset) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" fill="#12233a"/>
  <g transform="translate(256 256) scale(${inset}) translate(-256 -256)">
    <circle cx="256" cy="256" r="150" fill="none" stroke="#d9b169" stroke-width="22"/>
    <polygon points="256,126 296,216 386,256 296,296 256,386 216,296 126,256 216,216" fill="#f3eee3"/>
    <circle cx="256" cy="256" r="16" fill="#12233a"/>
  </g>
</svg>`;

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();

async function shot(file, size, inset) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<body style="margin:0">${svg(size, inset)}</body>`);
    await page.screenshot({ path: file, clip: { x: 0, y: 0, width: size, height: size } });
}

await shot('public/icon-512.png', 512, 1);
await shot('public/apple-touch-icon.png', 512, 1);
await shot('public/icon-192.png', 192, 1);
// 可遮罩圖示：主體縮到安全區（中心 80%）內，避免被圓形或圓角遮罩裁掉
await shot('public/icon-maskable-512.png', 512, 0.78);
await browser.close();
console.log('圖示已產生');
