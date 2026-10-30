// End-to-end check of the built app in headless Chromium.
//
//   npm run build && npm run test:e2e
//
// Serves dist/ with `vite preview`, then walks the core workflows:
// save a video → link a technique → upload images to an art direction →
// reload (persistence) → search → export backup → erase → restore.
// Writes screenshots to docs/screenshots/ when SCREENSHOTS=1.
// Test images are generated on the fly (they are fixtures, not seed data).

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4179;
const BASE = `http://127.0.0.1:${PORT}/`;
const SHOTS = process.env.SCREENSHOTS === '1';
const shotDir = join(root, 'docs', 'screenshots');
if (SHOTS) mkdirSync(shotDir, { recursive: true });

// ── tiny PNG encoder for gradient fixtures
const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(w, h, [a, b, c]) {
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * 3 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const t = x / w;
      const u = y / h;
      const i = y * (w * 3 + 1) + 1 + x * 3;
      for (let k = 0; k < 3; k++) {
        const v = a[k] * (1 - t) * (1 - u) + b[k] * t * (1 - u) + c[k] * u;
        // soft vignette + grain so palettes look like frames, not flat swatches
        const vig = 1 - 0.5 * ((t - 0.5) ** 2 + (u - 0.5) ** 2);
        raw[i + k] = Math.max(0, Math.min(255, v * vig + (Math.random() - 0.5) * 14));
      }
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const FIXTURES = [
  ['fixture-dusk-wide.png', 480, 200, [[20, 24, 38], [190, 90, 60], [8, 8, 12]]],
  ['fixture-sodium-tall.png', 240, 400, [[240, 160, 60], [60, 30, 20], [10, 10, 10]]],
  ['fixture-teal-square.png', 320, 320, [[20, 90, 100], [210, 200, 180], [15, 25, 30]]],
  ['fixture-mono-portrait.png', 270, 360, [[200, 200, 196], [70, 70, 68], [20, 20, 20]]],
  ['fixture-neon-wide.png', 480, 270, [[30, 10, 60], [240, 40, 140], [10, 200, 220]]],
  ['fixture-film-4x3.png', 400, 300, [[220, 190, 150], [120, 70, 50], [30, 22, 18]]],
].map(([name, w, h, colors]) => ({ name, mimeType: 'image/png', buffer: png(w, h, colors) }));

// ── harness
const failures = [];
let page;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures.push(name);
    console.log(`  ✗ ${name}\n    ${e.message.split('\n').slice(0, 3).join('\n    ')}`);
    mkdirSync(join(root, 'test-results'), { recursive: true });
    await page?.screenshot({ path: join(root, 'test-results', `fail-${failures.length}.png`) }).catch(() => {});
  }
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const server = spawn(process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js'), 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], { cwd: root, stdio: 'pipe' });
process.on('exit', () => server.kill());
await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('preview server did not start')), 20000);
  server.stdout.on('data', (d) => d.toString().includes(String(PORT)) && (clearTimeout(t), resolve()));
});

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 960 }, acceptDownloads: true });
page = await ctx.newPage();
const consoleErrors = [];
page.on('console', (m) => m.type() === 'error' && !/i\.ytimg\.com|ERR_|net::/.test(m.text()) && consoleErrors.push(m.text()));
page.on('pageerror', (e) => consoleErrors.push(e.message));
const go = (hash) => page.goto(`${BASE}#${hash}`);
const shot = async (name, full = true) => SHOTS && page.screenshot({ path: join(shotDir, `${name}.jpg`), type: 'jpeg', quality: 80, fullPage: full });

console.log('FRAMEWORK e2e');

await step('home loads with seeded library and five pending references', async () => {
  await go('/');
  await page.getByText('Waiting for inspection').waitFor();
  const pending = await page.locator('text=Pending inspection').count();
  expect(pending >= 5, `expected ≥5 pending badges, got ${pending}`);
});

let videoUrl = '';
await step('save a new video reference (with duplicate detection)', async () => {
  await page.getByRole('button', { name: 'Save a video' }).first().click();
  await page.getByPlaceholder('https://www.instagram.com/reel/…').fill('https://www.instagram.com/reel/DeP2abcBrB1/?igsh=abc');
  await page.getByText('Already saved as').waitFor();
  await page.getByPlaceholder('https://www.instagram.com/reel/…').fill('https://vimeo.com/76979871');
  await page.getByPlaceholder('@handle').fill('@test.editor');
  await page.getByPlaceholder(/What is it\?|vimeo/).fill('Night drive test reference');
  await page.getByRole('button', { name: 'Save reference' }).click();
  await page.waitForURL(/#\/videos\/vid_/);
  videoUrl = page.url();
  await page.getByText('Pending inspection — nothing about this video has been observed yet.').waitFor();
});

await step('link an existing technique via alias instead of creating a duplicate', async () => {
  const picker = page.getByLabel('Search techniques').first();
  await picker.fill('swish pan');
  await page.getByRole('button', { name: /Whip Pan Transition/ }).first().click();
  await page.getByRole('link', { name: 'Whip Pan Transition' }).first().waitFor();
  await page.getByLabel('Timestamp').first().fill('00:07');
  await page.getByLabel('Timestamp').first().blur();
});

await step('classify: assign genre and art direction', async () => {
  const dir = page.locator('label:has-text("Art directions") input').first();
  await dir.fill('Analog');
  await page.getByRole('button', { name: 'Analog film' }).click();
});

await step('upload frames to the video (drag-drop input)', async () => {
  await page.getByTestId('image-input').first().setInputFiles(FIXTURES.slice(0, 3));
  await page.getByText('Saved 3 images').waitFor({ timeout: 15000 });
  await page.locator('[data-asset-id]').nth(2).waitFor();
});
await shot('video-detail');

await step('upload images into an art direction moodboard', async () => {
  await go('/art-directions/ad_analog_film');
  await page.getByRole('heading', { name: 'Moodboard' }).waitFor();
  await page.locator('input[type=file][accept="image/*"]').last().setInputFiles(FIXTURES);
  await page.getByText(/Saved 6 images/).waitFor({ timeout: 15000 });
  const n = await page.locator('[data-asset-id]').count();
  expect(n >= 6, `expected ≥6 tiles, got ${n}`);
  await page.getByText('From the moodboard:').waitFor();
});
await shot('art-direction');

await step('open lightbox, edit metadata, mark favorite', async () => {
  await page.locator('[data-asset-id]').first().click();
  const viewer = page.getByRole('dialog', { name: 'Image viewer' });
  await viewer.waitFor();
  await viewer.getByLabel('Title').fill('Sodium vapour street');
  await viewer.getByPlaceholder('The light falloff, the type scale, the way the cut lands…').fill('Warm falloff against black.');
  await viewer.getByLabel('Add to favorites').click();
  await viewer.getByLabel('Remove from favorites').waitFor();
  await shot('lightbox', false);
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
});

await step('data persists across a reload', async () => {
  await page.goto(videoUrl);
  await page.reload();
  await page.getByText('Night drive test reference').first().waitFor();
  await page.getByRole('link', { name: 'Whip Pan Transition' }).first().waitFor();
  const frames = await page.locator('[data-asset-id]').count();
  expect(frames === 3, `expected 3 frames after reload, got ${frames}`);
});

await step('technique page shows the new example and its video', async () => {
  await go('/techniques/tech_whip-pan');
  await page.getByText('Night drive test reference').first().waitFor();
  await page.getByRole('link', { name: '00:07' }).waitFor();
});
await shot('technique');

await step('global search finds techniques, creators and breakdowns', async () => {
  await go('/');
  await page.keyboard.press('Control+k');
  await page.getByPlaceholder('Search techniques, videos, art directions, creators…').fill('DaVinci Resolve');
  await page.getByRole('button', { name: /Ryan Herrick/ }).waitFor();
  await page.keyboard.press('Escape');
  await go('/search?q=glitch%20transition');
  await page.getByRole('link', { name: /Viral Glitch Transitions/ }).waitFor();
});

await step('create a collection and add a technique to it', async () => {
  await go('/techniques/tech_film-grain');
  await page.getByRole('button', { name: /Collect/ }).click();
  await page.getByRole('button', { name: 'Effects I want to recreate' }).click();
  await go('/collections/col_recreate');
  await page.getByRole('link', { name: /Film Grain/ }).first().waitFor();
});

let backupPath = '';
await step('export a full backup', async () => {
  await go('/library');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-zip').click()]);
  backupPath = join(root, 'test-results', 'backup.zip');
  mkdirSync(dirname(backupPath), { recursive: true });
  await dl.saveAs(backupPath);
  expect(/framework-backup-\d{4}-\d{2}-\d{2}\.zip/.test(dl.suggestedFilename()), 'unexpected filename');
});
await shot('library');

await step('erase the library, then restore from the backup', async () => {
  await page.getByRole('button', { name: /Erase library and reload/ }).click();
  await page.getByLabel(/Type "ERASE"/).fill('ERASE');
  await page.getByRole('button', { name: 'Erase library', exact: true }).click();
  await page.getByText('Library reset').waitFor();
  await page.goto(videoUrl);
  await page.getByText('Not in the library').waitFor();
  await go('/library');
  await page.getByTestId('restore-input').setInputFiles(backupPath);
  await page.getByTestId('confirm-restore').click();
  await page.getByText(/Restored \d+ records and \d+ files/).waitFor({ timeout: 15000 });
  await page.goto(videoUrl);
  await page.getByText('Night drive test reference').first().waitFor();
  await page.locator('[data-asset-id]').nth(2).waitFor({ timeout: 5000 });
  const frames = await page.locator('[data-asset-id]').count();
  expect(frames === 3, `expected 3 restored frames, got ${frames}`);
  // the restored image must render from its restored file
  await page.waitForFunction(() => [...document.querySelectorAll('[data-asset-id] img')].some((i) => i.complete && i.naturalWidth > 0));
});

if (SHOTS) {
  for (const [name, hash] of [
    ['home', '/'],
    ['techniques', '/techniques'],
    ['art-directions', '/art-directions'],
    ['videos', '/videos'],
    ['creators', '/creators'],
    ['breakdown', '/breakdowns/bd_cinecom_track_matte'],
    ['compare', '/compare?directions=ad_analog_film,ad_futuristic_digital,ad_minimal_editorial'],
    ['glossary', '/glossary'],
  ]) {
    await go(hash);
    await page.waitForTimeout(600);
    await shot(name);
  }
  await page.evaluate(() => localStorage.setItem('framework:theme', '"dark"'));
  await go('/art-directions/ad_analog_film');
  await page.reload();
  await page.waitForTimeout(800);
  await shot('art-direction-dark');
  await page.evaluate(() => localStorage.setItem('framework:theme', '"light"'));
  await page.setViewportSize({ width: 390, height: 844 });
  await go('/');
  await page.reload();
  await page.waitForTimeout(600);
  await shot('mobile-home', false);
}

await step('mobile layout has no horizontal scroll', async () => {
  await page.setViewportSize({ width: 375, height: 812 });
  for (const hash of ['/', '/techniques', '/art-directions/ad_analog_film', '/videos', '/library', '/techniques/tech_whip-pan']) {
    await go(hash);
    await page.waitForTimeout(300);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow <= 1, `${hash} overflows by ${overflow}px`);
  }
});

await step('no console errors', async () => {
  expect(consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));
});

await browser.close();
server.kill();
writeFileSync(join(root, 'test-results', 'e2e.txt'), failures.length ? `FAILED: ${failures.join(', ')}\n` : 'OK\n');
console.log(failures.length ? `\n${failures.length} step(s) failed` : '\nAll e2e steps passed');
process.exit(failures.length ? 1 : 0);
