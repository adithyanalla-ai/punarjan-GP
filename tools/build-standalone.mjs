// Bundles index.html + CSS + JS + fonts + optimized images into one offline file.
// Usage: node tools/build-standalone.mjs   (no dependencies)
import fs from 'node:fs';
import path from 'node:path';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const mime = { woff2:'font/woff2', webp:'image/webp', jpg:'image/jpeg', png:'image/png' };
const uri = (rel) => {
  const f = path.join(root, rel);
  return `data:${mime[path.extname(f).slice(1)]};base64,${fs.readFileSync(f).toString('base64')}`;
};
let css = fs.readFileSync(path.join(root,'assets/css/styles.css'),'utf8')
  .replace(/url\("\.\.\/(fonts\/[^"]+)"\)/g, (_, p) => `url("${uri('assets/'+p)}")`);
let js = fs.readFileSync(path.join(root,'assets/js/main.js'),'utf8');
let html = fs.readFileSync(path.join(root,'index.html'),'utf8');

// the lightbox builds "<base>.webp/.jpg" at runtime: ship a lookup instead of file paths
const fulls = [...new Set([...html.matchAll(/data-full="(assets\/img\/[^"]+)"/g)].map(m => m[1]))];
const map = Object.fromEntries(fulls.map(b => [b, uri(b + '.webp') /* WebP is universal; skip JPEG fallbacks to keep the file small */]));
js = js.replace('lbSrc.srcset = `${d.full}.webp`;', 'lbSrc.srcset = (window.__FULL && window.__FULL[d.full]) || `${d.full}.webp`;')
       .replace('lbImg.src = `${d.full}.jpg`;', 'lbImg.src = (window.__FULL && window.__FULL[d.full]) || `${d.full}.jpg`;');

html = html
  .replace(/<link rel="preload"[^>]*>\s*/g, '')
  .replace('<link rel="stylesheet" href="assets/css/styles.css">', () => `<style>${css}</style>`)
  .replace('<script src="assets/js/main.js" defer></script>', () => `<script>window.__FULL=${JSON.stringify(map)};</script>\n<script>${js}</script>`)
  .replace(/<source type="image\/webp" srcset="[^"]+">/g, '')
  .replace(/(src)="(assets\/img\/[^"]+)\.jpg"/g, (_, a, p) => `${a}="${uri(p + '.webp')}"`)
  .replace(/ data-full="(assets\/img\/[^"]+)"/g, ' data-full="$1"');
fs.writeFileSync(path.join(root,'punarjan-growth-plan-standalone.html'), html);
console.log('standalone:', (html.length/1024/1024).toFixed(2), 'MB');
