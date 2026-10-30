/* Find Prop — page-level components reused by more than one screen (filters, enquiry card, form pieces, portal shell, charts).
   Loaded after fp-ui.js. */
window.FP = window.FP || {};
(function () {
  const icon = FP.icon;
  const D = FP.data;
  const T = FP.tags;
  const asBool = (v) => v === '' || v === true || v === 'true';
  const opts = (arr, sel) => arr.map((o) => `<option${o === sel ? ' selected' : ''}>${o}</option>`).join('');

  /* Search filters: the same fields as the homepage search card, plus sort and label, as a rail (desktop) or sheet (mobile) */
  FP.filters = function (o = {}) {
    const rent = o.intent === 'rent';
    const P = o.sheet ? 'fs' : 'f';
    const chips = ['Any', '1', '2', '3', '4'].map((b) => `<button type="button" class="chip${b === (o.bhk || 'Any') ? ' on' : ''}" aria-pressed="${b === (o.bhk || 'Any')}">${b}</button>`).join('');
    return `<div class="filter-panel">
      <div class="row between"><h2 class="title">Filters</h2><a class="link small" href="#">Clear all</a></div>
      <div class="field"><span class="label">Looking to</span><div class="seg seg--block" role="tablist"><button type="button" role="tab" class="${!o.intent ? 'on' : ''}">All</button><button type="button" role="tab" class="${o.intent === 'buy' ? 'on' : ''}">Buy</button><button type="button" role="tab" class="${rent ? 'on' : ''}">Rent</button></div></div>
      <div class="field"><label class="label" for="${P}-loc">Locality</label><select id="${P}-loc" class="select">${opts(['All of Chennai'].concat(D.localities), o.loc || 'All of Chennai')}</select></div>
      <div class="field"><label class="label" for="${P}-type">Property type</label><select id="${P}-type" class="select">${opts(['Any type'].concat(D.types), o.type || 'Any type')}</select></div>
      <div class="field"><span class="label">Bedrooms (BHK)</span><div class="chip-row single grid5">${chips}</div></div>
      <div class="field"><label class="label" for="${P}-bud">Max budget</label><select id="${P}-bud" class="select">${opts(rent ? D.budgetRent : D.budgetSale, o.budget || (rent ? D.budgetRent[0] : D.budgetSale[0]))}</select></div>
      ${o.sheet ? `<div class="field"><label class="label" for="${P}-sort">Sort by</label><select id="${P}-sort" class="select">${opts(['Newest', 'Price: low to high', 'Price: high to low', 'Largest first'])}</select></div>` : ''}
    </div>`;
  };
  T.filters = (a) => FP.filters({ intent: a.intent, loc: a.loc, type: a.type, bhk: a.bhk, budget: a.budget, sheet: asBool(a.sheet) });

  /* Pager / pagination note */
  FP.loadmore = (shown, total) => `<div class="loadmore"><span>Showing ${shown} of ${total} homes</span><div class="bar"><i style="width:${Math.round((shown / total) * 100)}%"></i></div><button class="btn btn--secondary" type="button">Show more homes</button></div>`;
  T.loadmore = (a) => FP.loadmore(a.shown, a.total);
})();
