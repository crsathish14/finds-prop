/* Find Prop · UX addendum behaviours. Loaded AFTER ../../final-ux/assets/fp.js (which supplies the header, footer, icons, #state handling).
   It does three small things and changes nothing in final-ux:
   1. AI search is deferred (architecture decision), so screens with <body data-ai-off> remove every AI entry point after the shared components mount.
   2. Links to screens that live in final-ux are pointed at that folder, so the prototypes stay navigable.
   3. Draws the sample QR code used on the authenticator set-up screen (a placeholder pattern, not a real code). */
(function () {
  const FP = window.FP;
  if (!FP || !FP.mount) return;
  const LOCAL = new Set(window.FPA_FILES || []);
  const aiOff = document.body.hasAttribute('data-ai-off');

  function stripAi() {
    document.querySelectorAll('a[href*="ai-search"]').forEach((a) => { (a.closest('li') || a).remove(); });
    document.querySelectorAll('.ai-link').forEach((e) => e.remove());
  }

  function rewriteLinks() {
    document.querySelectorAll('a[href]').forEach((a) => {
      const h = a.getAttribute('href');
      const m = /^([A-Za-z0-9_-]+\.html)(#.*)?$/.exec(h);
      if (m && !LOCAL.has(m[1])) a.setAttribute('href', '../../final-ux/screens/' + h);
    });
  }

  function drawQr() {
    document.querySelectorAll('svg[data-qr]').forEach((svg) => {
      const N = 25; const Q = 2; const size = N + Q * 2;
      let seed = 20261029;
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const finder = (x, y) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
      let rects = '';
      const box = (ox, oy) => {
        for (let y = 0; y < 7; y++) for (let x = 0; x < 7; x++) {
          const edge = x === 0 || y === 0 || x === 6 || y === 6; const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
          if (edge || core) rects += `<rect x="${ox + x + Q}" y="${oy + y + Q}" width="1.02" height="1.02"/>`;
        }
      };
      box(0, 0); box(N - 7, 0); box(0, N - 7);
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (finder(x, y) || (x === 7 || y === 7 || x === N - 8 || y === N - 8)) continue;
        if (rnd() > 0.52) rects += `<rect x="${x + Q}" y="${y + Q}" width="1.02" height="1.02"/>`;
      }
      svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
      svg.setAttribute('shape-rendering', 'crispEdges');
      svg.setAttribute('fill', 'currentColor');
      svg.innerHTML = rects;
    });
  }

  /* The shared sponsor component builds image paths relative to final-ux/screens; point them at final-ux/assets. */
  if (FP.sponsor) {
    const sponsor = FP.sponsor;
    FP.sponsor = function () { return String(sponsor.apply(this, arguments)).split('../assets/').join('../../final-ux/assets/'); };
  }

  /* Illustrated placeholder map (fictional streets, parks and a river). Drawn from tokens; not real geography. */
  function drawMaps() {
    document.querySelectorAll('svg.map[data-map]').forEach((svg) => {
      const W = 1000; const H = 700; const zoom = Number(svg.dataset.zoom || 1);
      let seed = Number(svg.dataset.seed || 7);
      const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
      const sp = 120 / zoom;
      let blocks = ''; let minor = ''; let major = '';
      for (let x = -400; x < W + 400; x += sp) for (let y = -400; y < H + 400; y += sp) {
        if (rnd() > 0.55) blocks += `<rect x="${x + 8}" y="${y + 8}" width="${sp - 16}" height="${sp - 16}" rx="6" fill="var(--c-bg-sunken)" opacity=".7"/>`;
      }
      for (let x = -400; x < W + 400; x += sp) minor += `<line x1="${x}" y1="-400" x2="${x}" y2="${H + 400}"/>`;
      for (let y = -400; y < H + 400; y += sp * 0.9) minor += `<line x1="-400" y1="${y}" x2="${W + 400}" y2="${y}"/>`;
      const mx = [sp * 3, sp * 6 + 20]; const my = [sp * 2.7];
      mx.forEach((x) => { major += `<line x1="${x}" y1="-400" x2="${x}" y2="${H + 400}"/>`; });
      my.forEach((y) => { major += `<line x1="-400" y1="${y}" x2="${W + 400}" y2="${y}"/>`; });
      const parks = `<rect x="${130 / zoom + 40}" y="60" width="${210 / zoom + 60}" height="${140 / zoom + 50}" rx="22" fill="var(--c-primary-tint)"/><rect x="640" y="430" width="${180 / zoom + 70}" height="${120 / zoom + 50}" rx="22" fill="var(--c-primary-tint)"/>`;
      const labels = svg.dataset.labels === 'false' ? '' : [['Velachery', 520, 330], ['Guindy', 230, 190], ['Adyar', 330, 560], ['Perungudi', 800, 540], ['Taramani', 720, 250]]
        .map(([t, x, y]) => `<text x="${x}" y="${y}" font-family="Figtree, system-ui, sans-serif" font-size="${15}" font-weight="600" fill="var(--c-muted)" stroke="var(--c-bg)" stroke-width="4" paint-order="stroke" text-anchor="middle">${t}</text>`).join('');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
      svg.setAttribute('aria-hidden', 'true');
      svg.innerHTML = `<rect width="${W}" height="${H}" fill="var(--c-bg)"/>
        <g transform="rotate(-12 500 350)">${blocks}<g stroke="var(--c-border)" stroke-width="8" stroke-linecap="round">${minor}</g><g stroke="var(--c-surface)" stroke-width="5.5" stroke-linecap="round">${minor}</g>
          <g stroke="var(--c-border-strong)" stroke-width="17" stroke-linecap="round">${major}</g><g stroke="var(--c-surface)" stroke-width="13" stroke-linecap="round">${major}</g></g>
        ${parks}
        <path d="M-20 520 C 160 470, 260 570, 430 610 S 700 700, 780 760 L -20 760 Z" fill="var(--c-info-bg)" stroke="var(--c-border)" stroke-width="2"/>
        ${labels}`;
    });
  }

  /* Places each suggestions panel under the field it belongs to (tablet and desktop; phones use a full-screen sheet in CSS). */
  function placeSuggest() {
    document.querySelectorAll('.suggest[data-for]').forEach((el) => {
      const host = el.closest('.sg-host');
      const t = host && host.querySelector(el.dataset.for);
      if (!t) return;
      const hr = host.getBoundingClientRect(); const tr = t.getBoundingClientRect();
      const w = Math.max(tr.width, Number(el.dataset.min || 0));
      let left = tr.left - hr.left;
      if (left + w > hr.width) left = Math.max(0, hr.width - w);
      el.style.setProperty('--sg-left', left + 'px');
      el.style.setProperty('--sg-top', (tr.bottom - hr.top + 6) + 'px');
      el.style.setProperty('--sg-w', w + 'px');
    });
  }

  /* A clear (x) button inside the selected locality value. */
  function addClear() {
    document.querySelectorAll('.sg-host[data-clear] .sf-loc .val').forEach((val) => {
      if (val.querySelector('.sf-clear')) return;
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'sf-clear'; b.setAttribute('aria-label', 'Clear locality'); b.innerHTML = FP.icon('x');
      val.appendChild(b);
    });
  }

  /* Suggestions panel templates (ADD-07). A placeholder <div data-sg="results" data-q="Vel" data-for=".sf-loc"> becomes the panel
     before the shared components mount, so the icons and positioning below are applied by the normal mount step. */
  const FPA = (window.FPA = window.FPA || {});
  const ico = (n) => `<fp-icon n="${n}"></fp-icon>`;
  const PLACES = [['Velachery', 'Chennai, Tamil Nadu · 600042'], ['Velachery Main Road', 'Velachery, Chennai · 600042'], ['Velachery MRTS Station', 'Velachery, Chennai · 600042'], ['Vellore', 'Vellore, Tamil Nadu'], ['Velankanni', 'Nagapattinam, Tamil Nadu']];
  const PLACES_POR = [['Porur', 'Chennai, Tamil Nadu · 600116'], ['Porur Junction', 'Porur, Chennai · 600116'], ['Porur Lake', 'Porur, Chennai · 600116'], ['Porur Gardens', 'Porur, Chennai · 600116']];
  const hl = (t, q) => { const i = q ? t.toLowerCase().indexOf(q.toLowerCase()) : -1; return i < 0 ? t : t.slice(0, i) + '<mark>' + t.slice(i, i + q.length) + '</mark>' + t.slice(i + q.length); };
  const prow = (p, q, cur) => `<div class="sg-row${cur ? ' is-current' : ''}" role="option" aria-selected="${!!cur}"><span class="ic">${ico('pin')}</span><div><div class="t">${hl(p[0], q)}</div><div class="s">${p[1]}</div></div>${cur ? `<span class="end">${ico('arrow-l').replace('arrow-l', 'arrow')}</span>` : ''}</div>`;
  const kw = (q) => `<div class="sg-row" role="option" aria-selected="false"><span class="ic">${ico('search')}</span><div><div class="t">Search for “${q}” as a keyword</div><div class="s">Matches listings by name, street or locality text</div></div></div>`;
  FPA.suggest = function (kind, q, o) {
    q = q || '';
    let body; let status;
    if (kind === 'idle' || kind === 'typing') {
      status = 'Type at least 3 characters to see suggestions.';
      body = `<div class="sg-hint">${ico('search')}<div><b>Type at least 3 characters</b><br>${kind === 'typing' ? 'One more letter and suggestions appear.' : 'Start with an area, a street or a landmark, for example “Velachery”.'}</div></div><div class="sg-hint">${ico('pin')}<div>Suggestions cover <b>Tamil Nadu</b> only for now.</div></div>`;
    } else if (kind === 'loading') {
      status = 'Looking for places.';
      body = [1, 2, 3].map(() => `<div class="sg-skel" aria-hidden="true"><span class="sk circ"></span><div class="l"><span class="sk line" style="width:55%"></span><span class="sk line" style="width:35%"></span></div></div>`).join('') + '<span class="sr-only">Looking for places</span>';
    } else if (kind === 'noresults') {
      status = 'No places found.';
      body = `<div class="sg-hint">${ico('info')}<div><b>No places found for “${q}”</b><br>Check the spelling or try a nearby area.</div></div><div class="sg-sep"></div>${kw(q)}`;
    } else if (kind === 'degraded') {
      status = 'Suggestions are not available.';
      body = `<div class="sg-hint">${ico('alert')}<div><b>Suggestions aren't available right now</b><br>Type the area and press Search. We'll match it by name.</div></div><div class="sg-sep"></div>${kw(q)}`;
    } else if (kind === 'ratelimited') {
      status = 'Too many searches.';
      body = `<div class="sg-hint">${ico('clock')}<div><b>Too many searches in a moment</b><br>Wait a few seconds and keep typing.</div></div>`;
    } else {
      const list = q.toLowerCase().indexOf('por') === 0 ? PLACES_POR : PLACES;
      status = list.length + ' suggestions available. Use the up and down arrow keys, then Enter.';
      body = list.map((p, i) => prow(p, q, i === 1)).join('');
    }
    const bar = `<div class="sg-bar"><button class="icon-btn" type="button" aria-label="Close suggestions">${ico('arrow-l')}</button><div class="input-wrap has-end" style="flex:1">${ico('search')}<input class="input" value="${q}" aria-label="Locality" autocomplete="off" inputmode="search"></div></div>`;
    const foot = `<div class="sg-foot"><span>Powered by <b>Ola Maps</b></span><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">© OpenStreetMap contributors · ODbL</a></div>`;
    return `<div class="suggest" data-for="${(o && o.for) || '.sf-loc'}" data-min="${(o && o.min) || 0}" aria-label="Place suggestions">${bar}<div class="sg-body" role="listbox" aria-label="Place suggestions">${body}</div><div class="sr-only" role="status">${status}</div>${foot}</div>`;
  };
  document.querySelectorAll('[data-sg]').forEach((ph) => { ph.outerHTML = FPA.suggest(ph.dataset.sg, ph.dataset.q, { for: ph.dataset.for, min: ph.dataset.min }); });

  const mount = FP.mount;
  FP.mount = function () {
    mount.apply(this, arguments);
    if (aiOff) stripAi();
    rewriteLinks();
    drawQr();
    drawMaps();
    addClear();
    placeSuggest();
  };
  window.addEventListener('load', placeSuggest);
  window.addEventListener('resize', placeSuggest);
  window.addEventListener('hashchange', () => setTimeout(placeSuggest, 0));
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeSuggest);
})();
