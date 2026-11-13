/* findsprop · UX addendum behaviours, batch 4. Load AFTER ../../final-ux/assets/fp.js (and addendum.js).
   It adds one shared tag so the phone bottom bar for the AI chat cannot drift between screens:
     <fp-chatbar active="ai"></fp-chatbar>            Home · Search · AI (centre) · Post · Me
     <fp-chatbar active="home" ai="off"></fp-chatbar>  chat off: the approved bar, unchanged (Home · Search · Post raised · Saved · Me)
   The approved <fp-bottombar> in final-ux is not changed. Approved by the owner with the screens (gate G-F, 13 Nov 2026). */
(function () {
  const FP = window.FP;
  if (!FP || !FP.tags || !FP.icon) return;
  FP.tags.chatbar = (a) => {
    const on = a.active || '';
    if (a.ai === 'off') return FP.bottombar(a); // chat off: the old design only
    const item = (key, icon, label, href, extra) => {
      const cls = [extra, on === key ? 'on' : ''].filter(Boolean).join(' ');
      const aria = on === key ? ' aria-current="page"' : '';
      const name = key === 'ai' ? ' aria-label="AI Search"' : '';
      return `<a href="${href}"${cls ? ` class="${cls}"` : ''}${aria}${name}>${FP.icon(icon)}${label}</a>`;
    };
    const items = [item('home', 'home', 'Home', 'home-a.html'), item('search', 'search', 'Search', 'search.html'), item('ai', 'sparkle', 'AI', 'ai-chat.html', 'ai'), item('post', 'plus', 'Post', 'post-property.html'), item('me', 'user', 'Me', 'dashboard.html#listings')];
    return `<nav class="bottombar" aria-label="Primary">${items.join('')}</nav>`;
  };
})();
