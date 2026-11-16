#!/usr/bin/env node
// Serve a build with a nested base, then run: STORY_URL=http://127.0.0.1:5173/nested/ NODE_PATH=... node scripts/check-story.cjs
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');

const appUrl = process.env.STORY_URL || 'http://127.0.0.1:5173/';
const basePath = new URL(appUrl).pathname.replace(/\/?$/, '/');
const browserOptions = process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {};
const loopback = new Set(['localhost', '127.0.0.1', '[::1]']);

(async () => {
  const browser = await chromium.launch({ headless: true, ...browserOptions });
  try {
    const context = await browser.newContext();
    await context.route('**/*', (route) => {
      const url = new URL(route.request().url());
      return loopback.has(url.hostname) || ['about:', 'blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
    });
    await context.route('**/intro/reading-music.mp3', (route) => route.fulfill({ status: 404, body: '' }));
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    await page.addInitScript(() => {
      const seed = sessionStorage.getItem('__story-check-seed');
      if (seed) {
        localStorage.setItem('echo-save', JSON.stringify({ state: { intro: JSON.parse(seed) }, version: 3 }));
        sessionStorage.removeItem('__story-check-seed');
      }
    });
    const open = (hash) => page.goto(new URL(hash, appUrl).href, { waitUntil: 'domcontentloaded' });
    const seed = async (scene, finished) => {
      await page.evaluate((intro) => sessionStorage.setItem('__story-check-seed', JSON.stringify(intro)), { scene, finished });
      await page.reload({ waitUntil: 'domcontentloaded' });
    };
    const saved = () => page.evaluate(() => JSON.parse(localStorage.getItem('echo-save')).state.intro);
    const noOverflow = async (target = page) => {
      const dimensions = await target.evaluate(() => ({ url: location.href, width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
      assert.ok(dimensions.scrollWidth <= dimensions.width + 1, `horizontal overflow: ${JSON.stringify(dimensions)}`);
    };
    const picker = async () => {
      await page.locator('a[href="#/story?mode=lantern"]').waitFor();
      await page.locator('a[href="#/story?mode=watercolor"]').waitFor();
    };

    await open('#/story');
    await picker();
    await page.locator('.topbar').waitFor({ state: 'visible' });
    for (const image of await page.locator('.story-mode-card img').all()) {
      await image.scrollIntoViewIfNeeded();
      await image.evaluate((img) => img.decode());
      assert.ok(new URL(await image.getAttribute('src'), page.url()).pathname.startsWith(basePath), 'picker image must use BASE_URL');
    }
    await open('#/story?mode=unknown');
    await picker();
    await page.locator('.topbar').waitFor({ state: 'visible' });
    await page.locator('a[href="#/story?mode=watercolor"]').click();
    const frame = page.frameLocator('iframe');
    const iframeUrl = new URL(await page.locator('iframe').getAttribute('src'), page.url());
    assert.ok(iframeUrl.pathname.startsWith(basePath), 'watercolor must use BASE_URL');
    const continueLink = frame.locator('a[href*="#/home"]');
    await continueLink.scrollIntoViewIfNeeded();
    await continueLink.click();
    await page.waitForURL(/#\/home$/);

    await seed(6, false);
    await open('#/story?mode=lantern');
    await page.locator('#story-07').waitFor();
    await page.waitForFunction(() => { const r = document.getElementById('story-07')?.getBoundingClientRect(); return r && r.top < innerHeight && r.bottom > 0; });
    await page.locator('.story-control--icon').waitFor({ state: 'hidden' });
    await page.waitForFunction(() => { const v = document.querySelector('video'); return v && v.readyState >= 2 && v.videoWidth > 0 && v.currentTime > 0; });
    const videoPath = await page.locator('video').evaluate((v) => new URL(v.currentSrc).pathname);
    assert.ok(videoPath.startsWith(basePath), 'video must use BASE_URL');
    const thumb = page.locator('.intro-filmstrip img').first();
    await thumb.evaluate((img) => img.decode());
    assert.ok(new URL(await thumb.getAttribute('src'), page.url()).pathname.startsWith(basePath), 'story image must use BASE_URL');
    await page.locator('.story-control--primary').click();
    assert.equal((await saved()).finished, false, 'exiting early must not complete the story');
    assert.ok((await saved()).scene >= 6, 'exiting early must preserve progress');

    await seed(14, true);
    await open('#/story?mode=lantern');
    await page.locator('#story-01').waitFor();
    await page.waitForFunction(() => { const r = document.getElementById('story-01')?.getBoundingClientRect(); return r && r.top < innerHeight && r.bottom > 0; });
    assert.deepEqual(await saved(), { scene: 14, finished: true }, 'replay must preserve completed progress');

    await seed(0, false);
    await open('#/');
    await page.locator('.intro-start').click();
    await page.locator('dialog.legend-modal[open]').waitFor();
    await page.keyboard.press('Escape');
    await page.locator('dialog.legend-modal[open]').waitFor({ state: 'hidden' });

    const screenshotRoot = process.env.STORY_SCREENSHOT_DIR;
    const screenshotDir = screenshotRoot && fs.mkdtempSync(path.join(screenshotRoot, 'story-'));
    for (const viewport of [{ width: 1440, height: 900 }, { width: 768, height: 1024 }, { width: 320, height: 812 }]) {
      await page.setViewportSize(viewport);
      for (const [mode, hash] of [['picker', '#/story'], ['lantern', '#/story?mode=lantern'], ['watercolor', '#/story?mode=watercolor']]) {
        await open(hash);
        await page.locator(mode === 'lantern' ? '.intro-scrollbook' : mode === 'watercolor' ? 'iframe' : '.story-modes').waitFor();
        await page.locator('.topbar').waitFor({ state: mode === 'picker' ? 'visible' : 'hidden' });
        if (mode !== 'picker') await page.getByRole('button', { name: 'Exit story', exact: true }).waitFor({ state: 'visible' });
        await noOverflow();
        if (mode === 'lantern') await page.waitForFunction(() => {
          const video = document.querySelector('.intro-fixed-scene video');
          return video && video.readyState >= 2 && video.videoWidth > 0 && video.currentTime > 0 && Number(getComputedStyle(video).opacity) === 1;
        });
        if (mode === 'watercolor') {
          const child = await page.locator('iframe').contentFrame();
          const framePage = page.frames().find((f) => f !== page.mainFrame());
          await framePage.waitForURL(new URL('moon-stories-watercolor/index.html', appUrl).href);
          await framePage.waitForLoadState('load');
          await child.locator('body').waitFor();
          await noOverflow(framePage);
        }
        if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, `${mode}-${viewport.width}.png`) });
      }
    }
    if (screenshotDir) console.log(`Screenshots: ${screenshotDir}`);
    console.log('Story regression checks passed.');
    await context.close();
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
