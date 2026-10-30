/* Find Prop — charts (inline SVG/HTML, no library). Built to the dataviz method:
   2 px lines, ≥ 8 px end dots with a 2 px surface ring, hairline grid, 4 px rounded bar ends, 2 px surface gaps,
   text in ink tokens (never series colour), legend for ≥ 2 series, crosshair + one tooltip for all series, table view.
   Series colours come from the validated --c-series-* tokens, assigned in fixed order. */
window.FP = window.FP || {};
(function () {
  const REG = {};
  let cid = 0;
  const fmt = (v) => Number(v).toLocaleString('en-IN');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
  const COLORS = ['var(--c-series-1)', 'var(--c-series-2)', 'var(--c-series-3)', 'var(--c-series-4)'];

  /** Multi- or single-series line chart. o = {labels, series:[{name,data}], yMax, yMin, ticks, w, h, area, endLabels, tickEvery, unit} */
  FP.line = function (o) {
    const id = ++cid;
    HOSTS[id] = o;
    return `<div class="chart-host" data-lid="${id}" style="min-height:${o.h || 260}px"></div>`;
  };
  const HOSTS = {};
  FP.lineSVG = function (o) {
    const w = o.w || 640, h = o.h || 260;
    const m = { l: 44, r: o.endLabels === false ? 16 : 104, t: 14, b: 30 };
    const pw = w - m.l - m.r, ph = h - m.t - m.b;
    const n = o.labels.length;
    const yMin = o.yMin || 0, yMax = o.yMax;
    const X = (i) => m.l + (n === 1 ? pw / 2 : (i * pw) / (n - 1));
    const Y = (v) => m.t + ph - ((v - yMin) / (yMax - yMin)) * ph;
    const id = ++cid;
    REG[id] = { labels: o.labels, series: o.series.map((s, i) => ({ name: s.name, data: s.data, color: COLORS[(s.slot || i + 1) - 1] })), unit: o.unit || '', X: o.labels.map((_, i) => X(i)), Y, w, h, m };
    const ticks = o.ticks || [yMin, yMax];
    const grid = ticks.map((t) => `<line class="grid" x1="${m.l}" x2="${w - m.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${m.l - 10}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`).join('');
    const every = o.tickEvery || Math.ceil(n / 6);
    const xl = o.labels.map((l, i) => (i % every === 0 ? `<text x="${X(i)}" y="${h - 8}" text-anchor="middle">${esc(l)}</text>` : '')).join('');
    const col = (i) => COLORS[(o.series[i].slot || i + 1) - 1];
    const lines = o.series.map((s, i) => {
      const d = s.data.map((v, k) => `${k ? 'L' : 'M'}${X(k).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
      const area = o.area ? `<path d="${d}L${X(n - 1)} ${Y(yMin)}L${X(0)} ${Y(yMin)}Z" fill="${col(i)}" opacity=".1"/>` : '';
      const lx = X(n - 1), ly = Y(s.data[n - 1]);
      const dot = `<circle cx="${lx}" cy="${ly}" r="6" fill="var(--c-surface)"/><circle cx="${lx}" cy="${ly}" r="4" fill="${col(i)}"/>`;
      const lab = o.endLabels === false ? '' : `<text x="${lx + 14}" y="${ly + 4}"><tspan font-weight="700" style="fill:var(--c-ink)">${fmt(s.data[n - 1])}${o.unit || ''}</tspan><tspan dx="5">${esc(s.name)}</tspan></text>`;
      return `${area}<path d="${d}" fill="none" stroke="${col(i)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>${dot}${lab}`;
    }).join('');
    const hov = `<line class="xhair" x1="0" x2="0" y1="${m.t}" y2="${m.t + ph}" hidden/>${o.series.map((_, i) => `<g class="hdot" hidden data-i="${i}"><circle r="6" fill="var(--c-surface)"/><circle r="4" fill="${col(i)}"/></g>`).join('')}`;
    const label = `${o.title || 'Line chart'}: ${o.series.map((s) => s.name).join(', ')}`;
    const legend = o.series.length > 1 ? `<div class="legend" style="margin-top:12px">${o.series.map((s, i) => `<span><i class="line" style="background:${col(i)}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';
    return `<div class="chart-wrap" data-cid="${id}"><svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}" tabindex="0">${grid}<line class="axis" x1="${m.l}" x2="${w - m.r}" y1="${Y(yMin)}" y2="${Y(yMin)}"/>${xl}${lines}${hov}<rect class="hit" x="${m.l}" y="${m.t}" width="${pw}" height="${ph}" fill="transparent"/></svg><div class="tt" role="status" hidden></div>${legend}</div>`;
  };

  /** Horizontal bars, one series (nominal categories share slot 1). rows = [[label, value]] */
  FP.hbars = function (rows, o = {}) {
    const max = o.max || Math.max(...rows.map((r) => r[1]));
    return `<div class="hbars" role="img" aria-label="${esc(o.title || 'Bar chart')}">${rows.map(([l, v]) => `<div class="hb" tabindex="0" title="${esc(l)}: ${fmt(v)}"><span class="l">${esc(l)}</span><span class="bw"><i style="width:${Math.max(2, (v / max) * 100).toFixed(1)}%"></i><b class="num">${fmt(v)}</b></span></div>`).join('')}</div>`;
  };

  /** Part-to-whole: one stacked bar with 2 px gaps + a legend table. parts = [[name, value]] (≤ 4, then "Other") */
  FP.share = function (parts) {
    const total = parts.reduce((a, p) => a + p[1], 0);
    const colors = parts.map((_, i) => (parts[i][0] === 'Other' ? 'var(--c-series-other)' : COLORS[i]));
    const bar = parts.map((p, i) => `<i style="flex:${p[1]};background:${colors[i]}" title="${esc(p[0])}: ${fmt(p[1])}"></i>`).join('');
    const rows = parts.map((p, i) => `<tr><td><span class="sw" style="background:${colors[i]}"></span>${esc(p[0])}</td><td class="r num">${fmt(p[1])}</td><td class="r num muted">${Math.round((p[1] / total) * 100)}%</td></tr>`).join('');
    return `<div class="share" role="img" aria-label="Share by source: ${parts.map((p) => `${p[0]} ${Math.round((p[1] / total) * 100)} percent`).join(', ')}"><div class="sbar">${bar}</div><table class="stbl"><tbody>${rows}</tbody></table></div>`;
  };

  /** Plain table twin of a line chart (the accessible alternative). */
  FP.lineTable = function (o) {
    const r = o.labels.map((l, i) => `<tr><th scope="row">${esc(l)}</th>${o.series.map((s) => `<td class="r num">${fmt(s.data[i])}${o.unit || ''}</td>`).join('')}</tr>`).join('');
    return `<div class="tbl-scroll" style="max-height:280px;overflow:auto"><table class="tbl" style="min-width:0"><thead><tr><th>${o.xName || 'Date'}</th>${o.series.map((s) => `<th class="r">${esc(s.name)}</th>`).join('')}</tr></thead><tbody>${r}</tbody></table></div>`;
  };

  function show(wrap, idx) {
    const c = REG[wrap.dataset.cid];
    const svg = wrap.querySelector('svg');
    const sx = svg.getBoundingClientRect().width / c.w;
    const xh = svg.querySelector('.xhair');
    xh.setAttribute('x1', c.X[idx]); xh.setAttribute('x2', c.X[idx]); xh.hidden = false;
    svg.querySelectorAll('.hdot').forEach((g, i) => { g.hidden = false; g.setAttribute('transform', `translate(${c.X[idx]} ${c.Y(c.series[i].data[idx])})`); });
    const tt = wrap.querySelector('.tt');
    tt.replaceChildren();
    const t = document.createElement('div'); t.className = 'tt-h'; t.textContent = c.labels[idx]; tt.appendChild(t);
    c.series.forEach((s) => {
      const row = document.createElement('div'); row.className = 'tt-r';
      const key = document.createElement('i'); key.style.background = s.color;
      const v = document.createElement('b'); v.textContent = fmt(s.data[idx]) + c.unit;
      const n = document.createElement('span'); n.textContent = s.name;
      row.append(key, v, n); tt.appendChild(row);
    });
    tt.hidden = false;
    const left = c.X[idx] * sx;
    const w = tt.offsetWidth;
    tt.style.left = Math.min(Math.max(left + 14, 0), svg.getBoundingClientRect().width - w) + 'px';
    tt.style.top = '8px';
    wrap.dataset.idx = idx;
  }
  function hide(wrap) { wrap.querySelector('.tt').hidden = true; wrap.querySelector('.xhair').hidden = true; wrap.querySelectorAll('.hdot').forEach((g) => (g.hidden = true)); }

  /* Charts are drawn at their real pixel width so text stays 12 px at every viewport; redrawn on resize. */
  FP.renderCharts = function (hoverIdx) {
    document.querySelectorAll('.chart-host[data-lid]').forEach((host) => {
      const o = HOSTS[host.dataset.lid];
      const width = Math.round(host.getBoundingClientRect().width);
      if (!width) return;
      if (host.dataset.w === String(width)) return;
      host.dataset.w = width;
      const h = Math.round(Math.min(o.h || 260, Math.max(190, width * 0.42)));
      const compact = width < 480;
      host.innerHTML = FP.lineSVG({ ...o, w: width, h, endLabels: compact ? false : o.endLabels, tickEvery: compact ? Math.ceil(o.labels.length / 4) : o.tickEvery });
      host.style.minHeight = '';
    });
    FP.wireCharts(hoverIdx);
  };
  let lastHover = null, rz;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => FP.renderCharts(lastHover), 120); });
  FP.setHover = (i) => { lastHover = i; };

  FP.wireCharts = function (hoverIdx) {
    document.querySelectorAll('.chart-wrap[data-cid]').forEach((wrap) => {
      if (wrap.dataset.wired === '1') { if (hoverIdx != null) show(wrap, Math.min(hoverIdx, REG[wrap.dataset.cid].labels.length - 1)); return; }
      wrap.dataset.wired = '1';
      const c = REG[wrap.dataset.cid];
      const svg = wrap.querySelector('svg');
      const idxAt = (clientX) => { const r = svg.getBoundingClientRect(); const x = ((clientX - r.left) / r.width) * c.w; let best = 0; c.X.forEach((px, i) => { if (Math.abs(px - x) < Math.abs(c.X[best] - x)) best = i; }); return best; };
      svg.addEventListener('pointermove', (e) => show(wrap, idxAt(e.clientX)));
      svg.addEventListener('pointerleave', () => hide(wrap));
      svg.addEventListener('keydown', (e) => { const i = Number(wrap.dataset.idx ?? c.labels.length - 1); if (e.key === 'ArrowLeft') { e.preventDefault(); show(wrap, Math.max(0, i - 1)); } if (e.key === 'ArrowRight') { e.preventDefault(); show(wrap, Math.min(c.labels.length - 1, i + 1)); } if (e.key === 'Escape') hide(wrap); });
      svg.addEventListener('focus', () => show(wrap, c.labels.length - 1));
      svg.addEventListener('blur', () => hide(wrap));
      if (hoverIdx != null && wrap.dataset.hover !== 'off') show(wrap, Math.min(hoverIdx, c.labels.length - 1));
    });
  };
})();
