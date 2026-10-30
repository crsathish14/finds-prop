/* Find Prop — original illustrated placeholders standing in for property photography (no photo rights or budget decided yet).
   FP.art(kind, variant, alt) → inline SVG, 4:3 artwork that crops with object-fit: cover. */
window.FP = window.FP || {};
(function () {
  const PAL = [
    { s1: '#F4E3CC', s2: '#FBF3E4', m: '#1F4A38', m2: '#6E9A82', w: '#F6E7C8', g: '#CBBFA6', g2: '#A99D80', sun: '#F2C57A', tree: '#2D6B52', wall: '#F3EAD8', ink: '#1C2A23' }, // 0 dawn
    { s1: '#CFE4D8', s2: '#F1F6EF', m: '#2D6B52', m2: '#9CC2AE', w: '#E8F2EA', g: '#BFD5C8', g2: '#8FB09F', sun: '#FFF1CF', tree: '#1F4A38', wall: '#EAF2EC', ink: '#1C2A23' }, // 1 mint
    { s1: '#F2D3BC', s2: '#FBEBDD', m: '#B4592A', m2: '#D99A6E', w: '#FBE9D9', g: '#E4C9A8', g2: '#C7A57D', sun: '#FFF1CF', tree: '#5F7B52', wall: '#FAEBDD', ink: '#3A2A1E' }, // 2 terracotta
    { s1: '#33445A', s2: '#E8B98F', m: '#26332D', m2: '#55655C', w: '#F2C57A', g: '#1B2420', g2: '#10160F', sun: '#FCE2AE', tree: '#0F1C16', wall: '#2B3A33', ink: '#FAF6EE' }, // 3 dusk
    { s1: '#EFE6D0', s2: '#FAF6EE', m: '#8E7B55', m2: '#C9BA93', w: '#FAF6EE', g: '#D9CCAB', g2: '#B9AA82', sun: '#F6DDB5', tree: '#6E8A5F', wall: '#F6EFDD', ink: '#3B3220' }, // 4 sand
  ];
  let uid = 0;
  const palm = (x, y, s, c, ink) => `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-3 0C1-50-5-100 3-150" stroke="${ink}" stroke-width="6" fill="none" stroke-linecap="round" opacity=".75"/><g transform="translate(3 -150)" fill="${c}"><path d="M0 0q-30-22-62-8 30-2 62 8zM0 0q-12-38-40-44 24 16 40 44zM0 0q10-38 40-46-22 18-40 46zM0 0q34-18 66-6-30 0-66 6zM0 0q-6 34-38 46 24-14 38-46z"/></g></g>`;
  const S = {
    apartment: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="328" cy="62" r="26" fill="${p.sun}" opacity=".9"/>
      <rect x="26" y="136" width="78" height="130" fill="${p.m2}" opacity=".55"/><rect x="26" y="136" width="78" height="130" fill="url(#wn${n})" opacity=".5"/>
      <rect x="300" y="112" width="80" height="154" fill="${p.m2}" opacity=".6"/><rect x="300" y="112" width="80" height="154" fill="url(#wn${n})" opacity=".5"/>
      <rect x="124" y="34" width="152" height="232" fill="${p.m}"/><rect x="124" y="34" width="152" height="232" fill="url(#wn${n})"/>
      <rect x="118" y="28" width="164" height="9" rx="2" fill="${p.m}"/><rect x="180" y="16" width="40" height="14" fill="${p.m}" opacity=".85"/>
      <path d="M124 102h152M124 170h152M124 238h152" stroke="${p.m2}" stroke-opacity=".5" stroke-width="3"/>
      <rect x="184" y="236" width="32" height="30" rx="2" fill="${p.g2}"/><rect y="262" width="400" height="38" fill="${p.g}"/>
      <circle cx="92" cy="260" r="20" fill="${p.tree}"/><circle cx="312" cy="262" r="24" fill="${p.tree}"/><circle cx="60" cy="266" r="14" fill="${p.tree}" opacity=".85"/>`,
    lowrise: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="76" cy="62" r="24" fill="${p.sun}" opacity=".9"/>
      <rect y="250" width="400" height="50" fill="${p.g}"/><rect x="56" y="112" width="288" height="142" fill="${p.m2}"/><rect x="48" y="104" width="304" height="12" fill="${p.m}"/>
      ${[0, 1, 2, 3, 4].map((i) => [130, 186].map((y) => `<path d="M${80 + i * 52} ${y + 40}V${y + 14}a13 13 0 0 1 26 0V${y + 40}z" fill="${p.w}"/>`).join('')).join('')}
      <path d="M185 254V222a15 15 0 0 1 30 0V254z" fill="${p.m}"/><rect x="316" y="74" width="40" height="180" fill="${p.m}"/><rect x="310" y="68" width="52" height="8" fill="${p.m}"/>
      ${[0, 1, 2, 3].map((i) => `<rect x="328" y="${92 + i * 36}" width="16" height="20" rx="8" fill="${p.w}"/>`).join('')}
      <circle cx="30" cy="248" r="20" fill="${p.tree}"/><circle cx="372" cy="252" r="22" fill="${p.tree}"/>`,
    twin: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="336" cy="58" r="24" fill="${p.sun}" opacity=".9"/>
      <rect x="30" y="156" width="56" height="106" fill="${p.m2}" opacity=".55"/><rect x="316" y="140" width="62" height="122" fill="${p.m2}" opacity=".55"/>
      <rect x="86" y="44" width="92" height="218" fill="${p.m}"/><rect x="86" y="44" width="92" height="218" fill="url(#wn${n})"/><rect x="82" y="38" width="100" height="8" fill="${p.m}"/>
      <rect x="196" y="92" width="108" height="170" fill="${p.m2}"/><rect x="196" y="92" width="108" height="170" fill="url(#wn${n})" opacity=".8"/><rect x="192" y="86" width="116" height="8" fill="${p.m}"/>
      <path d="M86 90h92M86 136h92M86 182h92M86 228h92M196 134h108M196 176h108M196 218h108" stroke="${p.w}" stroke-opacity=".55" stroke-width="3"/>
      <rect y="262" width="400" height="38" fill="${p.g}"/><circle cx="60" cy="262" r="18" fill="${p.tree}"/><circle cx="188" cy="268" r="12" fill="${p.tree}"/><circle cx="350" cy="264" r="20" fill="${p.tree}"/>`,
    villa: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="64" cy="64" r="24" fill="${p.sun}" opacity=".9"/>
      <rect y="236" width="400" height="64" fill="${p.g}"/><path d="M170 300l20-62h40l20 62z" fill="${p.g2}" opacity=".5"/>
      <rect x="86" y="150" width="228" height="90" fill="${p.m2}"/><path d="M62 152 200 70l138 82z" fill="${p.m}"/><rect x="256" y="82" width="18" height="44" fill="${p.m}"/>
      <rect x="236" y="176" width="64" height="64" fill="${p.g2}" opacity=".6"/><path d="M236 192h64M236 208h64M236 224h64" stroke="${p.g}" stroke-width="2"/>
      <rect x="178" y="182" width="32" height="58" rx="3" fill="${p.m}"/><circle cx="200" cy="124" r="12" fill="${p.w}"/>
      <rect x="102" y="174" width="44" height="34" rx="3" fill="${p.w}"/><path d="M124 174v34M102 191h44" stroke="${p.m}" stroke-width="2.5"/>
      <ellipse cx="70" cy="240" rx="40" ry="14" fill="${p.tree}"/><ellipse cx="338" cy="242" rx="40" ry="14" fill="${p.tree}"/>
      <rect x="354" y="168" width="6" height="72" fill="${p.ink}" opacity=".55"/><circle cx="357" cy="158" r="30" fill="${p.tree}"/>`,
    house: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="318" cy="70" r="24" fill="${p.sun}" opacity=".9"/>
      <rect y="232" width="400" height="68" fill="${p.g}"/><rect x="80" y="128" width="240" height="108" fill="${p.m2}"/><rect x="72" y="118" width="256" height="14" fill="${p.m}"/>
      <rect x="110" y="158" width="48" height="42" rx="3" fill="${p.w}"/><rect x="242" y="158" width="48" height="42" rx="3" fill="${p.w}"/><path d="M134 158v42M110 179h48M266 158v42M242 179h48" stroke="${p.m}" stroke-width="2.5"/>
      <rect x="180" y="168" width="40" height="68" rx="3" fill="${p.m}"/>
      <rect x="24" y="204" width="352" height="32" fill="${p.g2}" opacity=".85"/><rect x="168" y="204" width="64" height="32" fill="${p.m}"/><rect x="156" y="196" width="12" height="40" fill="${p.g2}"/><rect x="232" y="196" width="12" height="40" fill="${p.g2}"/>
      <rect x="334" y="150" width="6" height="86" fill="${p.ink}" opacity=".55"/><circle cx="337" cy="140" r="32" fill="${p.tree}"/>`,
    plot: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="318" cy="56" r="24" fill="${p.sun}"/>
      <path d="M0 150C100 126 300 136 400 116V300H0z" fill="${p.m2}" opacity=".55"/><path d="M0 178 400 156V300H0z" fill="${p.g}"/>
      <g stroke="${p.w}" stroke-width="3" fill="none" opacity=".95"><path d="M0 218 400 194"/><path d="M0 262 400 246"/><path d="M70 180-10 300"/><path d="M170 172 140 300"/><path d="M270 166v134"/><path d="M360 162l60 138"/></g>
      <rect x="112" y="150" width="4" height="46" fill="${p.ink}" opacity=".8"/><rect x="176" y="150" width="4" height="46" fill="${p.ink}" opacity=".8"/>
      <rect x="102" y="110" width="88" height="46" rx="4" fill="${p.m}"/><rect x="112" y="122" width="68" height="5" rx="2.5" fill="${p.w}"/><rect x="112" y="134" width="46" height="5" rx="2.5" fill="${p.w}" opacity=".7"/>
      ${palm(334, 222, 0.62, p.tree, p.ink)}`,
    commercial: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="70" cy="60" r="22" fill="${p.sun}" opacity=".8"/>
      <rect x="34" y="132" width="74" height="138" fill="${p.m2}" opacity=".5"/><rect x="302" y="102" width="66" height="168" fill="${p.m2}" opacity=".5"/>
      <rect x="112" y="24" width="176" height="246" fill="${p.m}"/>
      <g stroke="${p.w}" stroke-opacity=".55" stroke-width="2"><path d="M112 66h176M112 108h176M112 150h176M112 192h176M112 234h176"/><path d="M156 24v246M200 24v246M244 24v246"/></g>
      <path d="M112 24h64l-64 120z" fill="${p.w}" opacity=".18"/><path d="M200 24h50L170 150H120z" fill="${p.w}" opacity=".1"/>
      <rect x="160" y="236" width="80" height="8" fill="${p.m2}"/><rect x="172" y="244" width="56" height="26" fill="${p.w}" opacity=".75"/>
      <rect y="268" width="400" height="32" fill="${p.g}"/><circle cx="70" cy="270" r="14" fill="${p.tree}"/><circle cx="338" cy="272" r="16" fill="${p.tree}"/>`,
    living: (p, n) => `<rect width="400" height="300" fill="${p.wall}"/><rect y="226" width="400" height="74" fill="${p.g}"/><rect y="222" width="400" height="6" fill="${p.g2}" opacity=".7"/>
      <rect x="252" y="34" width="124" height="150" rx="6" fill="url(#sk${n})" stroke="${p.m}" stroke-width="6"/><path d="M314 34v150M252 109h124" stroke="${p.m}" stroke-width="4"/>
      <path d="M252 228h124l34 72H218z" fill="#fff" opacity=".22"/>
      <rect x="64" y="52" width="92" height="62" rx="4" fill="${p.m2}" opacity=".6" stroke="${p.m}" stroke-width="4"/><circle cx="110" cy="84" r="14" fill="${p.sun}"/>
      <rect x="40" y="168" width="188" height="64" rx="16" fill="${p.m}"/><rect x="52" y="138" width="164" height="50" rx="14" fill="${p.m}"/>
      <rect x="60" y="152" width="44" height="36" rx="10" fill="${p.m2}"/><rect x="164" y="152" width="44" height="36" rx="10" fill="${p.sun}" opacity=".9"/>
      <rect x="54" y="230" width="8" height="12" fill="${p.ink}" opacity=".6"/><rect x="206" y="230" width="8" height="12" fill="${p.ink}" opacity=".6"/>
      <ellipse cx="170" cy="268" rx="132" ry="20" fill="${p.m2}" opacity=".5"/><rect x="118" y="248" width="94" height="14" rx="5" fill="${p.g2}"/>
      <path d="M330 234h30l-4 34h-22z" fill="${p.m2}"/><path d="M345 234c-30-20-26-52-6-66 4 28 6 44 6 66zM345 234c26-14 38-44 24-66-14 22-22 40-24 66z" fill="${p.tree}"/>
      <path d="M20 232V122" stroke="${p.m}" stroke-width="4"/><path d="M4 122l16-36 16 36z" fill="${p.sun}"/>`,
    bedroom: (p, n) => `<rect width="400" height="300" fill="${p.wall}"/><rect y="236" width="400" height="64" fill="${p.g}"/>
      <rect x="40" y="46" width="96" height="120" rx="5" fill="url(#sk${n})" stroke="${p.m}" stroke-width="5"/><path d="M88 46v120" stroke="${p.m}" stroke-width="3"/>
      <rect x="28" y="40" width="26" height="140" rx="6" fill="${p.m2}"/><rect x="124" y="40" width="26" height="140" rx="6" fill="${p.m2}"/>
      <rect x="168" y="88" width="212" height="100" rx="14" fill="${p.m}"/><rect x="158" y="172" width="232" height="66" rx="12" fill="#fff" opacity=".93"/>
      <rect x="158" y="198" width="232" height="42" rx="10" fill="${p.m2}"/><rect x="180" y="150" width="76" height="32" rx="12" fill="#fff"/><rect x="290" y="150" width="76" height="32" rx="12" fill="#fff"/>
      <rect x="130" y="194" width="26" height="44" rx="3" fill="${p.g2}"/><rect x="136" y="166" width="14" height="28" rx="3" fill="${p.sun}"/>
      <rect x="64" y="246" width="260" height="12" rx="6" fill="${p.g2}" opacity=".45"/>`,
    kitchen: (p, n) => `<rect width="400" height="300" fill="${p.wall}"/>
      <g stroke="${p.g}" stroke-width="1.5" opacity=".6"><path d="M0 110h400M0 142h400M0 174h400"/><path d="M40 98v76M100 98v76M160 98v76M220 98v76M280 98v76M340 98v76"/></g>
      <rect x="18" y="22" width="364" height="74" rx="8" fill="${p.m}"/><path d="M110 22v74M200 22v74M290 22v74" stroke="${p.w}" stroke-opacity=".3" stroke-width="2"/>
      <g fill="${p.w}" opacity=".7"><rect x="96" y="70" width="4" height="16" rx="2"/><rect x="120" y="70" width="4" height="16" rx="2"/><rect x="186" y="70" width="4" height="16" rx="2"/><rect x="210" y="70" width="4" height="16" rx="2"/><rect x="276" y="70" width="4" height="16" rx="2"/><rect x="300" y="70" width="4" height="16" rx="2"/></g>
      <rect y="176" width="400" height="14" fill="${p.g2}"/><rect y="190" width="400" height="110" fill="${p.m2}"/><path d="M100 190v110M200 190v110M300 190v110" stroke="${p.m}" stroke-opacity=".3" stroke-width="2"/>
      <rect x="268" y="148" width="34" height="28" rx="6" fill="${p.sun}"/><rect x="318" y="140" width="22" height="36" rx="4" fill="${p.ink}" opacity=".6"/>
      <rect x="130" y="132" width="76" height="44" rx="6" fill="${p.g}"/><rect x="142" y="120" width="52" height="14" rx="7" fill="${p.g2}"/>`,
    balcony: (p, n) => `<rect width="400" height="300" fill="url(#sk${n})"/><circle cx="300" cy="82" r="30" fill="${p.sun}" opacity=".95"/>
      <g fill="${p.m2}" opacity=".7"><rect x="20" y="120" width="40" height="100"/><rect x="66" y="90" width="50" height="130"/><rect x="124" y="140" width="38" height="80"/><rect x="214" y="110" width="44" height="110"/><rect x="266" y="150" width="40" height="70"/><rect x="316" y="100" width="56" height="120"/></g>
      <g fill="url(#wn${n})" opacity=".5"><rect x="66" y="90" width="50" height="130"/><rect x="214" y="110" width="44" height="110"/><rect x="316" y="100" width="56" height="120"/></g>
      <rect x="150" y="70" width="54" height="150" fill="${p.m}" opacity=".85"/><rect x="150" y="70" width="54" height="150" fill="url(#wn${n})" opacity=".7"/>
      <ellipse cx="60" cy="222" rx="50" ry="16" fill="${p.tree}" opacity=".8"/><ellipse cx="360" cy="224" rx="50" ry="16" fill="${p.tree}" opacity=".8"/>
      <rect y="236" width="400" height="64" fill="${p.g2}"/><rect y="204" width="400" height="9" fill="${p.m}"/>
      <path d="${Array.from({ length: 21 }, (_, i) => `M${i * 20 + 6} 213v26`).join('')}" stroke="${p.m}" stroke-width="3"/>
      <path d="M318 300l8-42h40l8 42z" fill="${p.m2}"/><path d="M346 258c-26-18-22-46-4-58 4 24 4 40 4 58zM346 258c22-12 32-38 20-58-12 20-18 36-20 58z" fill="${p.tree}"/>`,
    floorplan: (p, n) => `<rect width="400" height="300" fill="#FFFDF8"/>
      <rect x="50" y="40" width="300" height="212" fill="none" stroke="${p.m}" stroke-width="7" stroke-linejoin="round"/>
      <path d="M50 146h150M200 40v70M200 178v74M270 146h80M270 146v106" stroke="${p.m}" stroke-width="5" fill="none"/>
      <g fill="none" stroke="${p.m2}" stroke-width="2.5"><path d="M200 110a34 34 0 0 1 34 36"/><path d="M200 178a30 30 0 0 0 30-32"/><path d="M270 214a28 28 0 0 1 28 28"/></g>
      <rect x="66" y="58" width="92" height="70" rx="6" fill="${p.m2}" opacity=".35"/><rect x="218" y="60" width="116" height="62" rx="6" fill="${p.m2}" opacity=".25"/>
      <rect x="66" y="170" width="110" height="56" rx="8" fill="${p.sun}" opacity=".35"/><path d="M286 160h50v70" fill="none" stroke="${p.m}" stroke-width="10" opacity=".5"/>
      <path d="M50 276h300M50 268v16M350 268v16" stroke="#9AA39D" stroke-width="2"/><circle cx="372" cy="62" r="12" fill="none" stroke="${p.m}" stroke-width="2"/><path d="M372 70V54l-4 6m4-6 4 6" stroke="${p.m}" stroke-width="2" fill="none"/>`,
  };
  FP.ART_KINDS = Object.keys(S);
  FP.art = function (kind = 'apartment', v = 0, alt = '') {
    const p = PAL[((v % PAL.length) + PAL.length) % PAL.length];
    const n = ++uid;
    const label = alt || `Illustrated placeholder, ${kind}`;
    return `<svg class="art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}"><defs><linearGradient id="sk${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.s1}"/><stop offset="1" stop-color="${p.s2}"/></linearGradient><pattern id="wn${n}" width="16" height="20" patternUnits="userSpaceOnUse"><rect x="3.5" y="4" width="9" height="11" rx="1.6" fill="${p.w}"/></pattern></defs>${(S[kind] || S.apartment)(p, n)}</svg>`;
  };
  /* Brand decoration: concentric arches from Concept 1, drawn at 8 % forest */
  FP.arches = function (pos = 'both') {
    const set = (cx, cy) => [250, 190, 130].map((r) => `<path d="M${cx - r} ${cy}a${r} ${r} 0 0 1 ${r * 2} 0"/>`).join('');
    return `<div class="arches" aria-hidden="true"><svg viewBox="0 0 1440 520" preserveAspectRatio="xMidYMid slice" style="width:100%;height:100%;position:absolute;inset:0;stroke:var(--c-primary);stroke-opacity:.08;stroke-width:2;fill:none">${pos !== 'right' ? set(80, 470) : ''}${pos !== 'left' ? set(1360, 430) : ''}</svg></div>`;
  };
  /* Door/arch motif for empty states */
  FP.archArt = (c = 'var(--c-primary)') => `<svg class="art" viewBox="0 0 72 88" aria-hidden="true"><path d="M10 84V34a26 26 0 0 1 52 0v50" fill="none" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M22 84V38a14 14 0 0 1 28 0v46" fill="${'var(--c-primary-tint)'}" stroke="none"/><circle cx="43" cy="60" r="3.2" fill="${c}"/></svg>`;
})();
