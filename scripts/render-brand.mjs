// Renders brand SVGs to PNG using Chromium (Playwright).
// Usage: node scripts/render-brand.mjs
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = resolve(import.meta.dirname, '..');
const font = (p) => readFileSync(resolve(root, 'node_modules', p)).toString('base64');
const css = `
@font-face{font-family:'Inter Tight Variable';src:url(data:font/woff2;base64,${font('@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2')}) format('woff2');font-weight:100 900}
@font-face{font-family:'Instrument Serif';font-style:italic;src:url(data:font/woff2;base64,${font('@fontsource/instrument-serif/files/instrument-serif-latin-400-italic.woff2')}) format('woff2')}
html,body{margin:0;background:transparent}svg{display:block}`;

const jobs = [
  ['assets/brand/app-icon.svg', 'assets/brand/app-icon-1024.png', 1024, 1024],
  ['assets/brand/app-icon.svg', 'assets/brand/favicon-32.png', 32, 32],
  ['assets/brand/app-icon.svg', 'public/icon-192.png', 192, 192],
  ['assets/brand/logo-horizontal.svg', 'assets/brand/logo-horizontal.png', 1040, 280],
  ['assets/brand/logo-vertical.svg', 'assets/brand/logo-vertical.png', 600, 600],
  ['assets/brand/logo-mark.svg', 'assets/brand/logo-mark.png', 512, 512],
  // The Windows installer (NSIS) only takes 24-bit BMP: these are written as .bmp, see toBmp below.
  ['assets/brand/installer-sidebar.svg', 'src-tauri/installer/sidebar.bmp', 164, 314],
  ['assets/brand/installer-header.svg', 'src-tauri/installer/header.bmp', 150, 57],
];

/** Uncompressed 24-bit BMP (bottom-up rows padded to 4 bytes) from RGBA pixels. */
function toBmp(rgba, w, h) {
  const row = Math.ceil((w * 3) / 4) * 4;
  const out = Buffer.alloc(54 + row * h);
  out.write('BM', 0);
  out.writeUInt32LE(out.length, 2);
  out.writeUInt32LE(54, 10);
  out.writeUInt32LE(40, 14);
  out.writeInt32LE(w, 18);
  out.writeInt32LE(h, 22);
  out.writeUInt16LE(1, 26);
  out.writeUInt16LE(24, 28);
  out.writeUInt32LE(row * h, 34);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4, o = 54 + (h - 1 - y) * row + x * 3;
      out[o] = rgba[i + 2]; out[o + 1] = rgba[i + 1]; out[o + 2] = rgba[i];
    }
  }
  return out;
}

// E2E_CHANNEL=chrome uses the installed Chrome, like scripts/e2e.mjs, instead of downloading Playwright's browser.
const browser = await chromium.launch({ channel: process.env.E2E_CHANNEL || undefined });
const page = await browser.newPage();
for (const [src, out, w, h] of jobs) {
  const svg = readFileSync(resolve(root, src), 'utf8').replace('<svg ', `<svg width="${w}" height="${h}" `);
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>${css}</style>${svg}`);
  await page.evaluate(() => document.fonts.ready);
  const png = await page.locator('svg').screenshot({ omitBackground: !out.endsWith('.bmp') });
  if (out.endsWith('.bmp')) {
    const rgba = await page.evaluate(async ({ b64, w, h }) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = Object.assign(document.createElement('canvas'), { width: w, height: h });
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0, w, h);
      return Array.from(g.getImageData(0, 0, w, h).data);
    }, { b64: png.toString('base64'), w, h });
    writeFileSync(resolve(root, out), toBmp(rgba, w, h));
  } else writeFileSync(resolve(root, out), png);
  console.log('✓', out);
}
await browser.close();
