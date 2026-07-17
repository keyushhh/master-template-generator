// Local headless-Chrome PDF service.
//
// Renders a deck to a true vector PDF by loading the frontend's chrome-only
// `/print` route in headless Chrome, injecting the deck as `window.__DECK__`,
// and printing to PDF via Chrome's own print pipeline (real, selectable text).
//
// Env:
//   PORT         backend port                      (default 3001)
//   APP_URL      frontend origin to render          (default http://localhost:5173)
//   CHROME_PATH  path to a Chrome/Chromium binary    (default: macOS Google Chrome)

import { existsSync } from 'node:fs';
import express from 'express';
import puppeteer from 'puppeteer-core';

const PORT = process.env.PORT || 3001;
const APP_URL = (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '');

// Common Chrome/Chromium locations, in preference order. CHROME_PATH wins.
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
].filter(Boolean);

function resolveChromePath() {
  return CHROME_CANDIDATES.find((p) => existsSync(p)) || null;
}

// ── Warm singleton browser ────────────────────────────────────────────────
// Reused across requests; a fresh page is opened (and closed) per export.
let browserPromise = null;

async function getBrowser() {
  if (browserPromise) return browserPromise;
  const executablePath = resolveChromePath();
  if (!executablePath) {
    throw Object.assign(new Error('No Chrome binary found'), { code: 'NO_CHROME' });
  }
  browserPromise = puppeteer
    .launch({
      executablePath,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none'],
    })
    .catch((err) => {
      browserPromise = null; // allow retry on next request
      throw err;
    });
  return browserPromise;
}

function sanitizeFilename(title) {
  return (String(title || '').replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'presentation').slice(0, 80);
}

const app = express();
app.use(express.json({ limit: '10mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, chrome: resolveChromePath(), appUrl: APP_URL });
});

app.post('/api/export/pdf', async (req, res) => {
  const { session, title } = req.body || {};
  if (!session || !session.deck || !Array.isArray(session.deck.slides)) {
    return res.status(400).json({ error: 'Missing or invalid { session: { deck } } in request body.' });
  }

  let page;
  try {
    const browser = await getBrowser();
    page = await browser.newPage();

    // Seed the deck before any app script runs, so the /print route hydrates
    // from window.__DECK__ instead of localStorage.
    await page.evaluateOnNewDocument((s) => {
      window.__DECK__ = s;
    }, session);

    await page.goto(`${APP_URL}/print`, { waitUntil: 'networkidle0', timeout: 60000 });

    // The print page raises this flag once fonts + layout have settled.
    await page.waitForSelector('[data-print-ready="1"]', { timeout: 30000 });

    const pdf = await page.pdf({
      width: '1920px',
      height: '1080px',
      printBackground: true,
      preferCSSPageSize: false,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${sanitizeFilename(title)}.pdf"`
    );
    res.send(Buffer.from(pdf));
  } catch (err) {
    console.error('[pdf] export failed:', err);
    if (err && err.code === 'NO_CHROME') {
      return res.status(500).json({
        error:
          'No Chrome binary found. Install Google Chrome or set CHROME_PATH to a Chrome/Chromium executable.',
      });
    }
    res.status(500).json({ error: `PDF export failed: ${err?.message || 'unknown error'}` });
  } finally {
    if (page) await page.close().catch(() => {});
  }
});

app.listen(PORT, () => {
  const chrome = resolveChromePath();
  console.log(`[pdf] server listening on http://localhost:${PORT}`);
  console.log(`[pdf] rendering app at ${APP_URL}/print`);
  console.log(chrome ? `[pdf] using Chrome: ${chrome}` : '[pdf] WARNING: no Chrome binary found (set CHROME_PATH)');
});
