// Pre-flight check for the live presentation.
//   npm run preflight           (rebuilds the standalone file first)
//   SHOTS=dir npm run preflight (also saves a screenshot of every scene/step)
// Opens the site in Chromium, enters presentation mode, steps through every scene
// at three projector sizes and reports: console errors, failed/missing assets,
// content outside the screen (inner scrolling), small text, slow reveals,
// placeholders, keyboard controls, and offline behaviour.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const types = { '.html':'text/html', '.css':'text/css', '.js':'text/javascript', '.woff2':'font/woff2', '.webp':'image/webp', '.jpg':'image/jpeg', '.png':'image/png', '.txt':'text/plain', '.json':'application/json' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(root, p);
  if (!f.startsWith(root) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'X-Robots-Tag': 'noindex, nofollow' });
  fs.createReadStream(f).pipe(res);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
const SHOTS = process.env.SHOTS;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });

const problems = [];
const warn = [];
const fail = (m) => { problems.push(m); console.log('  FAIL', m); };
const note = (m) => { warn.push(m); console.log('  warn', m); };
const ok = (m) => console.log('  ok  ', m);

const browser = await chromium.launch();

const visibleText = () => { const c = document.body.cloneNode(true); c.querySelectorAll('script,style,noscript').forEach((n) => n.remove()); return c.textContent; };
// ---- in-page checks -------------------------------------------------------
const inspect = () => {
  const s = document.querySelector('.scene.cur');
  const vw = innerWidth, vh = innerHeight, out = { overflow: [], small: [], unsettled: [], placeholders: [] };
  if (!s) { out.overflow.push('no current scene'); return out; }
  if (s.scrollHeight > s.clientHeight + 1) out.overflow.push(`scene scrollHeight ${s.scrollHeight} > ${s.clientHeight}`);
  if (document.documentElement.scrollWidth > vw + 1) out.overflow.push('page scrolls horizontally');
  const root = parseFloat(getComputedStyle(document.documentElement).fontSize);
  for (const el of s.querySelectorAll('.wrap *')) {
    if (el.closest('.botanical,.sr,[hidden]') || (el.closest('svg') && !el.matches('svg'))) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    if (r.bottom > vh + 1 || r.top < -1 || r.right > vw + 1 || r.left < -1) out.overflow.push(`${el.tagName.toLowerCase()}.${el.className} (${Math.round(r.left)},${Math.round(r.top)})-(${Math.round(r.right)},${Math.round(r.bottom)})`);
    // opacity must be settled
    let o = 1; for (let n = el; n && n !== s; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity);
    if (o < 0.99 && el.textContent.trim() && !el.closest('.phrase')) out.unsettled.push(`${el.tagName.toLowerCase()}.${el.className}`);
    // reading text at the 1920x1080 reference size
    if (['P', 'DD', 'LI', 'SPAN', 'BLOCKQUOTE'].includes(el.tagName) && el.childNodes.length && [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) {
      if (cs.textTransform === 'uppercase' || parseFloat(cs.letterSpacing) > 1) continue;
      const ref = parseFloat(cs.fontSize) * 21 / root;
      if (ref < 21.4) out.small.push(`${(ref).toFixed(1)}px "${el.textContent.trim().slice(0, 40)}"`);
    }
  }
  const t = s.innerText;
  if (/\[[^\]]*\]/.test(t)) out.placeholders.push(t.match(/\[[^\]]*\]/)[0]);
  return out;
};
const state = () => document.querySelector('#pos').textContent;

async function runPresent(page, label, shotPrefix) {
  const total = await page.evaluate(() => [...document.querySelectorAll('.scene')].reduce((n, s) => n + (+s.dataset.steps || 1), 0));
  await page.keyboard.press('f');
  await page.waitForTimeout(500);
  if (!(await page.evaluate(() => document.body.classList.contains('present')))) return fail(`${label}: presentation mode did not start`);
  const isFs = await page.evaluate(() => !!document.fullscreenElement);
  isFs ? ok(`${label}: real fullscreen active`) : note(`${label}: fullscreen not granted in this browser (headless); layout still checked at viewport size`);
  let n = 0, bad = 0;
  for (let i = 0; i < total; i++) {
    await page.waitForTimeout(780);
    const pos = await page.evaluate(state);
    const r = await page.evaluate(inspect);
    n++;
    const id = await page.evaluate(() => document.querySelector('.scene.cur').id);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${shotPrefix}-${String(n).padStart(2, '0')}-${id}.png`) });
    for (const k of ['overflow', 'unsettled', 'placeholders']) if (r[k].length) { bad++; fail(`${label} [${pos}] ${id}: ${k}: ${[...new Set(r[k])].slice(0, 4).join(' | ')}`); }
    if (r.small.length) note(`${label} [${pos}] ${id}: text under 22px-equivalent: ${[...new Set(r.small)].slice(0, 3).join(' | ')}`);
    if (i < total - 1) await page.keyboard.press('ArrowRight');
  }
  if (!bad) ok(`${label}: ${n} states (${total} expected), all fit one screen, nothing half-loaded after 780 ms`);
  // controls
  await page.keyboard.press('Home'); await page.waitForTimeout(100);
  const c = {};
  c.home = (await page.evaluate(state)).startsWith('1 /');
  await page.keyboard.press('4'); await page.waitForTimeout(100); c.num = (await page.evaluate(state)).startsWith('4 /');
  await page.keyboard.press('PageDown'); await page.waitForTimeout(100); await page.keyboard.press('PageUp'); await page.waitForTimeout(100); c.pgs = (await page.evaluate(state)).startsWith('4 / 9 · 1');
  await page.keyboard.press('Space'); await page.waitForTimeout(100); c.space = (await page.evaluate(state)).includes('· 2/');
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(100); c.left = (await page.evaluate(state)).includes('· 1/');
  await page.keyboard.press('End'); await page.waitForTimeout(100); c.end = (await page.evaluate(state)).startsWith('9 /');
  await page.keyboard.press('b'); await page.waitForTimeout(100); c.blank = await page.evaluate(() => getComputedStyle(document.querySelector('#blank')).display === 'block');
  await page.keyboard.press('x'); await page.waitForTimeout(100); c.unblank = await page.evaluate(() => getComputedStyle(document.querySelector('#blank')).display === 'none');
  await page.click('#pPrev'); await page.waitForTimeout(100); c.arrow = (await page.evaluate(state)).startsWith('8 /');
  await page.mouse.move(50, 50); await page.waitForTimeout(2900);
  c.idleHide = await page.evaluate(() => document.body.classList.contains('idle') && getComputedStyle(document.querySelector('.chrome')).opacity === '0');
  await page.mouse.move(120, 120); await page.waitForTimeout(500);
  c.idleShow = await page.evaluate(() => !document.body.classList.contains('idle') && getComputedStyle(document.querySelector('.chrome')).opacity === '1');
  await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  c.esc = await page.evaluate(() => !document.body.classList.contains('present'));
  const bads = Object.entries(c).filter(([, v]) => !v).map(([k]) => k);
  bads.length ? fail(`${label}: controls failed: ${bads.join(', ')}`) : ok(`${label}: Home, 1-9, PageUp/Down, Space, Left, End, B + any key, next-arrow, idle hide/show, Esc`);
}

function watch(page, label, allowFile) {
  page.on('console', (m) => { if (m.type() === 'error') fail(`${label}: console error: ${m.text()}`); });
  page.on('pageerror', (e) => fail(`${label}: page error: ${e.message}`));
  page.on('requestfailed', (r) => { if (!r.url().startsWith('data:')) fail(`${label}: request failed: ${r.url()} (${r.failure()?.errorText})`); });
  page.on('response', (r) => { if (r.status() >= 400) fail(`${label}: HTTP ${r.status()} ${r.url()}`); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith('data:') && !u.startsWith(base) && !(allowFile && u.startsWith('file:'))) fail(`${label}: external request: ${u}`); });
}

// ---- 1. built site over http at three projector sizes ----------------------
for (const [w, h] of [[1920, 1080], [1366, 768], [1280, 720], [1440, 900]]) {
  console.log(`\n▶ ${w}x${h} (http)`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const label = `${w}x${h}`;
  watch(page, label);
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  await page.waitForTimeout(600);
  const meta = await page.evaluate((vt) => { const visibleText = eval('(' + vt + ')'); return ({
    robots: document.querySelector('meta[name=robots]')?.content, title: document.title,
    ph: /\[[^\]]*\]/.test(visibleText()),
  }); }, visibleText.toString());
  if (!/noindex/.test(meta.robots || '')) fail('robots meta missing noindex');
  if (meta.ph) fail(`${label}: "[...]" placeholder text found in page`);
  await runPresent(page, label, `${w}x${h}`);
  await ctx.close();
}

// ---- 2. offline after first load (service worker) --------------------------
console.log('\n▶ offline (service worker)');
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(base + '/index.html', { waitUntil: 'load' });
  const ready = await page.evaluate(() => navigator.serviceWorker?.ready.then(() => true).catch(() => false));
  await page.waitForTimeout(2500); // let the precache finish
  if (!ready) fail('service worker did not register');
  await ctx.setOffline(true);
  const errs = [];
  page.on('pageerror', (e) => errs.push(e.message));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(800);
  const res = await page.evaluate(async () => {
    await document.fonts.ready;
    return { h1: document.querySelector('h1')?.textContent.trim(), fonts: [...document.fonts].filter((f) => f.status === 'loaded').length };
  });
  await page.evaluate(() => document.querySelector('#samples').scrollIntoView());
  await page.waitForTimeout(500);
  await page.evaluate(() => document.querySelectorAll('img[loading=lazy]').forEach((i) => (i.loading = 'eager')));
  await page.waitForTimeout(800);
  const imgs = await page.evaluate(() => [...document.images].filter((i) => i.getAttribute('src')).every((i) => i.complete && i.naturalWidth > 0));
  if (res.h1 && res.fonts >= 4 && imgs && !errs.length) ok(`offline reload works (fonts ${res.fonts}, posters loaded)`);
  else fail(`offline reload failed: ${JSON.stringify({ ...res, imgs, errs })}`);
  await ctx.close();
}

// ---- 3. standalone single file, opened from disk, network off --------------
console.log('\n▶ standalone file (file://, offline)');
{
  const f = path.join(root, 'punarjan-growth-plan-standalone.html');
  if (!fs.existsSync(f)) fail('standalone file missing (run npm run bundle)');
  else {
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, offline: true });
    const page = await ctx.newPage();
    watch(page, 'standalone', true);
    await page.goto('file://' + f, { waitUntil: 'load' });
    await page.waitForTimeout(600);
    const txt = await page.evaluate((vt) => eval('(' + vt + ')')(), visibleText.toString());
    if (/\[[^\]]*\]/.test(txt)) fail('standalone: "[...]" placeholder text found');
    const refs = fs.readFileSync(f, 'utf8').match(/(?:src|href)="(?!data:|#|mailto:|tel:|https?:)[^"]+"/g) || [];
    refs.length ? fail(`standalone references external files: ${refs.slice(0, 3).join(', ')}`) : ok('standalone has no external file references');
    await runPresent(page, 'standalone 1366x768', 'standalone');
    await ctx.close();
  }
}

await browser.close();
server.close();
console.log(`\n${problems.length ? '✖' : '✔'} preflight: ${problems.length} problem(s), ${warn.length} warning(s)`);
process.exit(problems.length ? 1 : 0);
