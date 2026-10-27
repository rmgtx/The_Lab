/* Registry-backed workbench with a five-button comparison tray. No build step and no external dependencies. */
(() => {
  'use strict';
  const host = document.getElementById('workbench');
  const specimens = BUTTONS;
  document.getElementById('lab-library-count').textContent = specimens.length;
  const simpleSpecimens = new Set(['cta-classic', 'cta-hard-press', 'cta-shine-sweep', 'cta-corner-trace', 'cta-deck']);
  let tray = [...simpleSpecimens], pendingAdd = null;
  const defaults = specimens.map(WorkbenchAdapters.labelFor);
  const STORAGE_KEY = 'button-lab-workbench-v1';
  const FAVORITE_LIMIT = 24;
  const drafts = new Map();
  let selected = specimens[0], state = 'idle', context = 'canvas', format = 'html';
  let favorites = [], removedFavorite = null, ready = false;
  let storageMessage = 'Edits and favorites save automatically in this browser, at this address.';
  let storageUnavailable = false;
  let currentCSS = '', currentHTML = '', currentSetup = '', currentClass = '';
  const comparisonKeys = new Map();
  const initial = b => ({label:defaults[specimens.indexOf(b)],size:'original',radius:'original',icon:'original',motion:'original',colors:{...palette}});
  const cloneDraft = d => ({...d, colors:{...d.colors}});
  const findSpecimen = cls => specimens.find(b => b.cls === cls);
  const choices = {size:['original','compact','comfortable','large'],radius:['original','square','soft','pill'],icon:['original','arrow','plus','none'],motion:['original','relaxed','none']};
  function cleanDraft(value, b) {
    const clean = initial(b);
    if (!value || typeof value !== 'object') return clean;
    if (typeof value.label === 'string') clean.label = value.label.slice(0,64);
    for (const [key, allowed] of Object.entries(choices)) if (allowed.includes(value[key])) clean[key] = value[key];
    for (const key of Object.keys(clean.colors)) if (/^#[0-9a-f]{6}$/i.test(value.colors?.[key] || '')) clean.colors[key] = value.colors[key];
    return clean;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      if (!saved || saved.version !== 1) throw new Error('Unsupported saved data');
      for (const b of specimens) if (saved.drafts?.[b.cls]) drafts.set(b.cls, cleanDraft(saved.drafts[b.cls], b));
      if (Array.isArray(saved.tray)) tray = [...new Set(saved.tray.filter(cls => findSpecimen(cls)))].slice(0,5);
      selected = findSpecimen(tray.includes(saved.selected) ? saved.selected : tray[0]) || selected;
      if (['canvas','card'].includes(saved.context)) context = saved.context;
      if (['html','react'].includes(saved.format)) format = saved.format;
      if (['idle','hover','pressed','focus','disabled','loading','success'].includes(saved.state)) state = saved.state;
      const ids = new Set();
      for (const f of Array.isArray(saved.favorites) ? saved.favorites : []) {
        const b = findSpecimen(f?.specimen);
        if (!b || typeof f.id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(f.id) || ids.has(f.id) || typeof f.name !== 'string' || !f.name.trim()) continue;
        ids.add(f.id);
        favorites.push({id:f.id,name:f.name.trim().slice(0,50),specimen:b.cls,draft:cleanDraft(f.draft,b),context:f.context === 'card' ? 'card' : 'canvas'});
        if (favorites.length === FAVORITE_LIMIT) break;
      }
    }
  } catch (error) {
    storageUnavailable = error.name === 'SecurityError';
    storageMessage = storageUnavailable ? 'Browser storage is unavailable. Changes will last only until this page closes.' : 'Saved workbench data could not be read. Your next edit starts a fresh save.';
  }
  const draft = () => {
    if (!drafts.has(selected.cls)) drafts.set(selected.cls, initial(selected));
    return drafts.get(selected.cls);
  };
  const field = (label, id, options) => `<div class="wb-field"><label for="wb-${id}">${label}</label><select id="wb-${id}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></div>`;
  host.innerHTML = `
    <div class="wb-heading"><div><p class="wb-eyebrow">Workbench · <span id="wb-tray-count">5 / 5</span> in comparison</p><h2 id="wb-title" tabindex="-1">Make it yours.</h2><p>Shape a button, try its states, take the code.</p></div><nav class="wb-head-links" aria-label="Workbench shortcuts"><a href="#wb-favorites-title">Favorites ↓</a><a href="#groups">Browse the library ↗</a></nav></div>
    <div class="wb-picks wb-comparison" role="group" aria-label="Workbench comparison"></div>
    <p class="wb-entry-hint">Select <strong>Add to workbench</strong> on any library card. Compare up to five buttons here; select a name to edit it.</p>
    <div id="wb-replace" class="wb-replace" hidden><p id="wb-replace-message" role="status"></p><label class="wb-field" for="wb-replace-choice">Replace a button<select id="wb-replace-choice"></select></label><button type="button" class="act primary" id="wb-confirm-replace">Replace and add</button><button type="button" class="act" id="wb-cancel-replace">Cancel</button></div>
    <p id="wb-empty" class="wb-entry-hint" hidden>Your workbench is empty. <a href="#groups">Browse the library and add a button ↗</a></p>
    <div class="wb-body">
      <div class="wb-preview">
        <div class="wb-stage"><div class="wb-stage-label"><span id="wb-specimen-name"></span><span id="wb-state-name">Live preview</span></div><div class="wb-sample" id="wb-sample"></div></div>
        <div class="wb-states" role="group" aria-label="Preview state">${['idle','hover','pressed','focus','disabled','loading','success'].map(s => `<button type="button" class="wb-state" data-state="${s}" aria-pressed="${s === 'idle'}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div>
        <p class="wb-preview-note" id="wb-preview-note">Hover, tab, or press the button to try it.</p>
      </div>
      <div class="wb-controls">
        <p id="wb-capabilities" class="wb-palette-note"></p>
        <label class="wb-field" for="wb-label">Button label<input id="wb-label" type="text" maxlength="64" autocomplete="off"></label>
        <div class="wb-control-row">${field('Size','size',[['original','Original'],['compact','Compact'],['comfortable','Comfortable'],['large','Large']])}${field('Corners','radius',[['original','Original'],['square','Square'],['soft','Soft'],['pill','Pill']])}</div>
        <div class="wb-control-row">${field('Icon','icon',[['original','Original'],['arrow','Arrow ↗'],['plus','Plus +'],['none','None']])}${field('Motion','motion',[['original','Original'],['relaxed','Slower'],['none','None']])}</div>
        <fieldset class="wb-color-fields"><legend>Local palette</legend><div class="wb-colors">${[['ink','Ink'],['paper','Paper'],['accent','Accent'],['pop','Pop'],['hot','Signal'],['stage','Canvas']].map(([key,label])=>`<label class="wb-color">${label}<input type="color" data-color="${key}" aria-label="Workbench ${label}"></label>`).join('')}</div><p class="wb-palette-note">Only this specimen changes. Canvas color stays in the preview.</p></fieldset>
        <button type="button" class="wb-text-button" id="wb-use-palette">Use library colors</button>
        ${field('Preview setting','context',[['canvas','On the canvas'],['card','Inside a card']])}
        <button type="button" class="wb-text-button" id="wb-reset">Reset this specimen</button>
      </div>
    </div>
    <div class="wb-footer"><p id="wb-export-note">Exports include your design, with the button at rest.</p><div class="wb-actions"><button type="button" class="act primary" id="wb-copy-html">Copy HTML + CSS</button><button type="button" class="act" id="wb-copy-react">Copy React</button></div></div>
    <section class="wb-favorites" aria-labelledby="wb-favorites-title">
      <div class="wb-favorites-heading"><div><h3 id="wb-favorites-title">RIPSlop favorites</h3><p>Keep a few versions to come back to. Loading a favorite leaves the saved version intact.</p></div><span id="wb-favorite-count" class="count"></span></div>
      <form id="wb-save-favorite" class="wb-save-form"><label class="wb-field" for="wb-favorite-name">Version name<input id="wb-favorite-name" type="text" maxlength="50" required placeholder="e.g. RIPSlop · primary CTA" autocomplete="off"></label><button type="submit" class="act primary">Save as favorite</button></form>
      <p id="wb-storage-note" class="wb-storage-note" role="status"></p>
      <div id="wb-favorite-list" class="wb-favorite-list"></div>
      <div class="wb-favorite-feedback"><span id="wb-favorite-message" role="status"></span><button type="button" class="wb-text-button" id="wb-undo-remove" hidden>Undo removal</button></div>
    </section>
    <details class="wb-code"><summary>Inspect export</summary><div class="wb-actions" style="margin-top:14px" role="group" aria-label="Export format"><button type="button" class="act" data-format="html" aria-pressed="true">HTML + CSS</button><button type="button" class="act" data-format="react" aria-pressed="false">React</button></div><pre tabindex="0"><code id="wb-code"></code></pre></details>
    <style id="wb-preview-css"></style>`;
  const $ = selector => host.querySelector(selector);
  const sample = $('#wb-sample');
  function makeFrame(design, d, compact, pinned = 'idle') {
    const frame = document.createElement('iframe');
    frame.className = compact ? 'wb-compare-frame' : 'wb-effect-frame';
    frame.title = `${findSpecimen(design.specimen)?.name || 'Button'} ${compact ? 'comparison' : 'interactive preview'}`;
    frame.setAttribute('sandbox','allow-scripts');
    const css = design.css.replaceAll(':is(:hover, :focus-visible)', ':is(:hover, :focus-visible, [data-preview="hover"], [data-preview="focus"], [data-preview="pressed"])').replaceAll(':active', ':is(:active, [data-preview="pressed"])');
    const script = `${design.setup}\nconst target = document.querySelector('.${design.cls}');\n${design.init ? `${design.init}(target);` : ''}\ntarget.dataset.preview = ${JSON.stringify(pinned)};\nif (['disabled','loading'].includes(${JSON.stringify(pinned)})) target.disabled = true;\nif (['loading','success'].includes(${JSON.stringify(pinned)})) target.dataset.status = ${JSON.stringify(pinned)};\nif (${JSON.stringify(pinned)} === 'loading') target.setAttribute('aria-busy','true');\nif (${JSON.stringify(pinned)} === 'focus') target.focus();\ntarget.addEventListener('pointerup', e => {if(e.pointerType !== 'mouse'){target.classList.add('is-active');setTimeout(()=>target.classList.remove('is-active'),2000);}});`;
    const fit = `const content = document.querySelector('.frame-content');
const fitPreview = () => { content.style.setProperty('--fit', Math.min(${compact ? .7 : 1}, (innerWidth - 32) / Math.max(1,content.offsetWidth), (innerHeight - 24) / Math.max(1,content.offsetHeight))); };
if (typeof ResizeObserver !== 'undefined') { new ResizeObserver(fitPreview).observe(content); window.addEventListener('resize',fitPreview); fitPreview(); }`;
    frame.srcdoc = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:${d.colors.stage};color:${d.colors.ink};font:15px/1.5 system-ui,sans-serif}body{display:grid;place-items:center;overflow:hidden}.frame-stage{position:absolute;inset:0}.frame-content{position:absolute;top:50%;left:50%;width:max-content;transform:translate(-50%,-50%) scale(var(--fit,1));transform-origin:center}${css}</style><body><div class="frame-stage"><div class="frame-content">${design.html}</div></div><script>${(script+fit).replace(/<\/script/gi,'<\\/script')}<\/script></body></html>`;
    return frame;
  }
  function renderTray() {
    const list = $('.wb-comparison');
    list.querySelectorAll('.wb-tray-item').forEach(item => {
      if (!tray.includes(item.dataset.trayItem)) { comparisonKeys.delete(item.dataset.trayItem); item.remove(); }
    });
    for (const cls of tray) {
      const b = findSpecimen(cls);
      if (!drafts.has(cls)) drafts.set(cls,initial(b));
      const design = buildFor(b,drafts.get(cls));
      let item = list.querySelector(`[data-tray-item="${cls}"]`);
      if (!item) {
        item = document.createElement('div'); item.className = 'wb-tray-item'; item.dataset.trayItem = cls;
        const edit = document.createElement('button'); edit.type = 'button'; edit.className = 'wb-pick'; edit.dataset.specimen = cls; edit.textContent = b.name;
        edit.addEventListener('click', () => { selected = b; state = 'idle'; syncControls(); });
        const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wb-remove'; remove.textContent = '×'; remove.setAttribute('aria-label',`Remove ${b.name} from workbench`); remove.dataset.trayRemove = cls;
        remove.addEventListener('click', () => {
          tray = tray.filter(id => id !== cls);
          if (selected.cls === cls) selected = findSpecimen(tray[0]) || selected;
          pendingAdd = null; $('#wb-replace').hidden = true; state = 'idle'; syncControls();
          const focusTarget = list.querySelector('[data-specimen]') || $('#wb-empty a'); focusTarget.focus();
        });
        item.append(edit,remove); list.append(item);
      }
      const key = JSON.stringify(drafts.get(cls));
      if (comparisonKeys.get(cls) !== key) {
        item.querySelector('iframe')?.remove(); item.append(makeFrame(design,drafts.get(cls),true)); comparisonKeys.set(cls,key);
      }
      item.classList.toggle('selected',cls === selected.cls);
      item.querySelector('[data-specimen]').setAttribute('aria-pressed',String(cls === selected.cls));
    }
    $('#wb-tray-count').textContent = `${tray.length} / 5`;
    $('#wb-empty').hidden = tray.length !== 0;
    for (const selector of ['.wb-body','.wb-footer','.wb-code']) $(selector).hidden = tray.length === 0;
    $('#wb-save-favorite button').disabled = tray.length === 0; $('#wb-favorite-name').disabled = tray.length === 0;
    document.querySelectorAll('[data-workbench-open]').forEach(link => {link.textContent = tray.includes(link.dataset.workbenchOpen) ? 'Open in workbench' : 'Add to workbench';});
  }
  function activateAdded(cls, favorite) {
    if (!tray.includes(cls)) tray.push(cls);
    selected = findSpecimen(cls);
    if (favorite) { drafts.set(cls,cloneDraft(favorite.draft)); context = favorite.context; }
    state = 'idle'; pendingAdd = null; $('#wb-replace').hidden = true; syncControls();
    $('#wb-title').focus({preventScroll:true}); host.scrollIntoView({block:'start'});
  }
  function requestAdd(cls, favorite = null) {
    showView('workbench');
    if (tray.includes(cls) || tray.length < 5) { activateAdded(cls,favorite); return; }
    pendingAdd = {cls,favorite};
    $('#wb-replace-message').textContent = `Your workbench has five buttons. Choose one to replace with ${findSpecimen(cls).name}. Its edits and favorites will stay saved.`;
    const choices = $('#wb-replace-choice'); choices.replaceChildren();
    for (const id of tray) { const option = document.createElement('option'); option.value = id; option.textContent = findSpecimen(id).name; choices.append(option); }
    choices.value = selected.cls; $('#wb-replace').hidden = false;
    $('#wb-replace').scrollIntoView({block:'center'}); choices.focus({preventScroll:true});
  }
  $('#wb-confirm-replace').addEventListener('click', () => {
    if (!pendingAdd) return;
    const {cls,favorite} = pendingAdd; tray = tray.filter(id => id !== $('#wb-replace-choice').value); activateAdded(cls,favorite);
  });
  $('#wb-cancel-replace').addEventListener('click', () => { pendingAdd = null; $('#wb-replace').hidden = true; $('#wb-title').focus(); });
  function showStorageMessage() {
    $('#wb-storage-note').textContent = storageMessage;
    $('#wb-storage-note').classList.toggle('wb-storage-warning', storageUnavailable);
  }
  function persist() {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({version:1,tray,selected:selected.cls,state,context,format,drafts:Object.fromEntries(drafts),favorites}));
      storageUnavailable = false;
      storageMessage = 'Edits and favorites save automatically in this browser, at this address.';
    } catch {
      storageUnavailable = true;
      storageMessage = 'Browser storage is unavailable or full. Recent changes are only kept in this open page.';
    }
    showStorageMessage();
  }
  function favoriteMessage(message) { $('#wb-favorite-message').textContent = message; }
  function renderFavorites() {
    const list = $('#wb-favorite-list');
    list.replaceChildren();
    $('#wb-favorite-count').textContent = `${favorites.length} / ${FAVORITE_LIMIT} saved`;
    if (!favorites.length) {
      const empty = document.createElement('p'); empty.className = 'wb-favorites-empty';
      empty.textContent = 'No favorites yet. Give your current design a name and save it here.'; list.append(empty);
    }
    for (const f of favorites) {
      const row = document.createElement('article'); row.className = 'wb-favorite';
      const swatches = document.createElement('span'); swatches.className = 'wb-favorite-swatches'; swatches.setAttribute('aria-hidden','true');
      for (const key of ['ink','accent','pop']) { const swatch = document.createElement('i'); swatch.style.backgroundColor = f.draft.colors[key]; swatches.append(swatch); }
      const info = document.createElement('div'); info.className = 'wb-favorite-info';
      const name = document.createElement('h4'); name.textContent = f.name;
      const description = document.createElement('p'); description.textContent = `${findSpecimen(f.specimen).name} · ${f.draft.label || defaults[specimens.indexOf(findSpecimen(f.specimen))]}`;
      info.append(name, description);
      const actions = document.createElement('div'); actions.className = 'wb-actions';
      const load = document.createElement('button'); load.type = 'button'; load.className = 'act'; load.textContent = 'Load'; load.dataset.favoriteLoad = f.id; load.setAttribute('aria-label',`Load ${f.name}`);
      load.addEventListener('click', () => {
        requestAdd(f.specimen, f);
        favoriteMessage(`Load “${f.name}” into the workbench. Saved versions stay intact.`);
      });
      const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'wb-text-button'; remove.textContent = 'Remove'; remove.dataset.favoriteRemove = f.id; remove.setAttribute('aria-label',`Remove ${f.name}`);
      remove.addEventListener('click', () => {
        removedFavorite = {favorite:f,index:favorites.findIndex(item => item.id === f.id)};
        favorites = favorites.filter(item => item.id !== f.id); persist(); renderFavorites();
        favoriteMessage(`Removed “${f.name}”.`); $('#wb-undo-remove').hidden = false; $('#wb-undo-remove').focus();
      });
      actions.append(load, remove); row.append(swatches, info, actions); list.append(row);
    }
  }
  const scopedBase = cls => BASE.replace(/\.cta(?=[\s:,.{])/g, '.' + cls);
  const hash = text => { let h=2166136261; for(const ch of text) h=Math.imul(h^ch.charCodeAt(0),16777619); return (h>>>0).toString(36); };
  const statusCSS = cls => `
.${cls} { max-width:100%; white-space:normal; justify-content:center; text-align:center; }
.${cls} > .wb-label { overflow-wrap:anywhere; min-width:0; }
.${cls} > .wb-extra-icon { flex:none; width:18px; height:18px; }
.${cls} .wb-loading, .${cls} .wb-success { display:none; }
.${cls}[data-status] > :not(.wb-loading):not(.wb-success) { display:none; }
.${cls}[data-status="loading"] .wb-loading, .${cls}[data-status="success"] .wb-success { display:inline-flex; align-items:center; gap:8px; }
.${cls}:disabled { cursor:not-allowed; opacity:.45; }
.${cls}[data-status="loading"] { opacity:.75; cursor:wait; }
.${cls} .wb-spinner { width:12px; height:12px; border:2px solid currentColor; border-right-color:transparent; border-radius:50%; animation:${cls}-spin .7s linear infinite; }
@keyframes ${cls}-spin { to { transform:rotate(360deg); } }
@media(prefers-reduced-motion:reduce) {
 .${cls}, .${cls} *, .${cls}::before, .${cls}::after { animation:none !important; transition:none !important; }
}`;
  function buildFor(b, d) {
    // Stable class per design prevents exported palettes/styles from leaking into other buttons.
    const cls = 'lab-' + b.cls.slice(4) + '-' + hash(JSON.stringify(d));
    let css = b.css.replaceAll(b.cls, cls)
      .replaceAll(':is(:hover, :focus-visible, .is-active)', ':not(:disabled):is(:hover, :focus-visible)')
      .replaceAll(':active', ':not(:disabled):active');
    if (d.motion === 'relaxed') css = css.replace(/(?<=[\s:,])(-?\d*\.?\d+)(ms|s)\b/g, (_, n, unit) => `${+(Number(n)*1.8).toFixed(3)}${unit}`);
    const vars = ['ink','paper','accent','pop','hot'].map(k=>`  --cta-${k}: ${d.colors[k]};`).join('\n');
    if (!simpleSpecimens.has(b.cls)) {
      const tpl = document.createElement('template'); tpl.innerHTML = b.html.replaceAll(b.cls, cls);
      tpl.content.querySelector('button').classList.remove('cta');
      const customCSS = WorkbenchAdapters.customize(tpl,b,d,cls);
      if (d.motion === 'relaxed') tpl.content.querySelectorAll('[style]').forEach(el => el.setAttribute('style',el.getAttribute('style').replace(/(\d*\.?\d+)(ms|s)\b/g, (_,n,unit) => Number(n)*1.8+unit)));
      const html = `<span class="${cls}-root">${tpl.innerHTML}</span>`;
      const off = d.motion === 'none' ? `.${cls}-root, .${cls}-root *, .${cls}-root *::before, .${cls}-root *::after {animation-duration:.01ms !important;animation-iteration-count:1 !important;transition:none !important;}` : '';
      const cssOutput = `${scopedBase(cls)}\n.${cls}-root {display:inline-block;max-width:100%;--out:cubic-bezier(.22,1,.36,1);--spring:cubic-bezier(.34,1.56,.64,1);${vars}}\n${css}\n${customCSS}\n${off}\n@media(prefers-reduced-motion:reduce){.${cls}-root, .${cls}-root *, .${cls}-root *::before, .${cls}-root *::after {animation-duration:.01ms !important;animation-iteration-count:1 !important;transition:none !important;}}`;
      const setup = WorkbenchAdapters.setupFor(b,d,cls,makeSpring,SPARKLE);
      return {css:cssOutput, html, cls, setup, init:setup ? 'setupWorkbench' : '', specimen:b.cls};
    }
    const originalHeight = b.css.match(/height:\s*(\d+)px/)[1];
    const size = {compact:'min-height:40px;height:auto;padding:10px 16px;font-size:14px;',comfortable:'min-height:52px;height:auto;padding:14px 24px;font-size:16px;',large:'min-height:64px;height:auto;padding:18px 30px;font-size:18px;'}[d.size] || `height:auto;min-height:${originalHeight}px;padding-top:8px;padding-bottom:8px;`;
    const radius = {square:'0',soft:'12px',pill:'999px'}[d.radius];
    let overrides = `\n.${cls}.${cls} { ${size}${radius ? `border-radius:${radius};` : ''}${d.icon !== 'original' ? 'gap:12px;' : ''} }\n`;
    if (radius && b.cls === 'cta-corner-trace') overrides += `.${cls}::before, .${cls}::after { border-radius:inherit; }\n`;
    if (d.motion === 'none') overrides += `.${cls}, .${cls} *, .${cls}::before, .${cls}::after { transition:none !important; animation:none !important; }\n`;
    const cssOutput = `${scopedBase(cls)}\n\n.${cls} {\n${vars}\n}\n\n${css}\n${overrides}${statusCSS(cls)}`;
    const tpl = document.createElement('template'); tpl.innerHTML = b.html;
    const button = tpl.content.querySelector('button');
    button.className = cls;
    let label = [...button.children].find(el=>el.tagName==='SPAN' && !el.querySelector('svg'));
    if (!label) { button.replaceChildren(); label=document.createElement('span'); button.append(label); }
    label.classList.add('wb-label'); label.textContent = d.label.trim() || defaults[specimens.indexOf(b)];
    if (d.icon !== 'original') {
      [...button.children].filter(el=>el !== label).forEach(el=>el.remove());
      if (d.icon !== 'none') {
        const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
        icon.setAttribute('class','wb-extra-icon'); icon.setAttribute('viewBox','0 0 24 24'); icon.setAttribute('fill','none'); icon.setAttribute('stroke','currentColor'); icon.setAttribute('stroke-width','2'); icon.setAttribute('aria-hidden','true');
        const path = document.createElementNS('http://www.w3.org/2000/svg','path'); path.setAttribute('d',d.icon === 'plus' ? 'M12 5v14M5 12h14' : 'M7 17L17 7M7 7h10v10'); icon.append(path); button.append(icon);
      }
    }
    const loading = document.createElement('span'); loading.className='wb-loading'; loading.innerHTML='<span class="wb-spinner" aria-hidden="true"></span>Loading…';
    const success = document.createElement('span'); success.className='wb-success'; success.textContent='Done';
    button.append(loading,success);
    return {css:cssOutput, html:button.outerHTML, cls, setup:'', specimen:b.cls};
  }
  // JSX text is emitted as a string expression, including quotes, braces and angle brackets.
  function jsx(node) {
    if(node.nodeType === 3) return `{${JSON.stringify(node.textContent)}}`;
    if(node.nodeType !== 1) return '';
    if(node.classList.contains('wb-label')) return '<span className="wb-label">{children}</span>';
    const attrs = [...node.attributes].map(a => {
      if (a.name === 'style') {
        const values = {};
        for (const key of Array.from(node.style)) values[key.startsWith('--') ? key : key.replace(/-([a-z])/g,(_,c)=>c.toUpperCase())] = node.style.getPropertyValue(key);
        return ` style={${JSON.stringify(values)}}`;
      }
      return ` ${jsxAttr(a.name)}={${JSON.stringify(a.value)}}`;
    }).join('');
    return `<${node.localName}${attrs}>${[...node.childNodes].map(jsx).join('')}</${node.localName}>`;
  }
  function exportCode(kind) {
    if (!simpleSpecimens.has(selected.cls)) {
      if (kind === 'html') return `<style>\n${currentCSS}\n</style>\n${currentHTML}${currentSetup ? `\n<script>\n${currentSetup}\ndocument.querySelectorAll('.${currentClass}').forEach(setupWorkbench);\n<\/script>` : ''}`;
      const tpl = document.createElement('template'); tpl.innerHTML = currentHTML;
      let markup = jsx(tpl.content.firstElementChild);
      markup = markup.replace(`className={"${currentClass}"}`, `{...props} ref={ref} disabled={disabled || loading} aria-busy={loading || undefined} data-status={loading ? "loading" : success ? "success" : undefined} className={"${currentClass}"}`);
      const name = selected.name.replace(/[^A-Za-z0-9]/g,'') + 'Button';
      return `import React, {useEffect, useRef} from "react";\nconst css = ${JSON.stringify(currentCSS)};\n${currentSetup}\nexport default function ${name}({disabled = false, loading = false, success = false, ...props}) {\n  const ref = useRef(null);\n  useEffect(() => { ${currentSetup ? `return setupWorkbench(ref.current);` : ''} }, []);\n  return <><style>{css}</style>${markup}</>;\n}\n`;
    }
    if(kind === 'html') return `<!-- Connect your action to this button.\nFor async actions: disable it and set data-status="loading" while waiting;\nset data-status="success" only after the action succeeds. -->\n<style>\n${currentCSS}\n</style>\n\n${currentHTML}`;
    const tpl=document.createElement('template'); tpl.innerHTML=currentHTML;
    const name=selected.name.replace(/\s/g,'')+'Button';
    const markup=jsx(tpl.content.firstElementChild).replace('type={"button"}', '{...props} type={type} disabled={disabled || loading} aria-busy={loading || undefined} data-status={loading ? "loading" : success ? "success" : undefined}');
    const cssLiteral = '`\n' + currentCSS.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '\n`';
    return `import React from "react";\n\nconst css = ${cssLiteral};\n\nexport default function ${name}({\n  children = ${JSON.stringify(draft().label.trim() || defaults[specimens.indexOf(selected)])},\n  type = "button", disabled = false, loading = false, success = false, ...props\n}) {\n  return (<>\n    <style>{css}</style>\n    ${markup}\n  </>);\n}\n`;
  }
  function updateCode() {
    $('#wb-code').textContent=exportCode(format);
    host.querySelectorAll('[data-format]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.format===format)));
  }
  function renderPreview() {
    const design = buildFor(selected, draft());
    currentCSS=design.css; currentHTML=design.html; currentSetup=design.setup; currentClass=design.cls;
    // Forced states exist only in the workbench stylesheet; they never ship in exports.
    const previewCSS=currentCSS.replaceAll(':is(:hover, :focus-visible)', ':is(:hover, :focus-visible, [data-preview="hover"], [data-preview="focus"], [data-preview="pressed"])')
      .replaceAll(':active', ':is(:active, [data-preview="pressed"])')
      .replaceAll(':focus-visible {', ':is(:focus-visible, [data-preview="focus"]) {');
    $('#wb-preview-css').textContent=previewCSS;
    const colors=draft().colors;
    for(const key of ['stage','ink','paper']) $('.wb-stage').style.setProperty('--wb-'+key, colors[key]);
    sample.className='wb-sample' + (context === 'card' ? ' wb-context-card' : '');
    sample.innerHTML=context === 'card' ? '<small>Your next project</small><h3>A little detail.<br>A different feeling.</h3><p>Try your button alongside real content. See how its color, shape and movement fit.</p>'+currentHTML : currentHTML;
    if (!simpleSpecimens.has(selected.cls)) {
      const frame = makeFrame(design, draft(), false, state);
      sample.querySelector(`.${design.cls}-root`).replaceWith(frame);
    }
    const button=sample.querySelector('button');
    if (button) button.dataset.preview=state;
    if(button && (state === 'disabled' || state === 'loading')) button.disabled=true;
    if(button && (state === 'loading' || state === 'success')) button.dataset.status=state;
    if(button && state === 'loading') button.setAttribute('aria-busy','true');
    $('#wb-specimen-name').textContent=selected.name;
    $('#wb-state-name').textContent=state === 'idle' ? 'Live preview' : state+' preview';
    $('#wb-preview-note').textContent=({idle:'Hover, tab, or press the button to try it.',focus:'Focus appearance is pinned. Tab to the button to try real keyboard focus.',loading:'Loading is simulated here. Your app controls when it starts and ends.',success:'Success is simulated here. Your app decides when an action is complete.'})[state] || 'This state is pinned for inspection. Exports start at rest.';
    host.querySelectorAll('[data-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===state)));
    updateCode();
    renderTray();
    persist();
  }
  function syncControls() {
    const d=draft();
    $('#wb-capabilities').textContent = 'Customize every detail. Alternate action messages keep their original wording.';
    for(const key of ['label','size','radius','icon','motion']) $('#wb-'+key).value=d[key];
    $('#wb-context').value=context;
    host.querySelectorAll('[data-color]').forEach(input=>input.value=d.colors[input.dataset.color]);
    host.querySelectorAll('[data-specimen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.specimen===selected.cls)));
    renderPreview();
  }

  host.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>{ state=b.dataset.state; renderPreview(); }));
  for(const key of ['label','size','radius','icon','motion']) $('#wb-'+key).addEventListener(key === 'label' ? 'input' : 'change',e=>{ draft()[key]=e.target.value; renderPreview(); });
  host.querySelectorAll('[data-color]').forEach(input=>input.addEventListener('input',()=>{draft().colors[input.dataset.color]=input.value; renderPreview();}));
  $('#wb-context').addEventListener('change',e=>{context=e.target.value; renderPreview();});
  $('#wb-use-palette').addEventListener('click',()=>{draft().colors={...palette}; syncControls(); toast('Library colors applied to this specimen');});
  $('#wb-reset').addEventListener('click',()=>{drafts.set(selected.cls,initial(selected)); state='idle'; syncControls(); toast('Specimen reset');});
  host.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>{format=b.dataset.format; updateCode(); persist();}));
  for(const kind of ['html','react']) $('#wb-copy-'+kind).addEventListener('click',async()=>{
    format=kind; updateCode(); persist();
    const ok=await copyText(exportCode(kind));
    if(ok) toast(`Copied customized ${selected.name} as ${kind === 'html' ? 'HTML + CSS' : 'React'}`);
    else { $('.wb-code').open=true; $('#wb-code').scrollIntoView({block:'nearest'}); selectNode($('#wb-code')); toast('Code selected. Press ⌘C or Ctrl+C to copy.'); }
  });
  $('#wb-favorite-name').addEventListener('input', e => e.target.setCustomValidity(''));
  $('#wb-save-favorite').addEventListener('submit', e => {
    e.preventDefault();
    const input = $('#wb-favorite-name'), name = input.value.trim();
    if (!name) { input.setCustomValidity('Give this version a name.'); input.reportValidity(); return; }
    if (favorites.length >= FAVORITE_LIMIT) { favoriteMessage(`Your ${FAVORITE_LIMIT} favorite slots are full. Remove a version before saving another.`); return; }
    let id;
    do { id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,10); } while (favorites.some(f => f.id === id));
    favorites.push({id,name:name.slice(0,50),specimen:selected.cls,draft:cloneDraft(draft()),context});
    persist(); renderFavorites(); input.value = '';
    favoriteMessage(storageUnavailable ? `“${name}” is available in this page, but could not be saved to browser storage.` : `Saved “${name}” to RIPSlop favorites.`);
  });
  $('#wb-undo-remove').addEventListener('click', () => {
    if (!removedFavorite) return;
    if (favorites.length >= FAVORITE_LIMIT) { favoriteMessage('Remove another version to make room before undoing.'); return; }
    favorites.splice(removedFavorite.index,0,removedFavorite.favorite); const name = removedFavorite.favorite.name; removedFavorite = null;
    persist(); renderFavorites(); $('#wb-undo-remove').hidden = true; favoriteMessage(`Restored “${name}”.`); $('#wb-favorite-name').focus();
  });
  // Every gallery card can join the comparison tray.
  for (const b of BUTTONS) {
    const actions = document.getElementById(b.cls)?.querySelector('.actions');
    if (!actions) continue;
    const open = document.createElement('a'); open.href = '#workbench'; open.className = 'act wb-open'; open.textContent = 'Add to workbench'; open.dataset.workbenchOpen = b.cls;
    open.addEventListener('click', () => requestAdd(b.cls)); actions.append(open);
  }
  function showView(view) {
    const workbench = view === 'workbench';
    host.hidden = !workbench;
    document.getElementById('library').hidden = workbench;
    document.querySelectorAll('[data-lab-view]').forEach(link => {
      if (link.dataset.labView === view) link.setAttribute('aria-current','page');
      else link.removeAttribute('aria-current');
    });
  }
  function route() {
    showView(location.hash === '#workbench' || location.hash.startsWith('#wb-') ? 'workbench' : 'library');
  }
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href^="#"]');
    if (!link || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const hash = link.getAttribute('href');
    showView(hash === '#workbench' || hash.startsWith('#wb-') ? 'workbench' : 'library');
  });
  window.addEventListener('hashchange', route);
  route();
  showStorageMessage(); renderFavorites(); syncControls(); ready = true;
})();
