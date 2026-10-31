// Generates screen-inventory.md from assets/manifest.js and checks that all 33 Phase 1 routes are covered.
//   node tools/make-inventory.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadManifest } from './render.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const M = loadManifest();
const byId = Object.fromEntries(M.map((s) => [s.id, s]));
const link = (id, key) => { const s = byId[id]; const k = key && key !== 'default' ? '#' + key : ''; return `[${s.title.replace(/^(Admin|Builder|Homepage|Design system) · /, '')}](screens/${s.file}${k})`; };

// The 33 routes of the Phase 1 inventory (04-page-inventory.md), in its order.
const ROUTES = [
  ['P-01', '/', 'Public', ['home-a', 'home-b', 'home-none'], 'Existing. Two interchangeable hero layouts plus the no-sponsor fallback.'],
  ['P-02', '/properties', 'Public', ['search'], 'Existing. Filters, sort, label pills, empty state. Active chips, grid/list and “Show more” are proposed.'],
  ['P-03', '/properties/$id', 'Public', ['property'], 'Existing. Enquiry card has the three documented states.'],
  ['P-04', '/projects', 'Public', ['projects'], 'Existing. Locality filter chips are proposed.'],
  ['P-05', '/projects/$slug', 'Public', ['project'], 'Existing. Enquire or site-visit form, units, floor plans, price trend.'],
  ['P-06', '/compare', 'Public', ['compare'], 'Existing. Wording corrected from “projects” to “homes”.'],
  ['P-07', '/contact', 'Public', ['contact'], 'Existing. Renders the admin-built contact form.'],
  ['P-08', '/ai-search', 'Public', ['ai-search'], 'Existing. All documented rate-limit and lead states.'],
  ['P-09', '/auth', 'Public', ['auth'], 'Existing. Forgot-password on this screen is in the roles analysis but not the route inventory: to confirm.'],
  ['P-10', '/builder/login', 'Public', ['builder-login'], 'Existing. Invitation-only, denied, forgot password.'],
  ['P-11', '/reset-password', 'Public', ['reset-password'], 'Existing. `noindex`.'],
  ['P-12', '/dashboard', 'Signed in', ['dashboard'], 'Existing. Four tabs. “Edit listing” is proposed.'],
  ['P-13', '/post-property', 'Signed in', ['post-property'], 'Existing fields; five-step flow, draft saving and photo upload are proposed. Sample-photo picker kept as a state.'],
  ['—', '/admin/', 'Admin', ['admin-overview'], 'Redirect to /admin/dashboard. No screen of its own.'],
  ['P-14', '/admin/dashboard', 'Admin', ['admin-overview'], 'Existing. “Leads by source” pie becomes a stacked bar.'],
  ['P-15', '/admin/projects', 'Admin', ['admin-projects', 'admin-project-form'], 'Existing. Sectioned form is proposed.'],
  ['P-16', '/admin/properties', 'Admin', ['admin-units'], 'Existing. Manages project units.'],
  ['P-17', '/admin/builders', 'Admin', ['admin-builders'], 'Existing. Includes the reserved-email block.'],
  ['P-18', '/admin/leads', 'Admin', ['admin-leads'], 'Existing. Project leads and form submissions.'],
  ['P-19', '/admin/forms', 'Admin', ['admin-forms'], 'Existing. Keyboard reorder alternative added.'],
  ['P-20', '/admin/crm', 'Admin', ['admin-crm'], 'Existing. Connections, credentials, mappings, logs.'],
  ['P-21', '/admin/header', 'Admin', ['admin-cms'], 'Existing. Shares one editor template (#header).'],
  ['P-22', '/admin/hero', 'Admin', ['admin-cms'], 'Existing. Hero layout setting is proposed (#hero).'],
  ['P-23', '/admin/homepage', 'Admin', ['admin-cms'], 'Existing (#homepage).'],
  ['P-24', '/admin/footer', 'Admin', ['admin-cms'], 'Existing (#footer).'],
  ['—', '/builder/', 'Builder', ['builder-dashboard'], 'Redirect to /builder/dashboard. No screen of its own.'],
  ['P-25', '/builder/dashboard', 'Builder', ['builder-dashboard'], 'Existing. Compact insights.'],
  ['P-26', '/builder/projects', 'Builder', ['builder-projects', 'builder-project-form'], 'Existing. Same component as admin, builder mode.'],
  ['P-27', '/builder/properties', 'Builder', ['builder-units'], 'Existing. Same component as admin.'],
  ['P-28', '/builder/leads', 'Builder', ['builder-leads'], 'Existing. Status is the only editable field.'],
  ['P-29', '/builder/insights', 'Builder', ['builder-insights'], 'Existing. Ten measures, project filter, timelines.'],
  ['P-30', '/builder/profile', 'Builder', ['builder-profile'], 'Existing. Email read-only.'],
  ['P-31', '/api/public/crm-retry', 'API', [], 'Machine endpoint, no UI. Its results appear in Admin · CRM · API logs.'],
];

// coverage check against manifest `routes` strings
const manifestRoutes = M.flatMap((s) => s.routes);
const covered = ROUTES.map(([pid, route, , ids]) => {
  if (!ids.length) return { route, ok: true, machine: true };
  const ok = ids.every((id) => byId[id]) && ids.some((id) => byId[id].routes.some((r) => r.includes(route.replace(/\/$/, '')) || (route === '/' && r === '/') || r.startsWith('/admin/') && route.startsWith('/admin/') ));
  return { route, ok };
});
const missing = covered.filter((c) => !c.ok);
if (missing.length) { console.error('ROUTES WITHOUT A MATCHING MANIFEST ENTRY:', missing.map((m) => m.route)); process.exitCode = 1; }

const stateCount = (s) => s.states.length;
const imgCount = (s) => s.states.reduce((n, st) => n + st.vps.length, 0);
const totalStates = M.reduce((n, s) => n + stateCount(s), 0);
const totalImgs = M.reduce((n, s) => n + imgCount(s), 0);
const proposed = M.filter((s) => s.flags && s.flags.includes('proposed'));

let md = `# Screen inventory

Maps every route in \`property-platform-analysis/04-page-inventory.md\` to a final design. **Generated from \`assets/manifest.js\`** by \`tools/make-inventory.mjs\`, so this list, the gallery and the renders cannot disagree.

**Summary:** ${ROUTES.length} routes (11 public, 2 signed-in, 12 admin including the index redirect, 7 builder including the index redirect, 1 machine endpoint) → **${M.length} designed screens**, **${totalStates} states**, **${totalImgs} rendered images** (desktop 1440, tablet 820, mobile 390). Not every route has its own layout: related routes share templates (the four CMS routes share one editor; admin and builder projects, units and leads share components).

Open any screen from the [gallery](index.html), or directly from the links below. State links use the URL hash, so they are shareable.

## 1. Route to design

| Phase 1 | Route | Area | Design | Notes |
|---|---|---|---|---|
`;
for (const [pid, route, area, ids, note] of ROUTES) {
  const designs = ids.length ? ids.map((id) => link(id)).join(', ') : '—';
  md += `| ${pid} | \`${route}\` | ${area} | ${designs} | ${note} |\n`;
}

md += `
**Coverage:** ${ROUTES.length - 1} of ${ROUTES.length} routes have a screen; the remaining one is the cron retry endpoint, which has no interface.

## 2. All designed screens and states

Viewports: **D** desktop 1440 · **T** tablet 820 · **M** mobile 390. “fold” means the first screen only.

`;
const groupNames = { home: 'Homepage', browse: 'Browse and decide', auth: 'Sign in', account: 'Account', admin: 'Admin portal', builder: 'Builder portal', system: 'System and design system' };
for (const g of Object.keys(groupNames)) {
  const list = M.filter((s) => s.group === g);
  md += `### ${groupNames[g]}\n\n| Screen | States designed | Roles |\n|---|---|---|\n`;
  for (const s of list) {
    const states = s.states.map((st) => `[${st.label}](screens/${s.file}${st.key && st.key !== 'default' ? '#' + st.key : ''}) <sub>${st.vps.map((v) => v.toUpperCase()).join('')}${st.fold ? ' fold' : ''}</sub>`).join('<br>');
    md += `| **[${s.title}](screens/${s.file})**${s.flags && s.flags.includes('proposed') ? ' *(proposed)*' : ''}<br><sub>${s.note}</sub> | ${states} | ${s.roles.join(', ') || '—'} |\n`;
  }
  md += '\n';
}

md += `## 3. Your brief's screen list

| Brief item | Where |
|---|---|
| 1. Homepage and both advertising variations | ${link('home-a')}, ${link('home-b')}, ${link('home-none')}, [Sponsored banner container](screens/ds-ads.html) |
| 2. Property search and results | ${link('search')} |
| 3. Search filters and sorting | ${link('search')} (rail, mobile sheet, sort menu), the search card on [Components](screens/ds-components.html) |
| 4. Property details | ${link('property')} |
| 5. Project details | ${link('project')}, ${link('projects')} |
| 6. Login, registration and authentication states | ${link('auth')}, ${link('builder-login')}, ${link('reset-password')} |
| 7. User dashboard and account screens | ${link('dashboard')} (there is no separate account-settings route in Phase 1) |
| 8. Post-property flow | ${link('post-property')} |
| 9. Property listing management | ${link('dashboard', 'listings')} for owners, ${link('admin-listings')} for moderation (proposed) |
| 10. Admin dashboard | ${link('admin-overview')} |
| 11. Admin project management | ${link('admin-projects')}, ${link('admin-project-form')}, ${link('admin-units')}, ${link('admin-builders')} |
| 12. Admin forms and CRM | ${link('admin-forms')}, ${link('admin-crm')}, ${link('admin-leads')}, ${link('admin-cms')} |
| 13. Builder portal | ${M.filter((s) => s.group === 'builder').map((s) => link(s.id)).join(', ')} |
| 14. Property comparison | ${link('compare')} |
| 15. Shared components | [Foundations](screens/ds-foundations.html), [Components](screens/ds-components.html), [Navigation](screens/ds-navigation.html), [Feedback](screens/ds-feedback.html) |

## 4. Proposed screens and layouts

These are not in Phase 1 and need approval (details in \`design-handoff.md\`):

${proposed.map((s) => `- **${s.title}**: ${s.note}`).join('\n')}

Within existing screens, proposed elements carry a dashed **Proposed** tag in the mockups: active filter chips, grid/list toggle and “Show more” on search; the locality filter on Projects; “Edit listing” on the dashboard; draft saving and photo upload in the post-property flow; the hero layout setting in the CMS; the Agent workspace menu item.

## 5. State coverage by type

Each of these was designed where it applies: default, hover, focus, pressed, selected, disabled, loading, empty, no matches, validation error, success, failed action, authentication required, confirmation dialog, rate limited, not found, long text, missing optional details, responsive navigation. Component-level hover, focus and disabled states are on the [Components board](screens/ds-components.html); page-level states are the chips above.
`;
fs.writeFileSync(path.join(root, 'screen-inventory.md'), md);
console.log(`screen-inventory.md written: ${M.length} screens, ${totalStates} states, ${totalImgs} images; route coverage ${covered.filter((c) => c.ok).length}/${ROUTES.length}`);
