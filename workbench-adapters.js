/* Preserve each effect's DOM contract while changing its design. */
const WorkbenchAdapters = (() => {
  const iconOnly = new Set(['cta-burger','cta-backarrow','cta-dotgrid','cta-loop','cta-rings','cta-dial']);
  const primary = {
    'cta-terminal':'.ghost','cta-passcode':'.labels > span:first-child','cta-submit':'.label',
    'cta-hold':'.lbl > span:first-child','cta-menupill':'.words > span:first-child',
    'cta-ticket':'.main','cta-cut':':scope > span:first-child','cta-live':'.lbl > span:first-child',
    'cta-softtoggle':'.lbl > span:first-child','cta-tag':'.txt > span:first-child',
    'cta-key':':scope > span:last-child','cta-window':'.body > span','cta-flash':':scope > span:first-child',
  };
  function labelFor(b) {
    const t = document.createElement('template'); t.innerHTML = b.html;
    const button = t.content.querySelector('button');
    if (primary[b.cls]) return button.querySelector(primary[b.cls]).textContent.trim();
    if (b.cls === 'cta-magnet') return button.querySelector('textPath').textContent.trim();
    if (button.hasAttribute('aria-label')) return button.getAttribute('aria-label');
    const walker = document.createTreeWalker(button, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) if (walker.currentNode.textContent.trim() && !walker.currentNode.parentElement.closest('svg,[aria-hidden=true]')) return walker.currentNode.textContent.trim();
    return b.name;
  }
  function customize(tpl, b, d, cls) {
    const button = tpl.content.querySelector('button');
    const label = d.label.trim() || labelFor(b);
    const changed = label !== labelFor(b);
    const set = (selector, text = label) => button.querySelectorAll(selector).forEach(el => el.textContent = text);
    if (changed) {
      button.setAttribute('aria-label', label);
      if (b.setup?.name === 'setupToggle') button.dataset.openLabel = `${label} · close`;
      if (b.cls === 'cta-letter-cascade' || b.cls === 'cta-ransom') {
        const word = button.querySelector('.word'), templates = [...word.children].filter(el => !el.classList.contains('gap'));
        word.replaceChildren();
        Array.from(label).forEach((c, i) => {
          const el = templates[i % templates.length].cloneNode(true);
          if (b.cls === 'cta-letter-cascade') { el.querySelectorAll('span').forEach(s => s.textContent = c === ' ' ? '\u00a0' : c); el.style.transitionDelay = `${i * 20}ms`; }
          else { el.textContent = c === ' ' ? '\u00a0' : c; el.style.setProperty('--d', `${i * 25}ms`); }
          word.append(el);
        });
      } else if (b.cls === 'cta-reel') {
        const words = label.split(/\s+/), last = words.pop();
        set(':scope > span:first-child', words.join(' ')); set('.list > span', last);
        button.querySelector('.window').style.width = `${Math.max(6.2,Array.from(last).length * .7)}em`;
      } else if (b.cls === 'cta-orbit' || b.cls === 'cta-magnet') {
        set('textPath', b.cls === 'cta-orbit' ? `${label} • ${label} • ` : label);
      } else if (primary[b.cls]) set(primary[b.cls]);
      else if (!iconOnly.has(b.cls)) {
        // Replace text nodes, not their parents: SVGs, mirrors and animation hooks survive.
        const walker = document.createTreeWalker(tpl.content, NodeFilter.SHOW_TEXT), nodes = [];
        while (walker.nextNode()) {
          const n = walker.currentNode;
          if (n.textContent.trim() && !n.parentElement.closest('svg,.count,.done,.deal,.stub,.mark,.ttl,.bp,.up')) nodes.push(n);
        }
        nodes.forEach(n => { n.textContent = b.cls === 'cta-marquee' ? `${label} •\u00a0` : label; });
      }
      if (b.cls === 'cta-xray') set('.bp > span', `<button>${label}</button>`);
    }
    // Icon controls retain their geometry and toggle behavior; their caption is editable too.
    if (iconOnly.has(b.cls)) {
      const caption = document.createElement('span'); caption.className = 'wb-caption'; caption.textContent = label; caption.setAttribute('aria-hidden','true');
      tpl.content.append(caption);
    }
    if (d.icon !== 'original') {
      const shapes = {'cta-burger':'.bar','cta-backarrow':'.icon','cta-dotgrid':'.grid','cta-menupill':'.lines','cta-magnetic':'.dot','cta-watcher':'.face','cta-live':'.dot','cta-dial':'.knob,.ticks'};
      const originals = [...button.querySelectorAll('svg')].filter(svg => !svg.querySelector('text,textPath'));
      if (shapes[b.cls]) button.querySelectorAll(shapes[b.cls]).forEach(el => el.classList.add('wb-original-icon'));
      const path = d.icon === 'plus' ? 'M12 5v14M5 12h14' : 'M7 17L17 7M7 7h10v10';
      for (const svg of originals) {
        if (d.icon === 'none') { svg.classList.add('wb-original-icon'); continue; }
        [...svg.children].forEach(el => el.classList.add('wb-original-icon'));
        const group = document.createElementNS('http://www.w3.org/2000/svg','g');
        const box = (svg.getAttribute('viewBox') || '0 0 24 24').split(/\s+/).map(Number);
        group.setAttribute('transform', `translate(${box[0]} ${box[1]}) scale(${box[2]/24} ${box[3]/24})`);
        group.setAttribute('class','wb-icon-art');
        const art = document.createElementNS('http://www.w3.org/2000/svg','path'); art.setAttribute('d',path);
        art.setAttribute('style','fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-dasharray:none;stroke-dashoffset:0');
        group.append(art); svg.append(group);
      }
      if (d.icon !== 'none' && !originals.length) {
        const slot = document.createElement('span'); slot.className = 'wb-custom-icon'; slot.setAttribute('aria-hidden','true');
        slot.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="${path}"></path></svg>`;
        const face = button.querySelector('.face');
        (face && face.textContent.trim() ? face : button).append(slot);
      }
      button.dataset.wbIcon = d.icon;
    }
    const loading = document.createElement('span'); loading.className = 'wb-status wb-loading'; loading.innerHTML = '<span class="wb-spinner" aria-hidden="true"></span>Loading…';
    const success = document.createElement('span'); success.className = 'wb-status wb-success'; success.textContent = 'Done';
    // Direct text becomes a span so status overlays can hide it without losing the effect structure.
    [...button.childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).forEach(n => { const span = document.createElement('span'); span.textContent = n.textContent; n.replaceWith(span); });
    button.append(loading, success);
    button.dataset.wbLabel = label;
    let css = `
.${cls}-root { position:relative; text-align:center; }
.${cls} .wb-original-icon { visibility:hidden !important; }
.${cls} .wb-custom-icon { display:inline-flex;position:relative;flex:none;z-index:10;align-items:center;justify-content:center;margin-left:10px;pointer-events:none; }
.${cls} .wb-custom-icon svg { width:18px;height:18px;transform:none; }
.${cls}-root .wb-caption { display:block;margin-top:12px;font:500 13px/1.4 system-ui,sans-serif;color:var(--cta-ink);overflow-wrap:anywhere; }
.${cls} .wb-status { display:none;position:absolute;inset:0;align-items:center;justify-content:center;gap:8px;z-index:50;border-radius:inherit;background:var(--cta-ink);color:var(--cta-paper);font:500 14px/1.4 system-ui,sans-serif; }
.${cls}[data-status] > :not(.wb-status) { visibility:hidden !important; }
.${cls}[data-status]::before,.${cls}[data-status]::after { visibility:hidden !important; }
.${cls}[data-status=loading] .wb-loading,.${cls}[data-status=success] .wb-success { display:flex;visibility:visible; }
.${cls}:disabled { opacity:.45;cursor:not-allowed;pointer-events:none; }
.${cls}[data-status=loading] { opacity:.8;cursor:wait; }
.${cls} .wb-spinner { width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:${cls}-spinner .7s linear infinite; }
@keyframes ${cls}-spinner {to{transform:rotate(360deg)}}
`;
    if (iconOnly.has(b.cls)) css += `.${cls} .wb-custom-icon {position:absolute;inset:0;margin:0;}.${cls} .wb-custom-icon svg{width:28px;height:28px;}`;
    // Scale the complete composition so fixed geometry, SVG paths and pointer coordinates stay aligned.
    const scale = {compact:.8,comfortable:1,large:1.2}[d.size];
    if (scale) css += `.${cls}-root {zoom:${scale};}`;
    const radius = {square:'0px',soft:'12px',pill:'999px'}[d.radius];
    if (radius) {
      css += `.${cls}.${cls},.${cls}::before,.${cls}::after {border-radius:${radius} !important;}`;
      const surfaces = {'cta-layer-fan':'.face','cta-gshadow':'.face','cta-halo':'.face,.ring','cta-stretch':'.skin','cta-tag':'.face','cta-pulltab':'.top,.base','cta-rings':'.pr,.core','cta-dial':'.knob','cta-well':'.ring,.core','cta-magnet':'.disc'};
      if (surfaces[b.cls]) css += surfaces[b.cls].split(',').map(s => `.${cls} ${s}`).join(',') + `{border-radius:${radius} !important;}`;
      if (b.cls === 'cta-tag') css += `.${cls}.${cls},.${cls} .face{clip-path:none;}`;
    }
    return css;
  }
  function setupFor(b, d, cls, spring) {
    if (!b.setup) return '';
    let source = b.setup.toString().replaceAll(b.cls, cls);
    if (b.cls === 'cta-letters') source = source.replace("word.innerHTML = [...text].map((c) => `<span>${c === ' ' ? '&nbsp;' : c}</span>`).join('');", "word.replaceChildren(...Array.from(text, c => { const span = document.createElement('span'); span.textContent = c === ' ' ? '\\u00a0' : c; return span; }));");
    if (b.cls === 'cta-cart') source = source.replace('`Add to cart, ${n} in cart`', '`' + '${el.dataset.wbLabel}, ${n} in cart`');
    if (b.cls === 'cta-dial') source = source.replace('`Volume ${level}', '`' + '${el.dataset.wbLabel} ${level}');
    if (b.cls === 'cta-nag') source = source.replace("['Do not press',", '[el.dataset.wbLabel,');
    if (d.motion === 'none') source = source.replaceAll("matchMedia('(prefers-reduced-motion: reduce)').matches", 'true');
    const rate = d.motion === 'relaxed' ? 1.8 : 1;
    // Local clocks slow JS and CSS together, without changing globals or the library.
    const clocks = `const rate = ${rate};
  const origin = window.performance.now();
  const performance = {now: () => origin + (window.performance.now() - origin) / rate};
  const requestAnimationFrame = fn => window.requestAnimationFrame(t => fn(origin + (t - origin) / rate));
  const setTimeout = (fn, ms, ...args) => window.setTimeout(fn, ms * rate, ...args);
  const setInterval = (fn, ms, ...args) => window.setInterval(fn, ms * rate, ...args);`;
    source = source.replace(/duration: (reduced \? 0 : \d+)/g, 'duration: ($1) * rate');
    return `function setupWorkbench(el) {\n${clocks}\n${source.includes('makeSpring') ? spring.toString() : ''}\n${source}\nreturn ${b.setup.name}(el);\n}`;
  }
  return {labelFor,customize,setupFor};
})();
