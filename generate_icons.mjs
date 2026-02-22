import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <style>
    body { margin: 0; padding: 0; background: transparent; }
  </style>
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4facfe"/>
      <stop offset="100%" stop-color="#00f2fe"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="0" fill="url(#bg)"/>
  <circle cx="256" cy="256" r="150" fill="none" stroke="white" stroke-width="28"/>
  <polygon points="256,126 296,216 386,256 296,296 256,386 216,296 126,256 216,216" fill="white"/>
  <circle cx="256" cy="256" r="16" fill="#00f2fe"/>
</svg>`;

    await page.setContent(svg);

    // 512x512
    await page.setViewportSize({ width: 512, height: 512 });
    await page.screenshot({ path: 'public/icon-512.png', clip: { x: 0, y: 0, width: 512, height: 512 }, omitBackground: true });
    await page.screenshot({ path: 'public/apple-touch-icon.png', clip: { x: 0, y: 0, width: 512, height: 512 }, omitBackground: true });

    // 192x192
    await page.setContent(svg.replace(/width="512" height="512"/g, 'width="192" height="192"'));
    await page.setViewportSize({ width: 192, height: 192 });
    await page.screenshot({ path: 'public/icon-192.png', clip: { x: 0, y: 0, width: 192, height: 192 }, omitBackground: true });

    await browser.close();
    console.log("Assets Generated!");
})();
