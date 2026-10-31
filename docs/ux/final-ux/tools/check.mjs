// Automated QA over every screen and state in assets/manifest.js. No installs needed (Node + local Chrome).
//   node tools/check.mjs                 full pass (all states at 390 and 1440, default states at 820, 1024, 1280)
//   node tools/check.mjs --quick         default state of each screen at 390 and 1440 only
//   node tools/check.mjs --only home-a,search
// Checks per load: console errors and exceptions · horizontal overflow · broken images · text below 11 px ·
// duplicate ids · dead internal links · (390 px only) tap targets under 40 px, reported as information.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, open, evalJs } from './cdp.mjs';
import { loadManifest } from './render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? (process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : true) : d; };
const quick = !!arg('quick', false);
const only = arg('only', '') ? String(arg('only')).split(',') : null;
const manifest = loadManifest();
const files = new Set(fs.readdirSync(path.join(root, 'screens')));

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
  const ids = {}; document.querySelectorAll('[id]').forEach((e) => { ids[e.id] = (ids[e.id] || 0) + 1; });
  const dup = Object.keys(ids).filter((k) => ids[k] > 1 && !k.startsWith('sk') && !k.startsWith('wn'));
  const hrefs = [...document.querySelectorAll('a[href]')].map((a) => a.getAttribute('href'));
  const tap = [];
  if (vw <= 420) document.querySelectorAll('a, button, select, input:not([type=hidden]), [role=tab]').forEach((el) => {
    if (el.closest('[hidden], .ann, .sr-only') ) return; const cs = getComputedStyle(el); if (cs.display === 'none' || cs.visibility === 'hidden') return;
    if (el.matches('a') && el.closest('p, li, .crumbs, .legend, .sp-note, .auth-foot, .ftr, .mini-note, .link-list, .hint, .small')) return;
    if (el.matches('input[type=checkbox], input[type=radio], .stretched') || el.closest('.chips-input')) return;
    const r = el.getBoundingClientRect(); if (r.width && r.height && (r.height < 36 || r.width < 36)) tap.push(el.tagName.toLowerCase() + '.' + String(el.className || '').split(' ')[0] + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
  });
  return { docOver: docW > vw + 1 ? docW : 0, over: over.slice(0, 6), broken, small: [...small].slice(0, 6), dup, hrefs, tap: tap.slice(0, 8) };
})()`;

const jobs = [];
for (const s of manifest) {
  if (only && !only.includes(s.id)) continue;
  s.states.forEach((st, i) => {
    const wide = !quick && i === 0 ? [390, 820, 1024, 1280, 1440] : [390, 1440];
    if (quick && i > 0) return;
    (quick ? [390, 1440] : (i === 0 ? [390, 820, 1024, 1280, 1440] : [390, 1440])).forEach((w) => jobs.push({ s, st, w }));
  });
}

const { cdp, close } = await launch();
const issues = [];
const info = [];
let done = 0;
try {
  for (const { s, st, w } of jobs) {
    const hash = st.key && st.key !== 'default' ? '#' + st.key : '';
    const url = pathToFileURL(path.join(root, 'screens', s.file)).href + hash;
    const label = `${s.id}${hash} @${w}`;
    let problems = [];
    let r;
    try {
      problems = await open(cdp, { url, w, h: w < 500 ? 844 : 900, dsf: 1 });
      r = await evalJs(cdp, PROBE);
    } catch (e) { issues.push(`${label}  CHECK FAILED: ${e.message}`); continue; }
    const bad = [];
    if (problems.length) bad.push('console: ' + problems.join(' | ').slice(0, 300));
    if (r.docOver) bad.push(`page is ${r.docOver}px wide (viewport ${w})`);
    if (r.over.length) bad.push('overflow: ' + r.over.join('; '));
    if (r.broken.length) bad.push('broken images: ' + r.broken.join(', '));
    if (r.small.length) bad.push('text < 11px: ' + r.small.join('; '));
    if (r.dup.length) bad.push('duplicate ids: ' + r.dup.join(', '));
    const dead = [...new Set(r.hrefs.filter((h) => /\.html/.test(h)).map((h) => h.split('#')[0]).filter((h) => h && !files.has(h)))];
    if (dead.length) bad.push('dead links: ' + dead.join(', '));
    if (bad.length) issues.push(`${label}  ${bad.join('  ·  ')}`);
    if (r.tap.length) info.push(`${label}  small targets: ${r.tap.join('; ')}`);
    if (++done % 40 === 0) console.log(`… ${done}/${jobs.length}`);
  }
} finally {
  await close();
}
console.log(`\nchecked ${jobs.length} loads across ${new Set(jobs.map((j) => j.s.id)).size} screens`);
console.log(issues.length ? `\n${issues.length} ISSUES:\n` + issues.join('\n') : '\nno issues');
if (info.length) console.log(`\n${info.length} loads with sub-36 px targets (information):\n` + info.slice(0, 40).join('\n'));
process.exitCode = issues.length ? 1 : 0;
