/* Find Prop — shared UI components. Each is defined once here and used by every screen through a custom tag,
   e.g. <fp-header role="user" active="buy">, so the header, footer, cards and ad container cannot drift between screens.
   Also: #state handling (data-show / data-default), tiny click behaviours for the mockups. */
window.FP = window.FP || {};
(function () {
  const icon = FP.icon;
  const D = FP.data;
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const asBool = (v) => v === '' || v === true || v === 'true';
  const list = (v) => (v == null || v === '' ? [] : String(v).split(',').map((s) => s.trim()));
  const T = (FP.tags = {});

  /* ── Navigation ───────────────────────────────── */
  const NAV = [['buy', 'Buy', 'search.html#buy'], ['rent', 'Rent', 'search.html#rent'], ['projects', 'Projects', 'projects.html'], ['ai', 'AI Search', 'ai-search.html'], ['contact', 'Contact', 'contact.html']];

  FP.accountMenu = function (role) {
    const u = D.user;
    const chip = { builder: '<span class="role-chip">Builder</span>', admin: '<span class="role-chip admin">Super admin</span>', agent: '<span class="role-chip">Agent</span>' }[role] || '';
    const row = (ic, label, href, meta, metaCls = 'n') => `<a href="${href}" role="menuitem">${icon(ic)}${label}${meta ? `<span class="meta ${metaCls}">${meta}</span>` : ''}</a>`;
    const portals = {
      builder: row('briefcase', 'Builder portal', 'builder-dashboard.html'),
      admin: row('layers', 'Admin portal', 'admin-overview.html'),
      agent: `<a href="dashboard.html" role="menuitem">${icon('users')}Agent workspace<span class="flag" style="margin-left:auto">Proposed</span></a>`,
    }[role] || '';
    return `<div class="menu hdr-menu" role="menu" aria-label="Account">
      <div class="who"><span class="avatar lg">${u.initials}</span><div><b>${u.name}</b><span>${u.email}</span>${chip ? `<div>${chip}</div>` : ''}</div></div>
      <div class="sep"></div>
      <div class="lbl overline">Dashboard</div>
      ${row('heart', 'Saved homes', 'dashboard.html#saved', 3)}
      ${row('building', 'My listings', 'dashboard.html#listings', 2)}
      ${row('inbox', 'Enquiries received', 'dashboard.html#received', '1 new', '')}
      ${row('send', 'My enquiries', 'dashboard.html#sent', 2)}
      <div class="sep"></div>
      ${row('plus', 'Post a property', 'post-property.html')}
      ${portals ? `<div class="sep"></div><div class="lbl overline">Workspaces</div>${portals}` : ''}
      <div class="sep"></div>
      ${row('logout', 'Sign out', 'home-a.html')}
    </div>`;
  };

  FP.header = function (a = {}) {
    const role = a.role || 'visitor';
    const active = a.active || '';
    const signed = role !== 'visitor';
    const u = D.user;
    const nav = NAV.map(([k, l, h]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}${k === 'ai' ? ' class="ai"' : ''}>${k === 'ai' ? icon('sparkle') : ''}${l}</a>`).join('');
    const right = signed
      ? `<a class="post" href="post-property.html">${icon('plus')}Post property</a>
         <a class="hdr-icon" href="dashboard.html#saved" aria-label="Saved homes, 3">${icon('heart')}<span class="dot">3</span></a>
         <button class="avatar-btn${a.menu ? ' is-hover' : ''}" type="button" aria-haspopup="menu" aria-expanded="${!!asBool(a.menu)}" aria-label="Account menu"><span class="avatar">${u.initials}</span>${icon('chev')}</button>`
      : `<a class="post" href="post-property.html">${icon('plus')}Post property</a><a class="signin" href="auth.html">Sign in</a>`;
    return `<a class="skip" href="#main">Skip to content</a>
    <header class="hdr${a.line ? ' line' : ''}" role="banner"><div class="container">
      <a class="logo" href="home-a.html" aria-label="Find Prop, home"><svg class="mark" aria-hidden="true"><use href="#logo-mark"/></svg><span>Find <b>Prop</b></span></a>
      <nav class="nav" aria-label="Main">${nav}</nav>
      <div class="hdr-r">${right}<button class="menu-btn" type="button" aria-label="Open menu" aria-haspopup="dialog">${icon('menu')}</button></div>
    </div>${asBool(a.menu) ? FP.accountMenu(role) : ''}</header>`;
  };

  FP.drawer = function (a = {}) {
    const role = a.role || 'visitor';
    const active = a.active || '';
    const signed = role !== 'visitor';
    const big = NAV.map(([k, l, h]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}${k === 'ai' ? ' class="ai"' : ''}>${l}${icon('chev-r')}</a>`).join('');
    const u = D.user;
    const acct = signed
      ? `<div class="group"><span class="overline">Your account</span>
           <a class="link-row" href="dashboard.html#saved">${icon('heart')}Saved homes<span class="meta" style="background:var(--c-bg-sunken);color:var(--c-ink)">3</span></a>
           <a class="link-row" href="dashboard.html#listings">${icon('building')}My listings<span class="meta" style="background:var(--c-bg-sunken);color:var(--c-ink)">2</span></a>
           <a class="link-row" href="dashboard.html#received">${icon('inbox')}Enquiries received<span class="meta">1</span></a>
           <a class="link-row" href="dashboard.html#sent">${icon('send')}My enquiries</a></div>
         ${role === 'builder' ? `<div class="group"><span class="overline">Workspaces</span><a class="link-row" href="builder-dashboard.html">${icon('briefcase')}Builder portal</a></div>` : ''}
         ${role === 'admin' ? `<div class="group"><span class="overline">Workspaces</span><a class="link-row" href="admin-overview.html">${icon('layers')}Admin portal</a></div>` : ''}`
      : '';
    const cta = signed
      ? `<a class="btn btn--accent btn--block" href="post-property.html">${icon('plus')}Post a property</a><a class="btn btn--secondary btn--block" href="home-a.html">${icon('logout')}Sign out</a>`
      : `<a class="btn btn--accent btn--block" href="post-property.html">${icon('plus')}Post a property</a><a class="btn btn--primary btn--block" href="auth.html">Sign in</a><a class="btn btn--secondary btn--block" href="auth.html#signup">Create account</a>`;
    return `<div class="navdrawer" role="dialog" aria-modal="true" aria-label="Menu">
      <div class="top"><a class="logo" href="home-a.html"><svg class="mark" aria-hidden="true"><use href="#logo-mark"/></svg><span>Find <b>Prop</b></span></a><button class="icon-btn" type="button" aria-label="Close menu">${icon('x')}</button></div>
      ${signed ? `<div class="row" style="padding:8px 0 14px"><span class="avatar lg">${u.initials}</span><div><b>${u.name}</b><div class="small muted">${u.email}</div></div></div>` : ''}
      <nav class="big" aria-label="Main">${big}</nav>
      ${acct}
      <div class="cta">${cta}</div>
    </div>`;
  };

  FP.bottombar = function (a = {}) {
    const on = a.active || '';
    const it = (k, ic, l, h, extra = '') => `<a href="${h}" class="${k === 'post' ? 'post ' : ''}${on === k ? 'on' : ''}"${on === k ? ' aria-current="page"' : ''}>${icon(ic)}${l}${extra}</a>`;
    return `<nav class="bottombar" aria-label="Primary">${it('home', 'home', 'Home', 'home-a.html')}${it('search', 'search', 'Search', 'search.html')}${it('post', 'plus', 'Post', 'post-property.html')}${it('saved', 'heart', 'Saved', 'dashboard.html#saved', '<span class="badge-dot">3</span>')}${it('me', 'user', 'Me', 'dashboard.html#listings')}</nav>`;
  };

  FP.footer = function () {
    return `<footer class="ftr on-dark"><div class="container">
      <div class="ftr-grid">
        <div><a class="logo" href="home-a.html"><svg class="mark" aria-hidden="true"><use href="#logo-mark"/></svg><span>Find <b>Prop</b></span></a>
          <p>Search, shortlist and compare homes across Chennai, and enquire directly with owners and builders.</p></div>
        <div class="ftr-cols" style="display:contents">
          <div><h4>Explore</h4><ul><li><a href="search.html#buy">Buy a home</a></li><li><a href="search.html#rent">Rent a home</a></li><li><a href="projects.html">New projects</a></li><li><a href="ai-search.html">AI search</a></li></ul></div>
          <div><h4>For owners and builders</h4><ul><li><a href="post-property.html">Post a property</a></li><li><a href="dashboard.html#listings">My listings</a></li><li><a href="builder-login.html">Builder sign in</a></li><li><a href="contact.html">Contact us</a></li></ul></div>
        </div>
        <div><h4>Contact</h4>
          <div class="ci">${icon('phone')}<span>+91 90000 00000</span></div>
          <div class="ci">${icon('mail')}<span>hello@findprop.example</span></div>
          <div class="ci">${icon('pin')}<span>Chennai, Tamil Nadu</span></div></div>
      </div>
      <div class="ftr-bottom"><span>© 2026 Find Prop. Sample footer: content comes from the Footer CMS settings.</span><a href="contact.html">Contact</a></div>
    </div></footer>`;
  };

  /* ── Search card ──────────────────────────────── */
  FP.search = function (o = {}) {
    const layout = o.layout || 'wide';
    const intent = o.intent || 'buy';
    const f = (cls, key, lbl, val, ph, ic, chev, short) => `<label class="sf ${cls}${o.focus === key ? ' is-focus' : ''}${o.hover === key ? ' is-hover' : ''}"><span class="lbl"><span class="long">${lbl}</span><span class="short">${short || lbl}</span></span><span class="val">${ic ? icon(ic) : ''}${val ? `<span class="truncate">${val}</span>` : `<span class="ph truncate">${ph}</span>`}${chev ? icon('chev', 'chev') : ''}</span></label>`;
    const help = o.help === false ? '' : `<div class="s-help"><span>Popular</span>${D.popular.slice(0, layout === 'stacked' ? 3 : 4).map((p) => `<a class="chip" href="search.html">${p}</a>`).join('')}<span class="sep"></span><span>Quick picks</span><a class="chip" href="search.html">3 BHK</a><a class="chip" href="search.html">Budget homes</a></div>`;
    return `<section class="search search--${layout}" aria-label="Property search">
      <div class="s-top">
        <div class="seg" role="tablist" aria-label="Looking to"><button type="button" role="tab" aria-selected="${intent === 'buy'}" class="${intent === 'buy' ? 'on' : ''}">Buy</button><button type="button" role="tab" aria-selected="${intent === 'rent'}" class="${intent === 'rent' ? 'on' : ''}">Rent</button><a href="projects.html" role="tab" aria-selected="false">New projects ${icon('arrow')}</a></div>
        <a class="ai-link" href="ai-search.html">${icon('sparkle')}Describe it in words</a>
      </div>
      <div class="s-row">
        ${f('sf-loc', 'loc', 'Locality', o.loc, 'Search a locality', 'pin', false)}${f('sf-type', 'type', 'Property type', o.type, 'Any type', '', true, 'Type')}${f('sf-bhk', 'bhk', 'Bedrooms', o.bhk, 'Any BHK', '', true)}${f('sf-bud', 'bud', 'Max budget', o.budget, 'Any budget', '', true, 'Budget')}
        <button class="go${o.hover === 'go' ? ' is-hover' : ''}" type="button">${icon('search')}Search</button>
      </div>${help}${o.extra || ''}
    </section>`;
  };

  /* ── Cards ────────────────────────────────────── */
  FP.pcard = function (p, o = {}) {
    if (typeof p !== 'object') p = FP.byId(D.props, p);
    const specs = [p.bhk ? `<li>${icon('bed')}${p.bhk} BHK</li>` : '', p.bath ? `<li>${icon('bath')}${p.bath} Bath</li>` : '', p.area ? `<li>${icon('area')}${p.area} sq.ft</li>` : ''].join('');
    const badges = `<span class="badge badge--type">${p.lt === 'sale' ? 'For sale' : 'For rent'}</span>${p.label ? `<span class="badge badge--${p.label}">${cap(p.label)}</span>` : ''}`;
    const dots = o.dots === false ? '' : '<div class="pcard-dots"><i class="on"></i><i></i><i></i></div>';
    return `<article class="pcard${o.compared ? ' is-compared' : ''}${o.hover ? ' is-hover' : ''}${o.list ? ' pcard--list' : ''}">
      <div class="pcard-media">${FP.art(p.art[0], p.art[1], `Illustrated placeholder for ${p.t}`)}<div class="pcard-badges">${badges}</div>${dots}</div>
      <button class="pcard-save" type="button" aria-pressed="${!!o.saved}" aria-label="${o.saved ? 'Remove from saved homes' : 'Save to shortlist'}">${icon('heart')}</button>
      <div class="pcard-body">
        <div class="pcard-top"><div class="price num">${p.price}${p.per ? `<span class="per">${p.per}</span>` : ''}</div><span class="pcard-age">${p.age}</span></div>
        <h3 class="pcard-title ${o.list ? '' : 'clamp-2'}"><a class="stretched" href="property.html">${p.t}</a></h3>
        <div class="pcard-loc">${icon('pin')}<span class="truncate">${p.loc}, Chennai</span></div>
        ${specs ? `<ul class="pcard-specs">${specs}</ul>` : ''}
        ${o.list ? `<p class="desc clamp-2">${p.pt} in ${p.loc}${p.furn ? `, ${p.furn.toLowerCase()}` : ''}. Listed ${p.age}.</p>` : ''}
      </div>
      <div class="pcard-foot"><button class="cmp" type="button" aria-pressed="${!!o.compared}"${o.cmpDisabled ? ' disabled title="You can compare up to 3 homes"' : ''}><span class="box">${icon('check')}</span>${o.compared ? 'Added to compare' : 'Compare'}</button><span class="meta">${p.pt}</span></div>
    </article>`;
  };
  FP.pcardSkeleton = () => `<article class="pcard skeleton" aria-hidden="true"><div class="pcard-media"><div class="sk"></div></div><div class="pcard-body"><div class="sk line l" style="width:42%"></div><div class="sk line" style="width:92%"></div><div class="sk line" style="width:64%"></div><div class="sk line" style="width:78%;margin-top:6px"></div></div><div class="pcard-foot"><div class="sk line" style="width:90px"></div></div></article>`;

  FP.jcard = function (j) {
    if (typeof j !== 'object') j = FP.byId(D.projects, j);
    return `<article class="jcard"><div class="jcard-media">${FP.art(j.art[0], j.art[1], `Illustrated placeholder for ${j.name}`)}<div class="pcard-badges">${j.featured ? '<span class="badge badge--featured">Featured</span>' : ''}<span class="badge badge--type">${j.status}</span></div></div>
      <div class="jcard-body"><span class="jcard-builder">${j.builder}</span><h3 class="jcard-name"><a class="stretched" href="project.html">${j.name}</a></h3>
        <div class="pcard-loc">${icon('pin')}<span>${j.loc}, Chennai</span></div><div class="jcard-price num">${j.range}</div>
        <div class="jcard-chips">${j.bhk.map((b) => `<span class="tag">${b}</span>`).join('')}</div></div></article>`;
  };

  FP.tiles = function () {
    return `<div class="tiles">${D.tiles.map(([n, s, c], i) => `<a class="tile ${c}" href="search.html"><svg class="arch" viewBox="0 0 46 64" aria-hidden="true"><path d="M5 62V27a18 18 0 0 1 36 0V62" fill="none" stroke="${i % 2 ? '#9A4A20' : '#1F4A38'}" stroke-width="3" stroke-linecap="round"/><circle cx="23" cy="40" r="3.2" fill="${i % 2 ? '#9A4A20' : '#1F4A38'}"/></svg>${n}<small>${s}</small></a>`).join('')}</div>`;
  };

  FP.bcard = function (b) {
    return `<article class="bcard"><div class="head"><span class="mono ${b.cls}">${b.mono}</span><div><b>${b.name}</b><span>${b.count} projects</span></div></div><p>${b.about}</p>
      <div class="thumbs">${b.projects.map((id) => { const j = FP.byId(D.projects, id); return `<a class="thumb" href="project.html"><div class="ph">${FP.art(j.art[0], j.art[1], `Illustrated placeholder for ${j.name}`)}</div><span>${j.name}</span></a>`; }).join('')}</div></article>`;
  };

  FP.stat = function (label, value, o = {}) {
    const tag = o.href ? 'a' : 'div';
    return `<${tag} class="stat${o.attn ? ' attn' : ''}"${o.href ? ` href="${o.href}"` : ''}><div class="top"><span class="lbl">${label}</span>${o.icon ? `<span class="ic ${o.tone || ''}">${icon(o.icon)}</span>` : ''}</div><div class="val num">${value}</div>${o.sub ? `<div class="sub">${o.sub}</div>` : ''}</${tag}>`;
  };

  FP.gallery = function (o = {}) {
    const kinds = o.kinds || [['apartment', 1], ['living', 0], ['bedroom', 0], ['kitchen', 0], ['balcony', 1], ['floorplan', 0]];
    const act = o.active || 0;
    const label = (k) => ({ apartment: 'Exterior', lowrise: 'Exterior', twin: 'Exterior', villa: 'Exterior', house: 'Exterior', plot: 'Site', commercial: 'Exterior', living: 'Living room', bedroom: 'Bedroom', kitchen: 'Kitchen', balcony: 'View from the balcony', floorplan: 'Floor plan' }[k] || k);
    const [mk, mv] = kinds[act];
    return `<div class="gallery${o.bleed === false ? '' : ' bleed'}" aria-roledescription="carousel" aria-label="Photos">
      <div class="main">${FP.art(mk, mv, `Illustrated placeholder: ${label(mk)}`)}
        ${o.badges ? `<div class="pcard-badges">${o.badges}</div>` : ''}
        <button class="nav-btn prev" type="button" aria-label="Previous photo">${icon('chev-l')}</button><button class="nav-btn next" type="button" aria-label="Next photo">${icon('chev-r')}</button>
        <span class="count">${icon('image')} ${act + 1} / ${kinds.length}</span></div>
      <div class="thumbs">${kinds.map(([k, v], i) => `<button type="button" class="${i === act ? 'on' : ''}" aria-label="Photo ${i + 1}: ${label(k)}" aria-current="${i === act}">${FP.art(k, v)}</button>`).join('')}</div>
      <div class="dots" aria-hidden="true">${kinds.map((_, i) => `<i class="${i === act ? 'on' : ''}"></i>`).join('')}</div></div>`;
  };

  FP.cmpbar = function (o = {}) {
    const ids = list(o.ids).map(Number);
    const slots = [0, 1, 2].map((i) => ids[i] ? `<div class="slot full">${FP.art(FP.byId(D.props, ids[i]).art[0], FP.byId(D.props, ids[i]).art[1])}<span class="x">${icon('x')}</span></div>` : '<div class="slot"></div>').join('');
    return `<div class="cmpbar" role="region" aria-label="Compare homes"><div class="slots">${slots}</div>
      <div class="txt">${ids.length} of 3<span class="hide-m"> selected</span><small>${ids.length < 2 ? 'Choose at least 2 homes to compare' : 'You can compare up to 3 homes'}</small></div>
      <button class="btn btn--ghost btn--sm clear" type="button">Clear all</button>
      <a class="btn btn--primary btn--sm${ids.length < 2 ? ' is-disabled' : ''}" href="compare.html"${ids.length < 2 ? ' aria-disabled="true"' : ''}>Compare now ${icon('arrow')}</a></div>`;
  };

  /* ── Sponsored container: platform-owned frame and label, advertiser-owned image ── */
  const AD = {
    strip: { d: ['strip-970x90', 970, 90], m: ['strip-m-320x100', 320, 100] },
    inline: { d: ['strip-970x90', 970, 90], m: ['strip-m-320x100', 320, 100] },
    panel: { d: ['panel-524x494', 524, 494], m: ['panel-m-640x320', 640, 320] },
  };
  FP.sponsor = function (o = {}) {
    const fmt = o.format || 'strip';
    const c = o.creative || 'a';
    const n = Number(o.n || 1);
    const i = Number(o.i || 1);
    const spec = AD[fmt];
    const dSrc = o.src || `../assets/ads/${spec.d[0]}-${c}.svg`;
    const mSrc = o.srcM || `../assets/ads/${spec.m[0]}-${c}.svg`;
    const pager = n > 1 ? `<span class="sp-pager"><button class="pg" type="button" aria-label="Previous sponsored banner">${icon('chev-l')}</button><span class="n">${i} / ${n}</span><button class="pg" type="button" aria-label="Next sponsored banner">${icon('chev-r')}</button></span>` : '';
    const info = asBool(o.info) ? `<div class="popover" style="position:absolute;right:0;top:30px;z-index:5;width:300px"><b>About sponsored content</b><br>This banner is a paid placement from an advertiser. <span class="flag">Wording to be approved</span></div>` : '';
    const cls = `sp sp--${fmt}`;
    return `<aside class="${cls}" aria-label="Sponsored">
      <div class="sp-meta"><span class="sp-label">Sponsored<span class="sample">Sample ad</span></span><span class="sp-ctl"><button type="button" aria-label="About this sponsored banner">${icon('info')}About this ad</button>${pager}</span></div>
      <a class="sp-frame${asBool(o.contain) ? ' is-contain' : ''}${asBool(o.loading) ? ' is-loading' : ''}" href="#" target="_blank" rel="sponsored noopener" aria-label="Sponsored banner (opens the advertiser's page in a new tab)">
        ${asBool(o.loading) ? '' : `<picture><source media="(max-width: 1023px)" srcset="${mSrc}"><img src="${dSrc}" width="${spec.d[1]}" height="${spec.d[2]}" alt="Sample advertiser banner, ${c.toUpperCase()}"></picture>`}</a>${info}</aside>`;
  };

  /* ── Home page sections shared by all three hero variations ── */
  FP.homeBelow = function () {
    const row = (ids, o) => ids.map((id) => FP.pcard(id, o && o[id])).join('');
    return `
    <section class="section"><div class="container">
      <div class="sect-head"><h2 class="h2">Explore by locality</h2><a class="link-arrow" href="search.html">See all localities ${icon('arrow')}</a></div>
      ${FP.tiles()}
    </div></section>

    <section class="section tight"><div class="container">
      <div class="sect-head"><h2 class="h2">Featured homes</h2><a class="link-arrow" href="search.html">View all ${icon('arrow')}</a></div>
      <div class="cards c3">${row([1, 3, 7, 2, 6, 9], { 1: { saved: true } })}</div>
    </div></section>

    <section class="section band"><div class="container">
      <div class="sect-head"><div><h2 class="h2">New launches from developers</h2><p class="muted mt-1">Approved and published projects only.</p></div><a class="link-arrow" href="projects.html">See all projects ${icon('arrow')}</a></div>
      <div class="cards c3">${D.builders.map(FP.bcard).join('')}</div>
    </div></section>

    <section class="section"><div class="container">
      <div class="sect-head"><h2 class="h2">Browse by what matters</h2></div>
      <div class="cat-grid">
        <a class="catcard" href="search.html">${icon('star')}<b>Featured</b><span>Hand-picked homes we recommend first</span>${icon('arrow', 'go')}</a>
        <a class="catcard" href="search.html">${icon('building')}<b>Prime</b><span>Premium addresses and large luxury homes</span>${icon('arrow', 'go')}</a>
        <a class="catcard" href="search.html">${icon('tag')}<b>Budget</b><span>Affordable homes that fit a smaller budget</span>${icon('arrow', 'go')}</a>
        <a class="catcard" href="search.html">${icon('pin')}<b>By locality</b><span>Browse homes area by area across Chennai</span>${icon('arrow', 'go')}</a>
      </div>
    </div></section>

    <section class="section tight"><div class="container">
      <div class="sect-head"><h2 class="h2">Newest on Find Prop</h2><div class="row gap-2 hide-m"><button class="icon-btn" type="button" aria-label="Previous">${icon('chev-l')}</button><button class="icon-btn" type="button" aria-label="Next">${icon('chev-r')}</button></div></div>
      <div class="hscroll">${row([6, 4, 12, 5, 9])}</div>
    </div></section>

    <section class="section"><div class="container">
      <div class="sect-head"><h2 class="h2">Why <em>Find Prop</em></h2></div>
      <div class="value-grid">
        <div class="valuecard"><span class="ic">${icon('shield')}</span><b>Approved listings only</b><p>Homes appear on Find Prop after they are approved.</p></div>
        <div class="valuecard"><span class="ic">${icon('msg')}</span><b>Enquire directly</b><p>Send your details to the owner or builder, and track the reply in your dashboard.</p></div>
        <div class="valuecard"><span class="ic">${icon('cols')}</span><b>Shortlist and compare</b><p>Save homes you like and compare up to three side by side.</p></div>
      </div>
    </div></section>

    <section class="section tight"><div class="container">
      <div class="ctaband"><div><h2 class="h2" style="color:#fff">Want to sell or rent your property?</h2><p>Post your property free. Your listing is reviewed, then goes live.</p></div><a class="btn btn--accent btn--lg" href="post-property.html">${icon('plus')}Post your property free</a></div>
    </div></section>`;
  };

  /* ── Custom tags → components ── */
  T.header = (a) => FP.header(a);
  T.footer = () => FP.footer();
  T.bottombar = (a) => FP.bottombar(a);
  T.drawer = (a) => FP.drawer(a);
  T.search = (a) => FP.search(a);
  T.sponsor = (a) => FP.sponsor(a);
  T.homebelow = () => FP.homeBelow();
  T.cmpbar = (a) => FP.cmpbar(a);
  T.accountmenu = (a) => FP.accountMenu(a.role || 'user');
  T.cards = (a) => {
    const ids = list(a.ids);
    const saved = list(a.saved);
    const cmp = list(a.compared);
    const cls = a.cols ? ` ${a.cols}` : '';
    const cmpFull = cmp.length >= 3;
    const adAfter = Number(a.adAfter || 0);
    const ad = adAfter ? `<div class="cards-ad">${FP.sponsor({ format: 'inline', creative: a.adCreative || 'b' })}</div>` : '';
    const html = ids.map((id) => FP.pcard(id, { saved: saved.includes(id), compared: cmp.includes(id), cmpDisabled: cmpFull && !cmp.includes(id), list: asBool(a.list) }));
    if (adAfter) html.splice(adAfter, 0, ad);
    return `<div class="cards${cls}${asBool(a.list) ? ' list' : ''}">${html.join('')}</div>`;
  };
  T.skeletons = (a) => `<div class="cards${a.cols ? ' ' + a.cols : ''}">${Array.from({ length: Number(a.n || 6) }, FP.pcardSkeleton).join('')}</div>`;
  T.projects = (a) => `<div class="cards${a.cols ? ' ' + a.cols : ''}">${list(a.ids).map((id) => FP.jcard(id)).join('')}</div>`;
  T.gallery = (a) => {
    const b = list(a.badges).map((k) => (k === 'sale' ? '<span class="badge badge--type">For sale</span>' : k === 'rent' ? '<span class="badge badge--type">For rent</span>' : `<span class="badge badge--${k}">${cap(k)}</span>`)).join('');
    const kinds = a.kinds ? a.kinds.split(',').map((k) => { const [n, v] = k.split(':'); return [n, Number(v || 0)]; }) : undefined;
    return FP.gallery({ badges: b, kinds, active: Number(a.active || 0), bleed: a.bleed === 'false' ? false : true });
  };
  T.tiles = () => FP.tiles();
  T.arches = (a) => FP.arches(a.pos);
  T.stat = (a) => FP.stat(a.label, a.value, { icon: a.icon, tone: a.tone, sub: a.sub, href: a.href, attn: asBool(a.attn) });
  T.icon = (a) => icon(a.n, a.class || '');
  T.art = (a) => FP.art(a.kind, Number(a.v || 0), a.alt || '');

  FP.mount = function () {
    for (let guard = 0; guard < 6; guard++) {
      const els = [...document.querySelectorAll('*')].filter((e) => e.localName.startsWith('fp-') && T[e.localName.slice(3)]);
      if (!els.length) break;
      els.forEach((el) => {
        const a = {};
        for (const at of el.attributes) a[at.name.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = at.value;
        const html = T[el.localName.slice(3)](a, el);
        const keep = ['data-show', 'data-hide'].filter((k) => el.hasAttribute(k)).map((k) => `${k}="${el.getAttribute(k)}"`).join(' ');
        el.outerHTML = keep ? `<div style="display:contents" ${keep}>${html}</div>` : html;
      });
    }
  };

  /* ── #state: show/hide blocks, tabs and spec overlay from the URL hash ── */
  FP.applyState = function () {
    const def = document.body.dataset.default || 'default';
    const raw = decodeURIComponent(location.hash.replace(/^#/, ''));
    const tokens = (raw ? raw.split(',') : def.split(',')).map((s) => s.trim()).filter(Boolean);
    document.documentElement.dataset.tokens = tokens.join(' ');
    document.querySelectorAll('[data-show]').forEach((el) => { el.hidden = !el.dataset.show.split(/\s+/).some((t) => t === '*' || tokens.includes(t)); });
    document.querySelectorAll('[data-hide]').forEach((el) => { if (el.dataset.hide.split(/\s+/).some((t) => tokens.includes(t))) el.hidden = true; });
    document.querySelectorAll('[data-tab]').forEach((el) => { const on = tokens.includes(el.dataset.tab); el.classList.toggle('on', on); if (on) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    document.querySelectorAll('[data-off]').forEach((el) => { if (el.dataset.off.split(/\s+/).some((t) => tokens.includes(t))) { el.classList.remove('on'); el.removeAttribute('aria-current'); } });
    if (tokens.includes('spec')) FP.measure();
    return tokens;
  };

  /* Spec overlay: label each [data-dim] box with its measured rendered size, so the numbers are real, not typed. */
  FP.measure = function () {
    const run = () => document.querySelectorAll('[data-dim]').forEach((box) => {
      const host = box.parentElement;
      const tgt = box.dataset.target ? host.querySelector(box.dataset.target) : host;
      const r = tgt.getBoundingClientRect();
      if (box.dataset.target) { const h = host.getBoundingClientRect(); Object.assign(box.style, { inset: 'auto', left: (r.left - h.left - 4) + 'px', top: (r.top - h.top - 4) + 'px', width: (r.width + 8) + 'px', height: (r.height + 8) + 'px' }); }
      const b = box.querySelector('b') || box.appendChild(document.createElement('b'));
      b.textContent = `${box.dataset.dim} · ${Math.round(r.width)} × ${Math.round(r.height)}`;
    });
    run();
    window.addEventListener('resize', run);
  };

  function behaviours() {
    document.addEventListener('click', (e) => {
      const save = e.target.closest('.pcard-save');
      if (save) { const on = save.getAttribute('aria-pressed') !== 'true'; save.setAttribute('aria-pressed', on); e.preventDefault(); return; }
      const cmp = e.target.closest('.cmp:not([disabled])');
      if (cmp) { const on = cmp.getAttribute('aria-pressed') !== 'true'; cmp.setAttribute('aria-pressed', on); cmp.closest('.pcard')?.classList.toggle('is-compared', on); e.preventDefault(); return; }
      const seg = e.target.closest('.seg button');
      if (seg) { seg.parentElement.querySelectorAll('button').forEach((b) => { b.classList.toggle('on', b === seg); b.setAttribute('aria-selected', b === seg); }); return; }
      const chip = e.target.closest('button.chip');
      if (chip) {
        const row = chip.closest('.chip-row.single');
        if (row) row.querySelectorAll('button.chip').forEach((b) => { b.classList.toggle('on', b === chip); b.setAttribute('aria-pressed', b === chip); });
        else { chip.classList.toggle('on'); chip.setAttribute('aria-pressed', chip.classList.contains('on')); }
      }
    });
  }

  function init() {
    if (!document.getElementById('fp-sprite')) {
      const holder = document.createElement('div');
      holder.id = 'fp-sprite';
      holder.innerHTML = FP.sprite();
      document.body.prepend(holder);
    }
    FP.mount();
    FP.applyState();
    if (FP.renderCharts) { const hv = document.documentElement.dataset.tokens.split(' ').includes('hover') ? 18 : null; FP.setHover(hv); FP.renderCharts(hv); window.addEventListener('hashchange', () => FP.renderCharts(document.documentElement.dataset.tokens.split(' ').includes('hover') ? 18 : null)); }
    window.addEventListener('hashchange', FP.applyState);
    behaviours();
    document.documentElement.classList.add('fp-ready');
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
