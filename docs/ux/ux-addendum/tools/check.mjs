// Automated QA over every addendum screen and state in assets/manifest.js. No installs (Node 22+ and local Chrome/Edge).
//   node tools/check.mjs                 all states at 390 and 1440; default states also at 820, 1024, 1280
//   node tools/check.mjs --quick         default state of each screen at 390 and 1440 only
//   node tools/check.mjs --only auth-phone
// Per load: console errors and exceptions, horizontal overflow, broken images, text below 11 px, duplicate ids,
// dead internal links, and (390 px only, informational) tap targets under 36 px.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, open, evalJs } from './cdp.mjs';
import { loadManifest } from './render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const quick = !!arg('quick', false);
const only = arg('only', '') ? String(arg('only')).split(',') : null;

const PROBE = `(() => {
  const vw = window.innerWidth;
  document.documentElement.style.overflowX = 'visible'; document.body.style.overflowX = 'visible';
  const clipped = (el) => { for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) { if (/(auto|scroll|hidden|clip)/.test(getComputedStyle(p).overflowX)) return true; } return false; };
  const over = [];
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('.ann, .arches, .sr-only, svg')) return;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || cs.position === 'fixed' || el.closest('[hidden]')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    if ((r.right > vw + 1 || r.left < -1) && !clipped(el)) over.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  const docW = document.documentElement.scrollWidth;
  const broken = [...document.images].filter((i) => !i.complete || i.naturalWidth === 0).map((i) => i.getAttribute('src'));
  const small = new Set();
  document.querySelectorAll('body *').forEach((el) => {
    if (el.closest('svg, .ann, [hidden], .sr-only')) return;
    const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    if (own && parseFloat(cs.fontSize) > 0 && parseFloat(cs.fontSize) < 11) small.add(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] + ' ' + cs.fontSize + ' "' + el.textContent.trim().slice(0, 24) + '"');
  });
  const ids = {}; document.querySelectorAll('[id]').forEach((e) => { if (!e.closest('[hidden]')) ids[e.id] = (ids[e.id] || 0) + 1; });
  const dup = Object.keys(ids).filter((k) => ids[k] > 1);
  const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
  const tap = [];
  if (vw <= 420) document.querySelectorAll('a, button, select, input:not([type=hidden]), [role=tab]').forEach((el) => {
    if (el.closest('[hidden], .ann, .sr-only')) return; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (el.matches('a') && el.closest('p, li, .auth-foot, .ftr, .hint, .small, .caption, .fine')) return;
    if (el.matches('input[type=checkbox], input[type=radio], .otp-input, .stretched')) return;
    const r = el.getBoundingClientRect(); if (r.width && r.height && (r.height < 36 || r.width < 36)) tap.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  return { docOver: docW > vw + 1 ? docW : 0, over: over.slice(0, 6), broken, small: [...small].slice(0, 6), dup, hrefs, tap: tap.slice(0, 8) };
})()`;

const jobs = [];
for (const s of loadManifest()) {
  if (only && !only.includes(s.id)) continue;
  s.states.forEach((st, i) => {
    if (quick && i > 0) return;
    const widths = !quick && i === 0 ? [390, 820, 1024, 1280, 1440] : [390, 1440];
    for (const w of widths) jobs.push({ s, st, w });
  });
}

const { cdp, close } = await launch();
let fail = 0, info = 0;
const deadSeen = new Set();
try {
  for (const { s, st, w } of jobs) {
    const file = path.join(root, 'screens', s.file);
    const url = pathToFileURL(file).href + (st.key && st.key !== 'default' ? '#' + st.key : '');
    const problems = await open(cdp, { url, w, h: 900, dsf: 1 });
    const r = await evalJs(cdp, PROBE);
    const issues = [...problems];
    if (r.docOver) issues.push('horizontal overflow: document width ' + r.docOver);
    if (r.over.length) issues.push('elements past viewport: ' + r.over.join('; '));
    if (r.broken.length) issues.push('broken images: ' + r.broken.join(', '));
    if (r.small.length) issues.push('text under 11px: ' + r.small.join('; '));
    if (r.dup.length) issues.push('duplicate ids: ' + r.dup.join(', '));
    for (const h of new Set(r.hrefs)) {
      if (!h || h.startsWith('#') || /^(https?:|mailto:|tel:|javascript:)/.test(h)) continue;
      const target = path.resolve(path.dirname(file), h.split('#')[0]);
      if (!fs.existsSync(target) && !deadSeen.has(s.id + h)) { deadSeen.add(s.id + h); issues.push('dead link: ' + h); }
    }
    const tag = `${s.id}#${st.key || 'default'} @${w}`;
    if (issues.length) { fail++; console.log('FAIL ' + tag + '\n   ' + issues.join('\n   ')); }
    else console.log('ok   ' + tag);
    if (r.tap.length && w === 390) { info++; console.log('   info: small tap targets: ' + r.tap.join('; ')); }
  }
} finally {
  await close();
}
console.log(`\n${jobs.length} loads, ${fail} with problems, ${info} with tap-target notes (informational)`);
process.exitCode = fail ? 1 : 0;
