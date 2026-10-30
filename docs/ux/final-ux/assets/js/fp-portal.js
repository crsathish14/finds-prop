/* Find Prop — portal shell shared by the admin and builder areas.
   One component, two navigation sets. Admin and builder screens that Phase 1 says share components (projects, units,
   leads, insights) are built from the same functions below with a `mode`, as in the existing product. */
window.FP = window.FP || {};
(function () {
  const icon = FP.icon;
  const T = FP.tags;
  const asBool = (v) => v === '' || v === true || v === 'true';

  const ADMIN = [
    ['', [['overview', 'Overview', 'dash', 'admin-overview.html']]],
    ['Moderation', [['listings', 'Listings', 'tag', 'admin-listings.html', { meta: 14, proposed: true }], ['projects', 'Projects', 'building', 'admin-projects.html', { meta: 3 }]]],
    ['Inventory', [['units', 'Units', 'layers', 'admin-units.html'], ['builders', 'Builders', 'briefcase', 'admin-builders.html']]],
    ['Leads and CRM', [['leads', 'Leads', 'inbox', 'admin-leads.html'], ['forms', 'Forms', 'forms', 'admin-forms.html'], ['crm', 'CRM', 'plug', 'admin-crm.html']]],
    ['Site content', [['cms-header', 'Header', 'layout', 'admin-cms.html#header'], ['cms-hero', 'Hero', 'image', 'admin-cms.html#hero'], ['cms-homepage', 'Homepage', 'home', 'admin-cms.html#homepage'], ['cms-footer', 'Footer', 'file', 'admin-cms.html#footer']]],
  ];
  const BUILDER = [
    ['', [['dashboard', 'Dashboard', 'dash', 'builder-dashboard.html'], ['projects', 'Projects', 'building', 'builder-projects.html'], ['units', 'Units', 'layers', 'builder-units.html'], ['leads', 'Leads', 'inbox', 'builder-leads.html'], ['insights', 'Insights', 'chart', 'builder-insights.html'], ['profile', 'Profile', 'user', 'builder-profile.html']]],
  ];

  FP.sidebar = function (role, active, inDrawer) {
    const sets = role === 'admin' ? ADMIN : BUILDER;
    const nav = sets.map(([label, items]) => `${label ? `<div class="side-label">${label}</div>` : ''}${items.map(([k, l, ic, href, o = {}]) => `<a class="side-link" href="${href}"${k === active ? ' aria-current="page"' : ''} title="${l}">${icon(ic)}<span class="t">${l}</span>${o.proposed ? '<span class="tag-proposed">Proposed</span>' : ''}${o.meta ? `<span class="meta">${o.meta}</span>` : ''}</a>`).join('')}`).join('');
    return `<aside class="sidebar on-dark${inDrawer ? ' in-drawer' : ''}" aria-label="${role === 'admin' ? 'Admin' : 'Builder'} navigation">
      <div class="brand"><a class="logo" href="home-a.html" aria-label="Find Prop"><svg class="mark" aria-hidden="true"><use href="#logo-mark"/></svg><span>Find <b>Prop</b></span></a><span class="portal-tag">${role === 'admin' ? 'Admin' : 'Builder'}</span></div>
      <nav>${nav}</nav>
      <div class="foot"><a class="side-link" href="home-a.html">${icon('ext')}<span class="t">View public site</span></a><a class="side-link" href="${role === 'admin' ? 'auth.html' : 'builder-login.html'}">${icon('logout')}<span class="t">Sign out</span></a></div>
    </aside>`;
  };

  FP.portal = function (a, inner) {
    const role = a.role || 'admin';
    const who = role === 'admin' ? { i: 'SA', n: 'Super admin' } : { i: 'KH', n: 'Kadal Homes' };
    return `<a class="skip" href="#main">Skip to content</a>
    <div class="portal">
      ${FP.sidebar(role, a.active)}
      <div class="pmain">
        <header class="ptop"><button class="menu-btn" type="button" aria-label="Open navigation" aria-haspopup="dialog">${icon('menu')}</button>
          <a class="logo" href="home-a.html"><svg class="mark" aria-hidden="true"><use href="#logo-mark"/></svg><span>Find <b>Prop</b></span></a>
          <span class="role-chip${role === 'admin' ? ' admin' : ''}" style="margin:0">${role === 'admin' ? 'Admin' : 'Builder'}</span>
          <div class="right"><a class="viewsite" href="home-a.html">View public site${icon('ext')}</a>
            <button class="avatar-btn" type="button" aria-haspopup="menu" aria-label="Account menu"><span class="avatar${role === 'admin' ? '' : ' copper'}">${who.i}</span>${icon('chev')}</button></div></header>
        <main id="main" class="pbody">${inner}</main>
      </div>
    </div>
    ${asBool(a.drawer) ? `<div class="scrim right" style="justify-content:start;place-items:stretch start" role="dialog" aria-modal="true" aria-label="Navigation">${FP.sidebar(role, a.active, true)}</div>` : ''}`;
  };
  T.portal = (a, el) => FP.portal(a, el.innerHTML);
  T.sidebar = (a) => FP.sidebar(a.role || 'admin', a.active, false);
  T.portaldrawer = (a) => `<div class="scrim right" style="place-items:stretch start" role="dialog" aria-modal="true" aria-label="Navigation">${FP.sidebar(a.role || 'admin', a.active, true)}</div>`;
})();
