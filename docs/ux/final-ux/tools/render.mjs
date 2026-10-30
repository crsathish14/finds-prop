// Renders the design screens to PNG with a local Chrome. No installs needed.
//
//   node tools/render.mjs                         render everything in assets/manifest.js
//   node tools/render.mjs --only home-a,search    render selected screens
//   node tools/render.mjs --vp d,m                only these viewports (d=1440, t=820, m=390)
//   node tools/render.mjs --url screens/x.html#empty --w 390 --out some.png [--fold] [--fullvh] [--dsf 2]
//
// Output goes to renders/<id>--<state>--<viewport>.webp (mobile at 2x for legibility). Ad-hoc --url renders are PNG.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launch, open, screenshot, evalJs } from './cdp.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? (process.argv[i + 1]?.startsWith('--') || process.argv[i + 1] === undefined ? true : process.argv[i + 1]) : d; };

const VP = { d: { w: 1440, h: 900, dsf: 1 }, t: { w: 820, h: 1180, dsf: 1 }, m: { w: 390, h: 844, dsf: 2 } };

export function loadManifest() {
  const window = {};
  new Function('window', fs.readFileSync(path.join(root, 'assets', 'manifest.js'), 'utf8'))(window);
  return window.FP_MANIFEST;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

async function main() {
const { cdp, close } = await launch();
try {
  const adhoc = arg('url');
  if (adhoc) {
    const w = Number(arg('w', 1440));
    const url = pathToFileURL(path.resolve(root, adhoc.split('#')[0])).href + (adhoc.includes('#') ? '#' + adhoc.split('#')[1] : '');
    let problems = await open(cdp, { url, w, h: Number(arg('h', 900)), dsf: Number(arg('dsf', 1)) });
    if (arg('fullvh', false)) { const full = await evalJs(cdp, 'Math.ceil(document.documentElement.scrollHeight)'); problems = await open(cdp, { url, w, h: full, dsf: Number(arg('dsf', 1)) }); }
    const H = await screenshot(cdp, { out: path.resolve(arg('out', 'shot.png')), w, fold: !!arg('fold', false), h: Number(arg('h', 900)) });
    console.log(`ok ${adhoc} @${w} -> height ${H}`, problems.length ? problems : '');
  } else {
    const only = arg('only', '') ? String(arg('only')).split(',') : null;
    const vps = arg('vp', '') ? String(arg('vp')).split(',') : ['d', 't', 'm'];
    const manifest = loadManifest();
    let n = 0;
    for (const s of manifest) {
      if (only && !only.includes(s.id)) continue;
      for (const st of s.states) {
        for (const v of (st.vps || s.vps || ['d', 't', 'm'])) {
          if (!vps.includes(v)) continue;
          const vp = VP[v];
          const url = pathToFileURL(path.join(root, 'screens', s.file)).href + (st.key && st.key !== 'default' ? '#' + st.key : '');
          const out = path.join(root, 'renders', `${s.id}--${st.key || 'default'}--${v}.webp`);
          let problems = await open(cdp, { url, ...vp });
          if ((st.fullvh ?? s.fullvh) && !st.fold) {
            // portals: give the page a viewport as tall as its content so 100vh sidebars span the whole capture
            const full = await evalJs(cdp, 'Math.ceil(document.documentElement.scrollHeight)');
            problems = await open(cdp, { url, ...vp, h: full });
          }
          const H = await screenshot(cdp, { out, w: vp.w, fold: !!st.fold, h: vp.h, format: 'webp', quality: 92 });
          n++;
          console.log(`${path.basename(out)}  ${vp.w}x${H}${problems.length ? '  PROBLEMS: ' + problems.join(' | ') : ''}`);
        }
      }
    }
    console.log(`rendered ${n} images`);
  }
} finally {
  await close();
}
}
