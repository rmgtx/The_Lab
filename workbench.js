/* Five registry-backed specimens. No build step and no external dependencies. */
(() => {
  'use strict';
  const host = document.getElementById('workbench');
  const specimens = ['cta-classic', 'cta-hard-press', 'cta-shine-sweep', 'cta-corner-trace', 'cta-deck']
    .map(cls => BUTTONS.find(button => button.cls === cls));
  const defaults = ['Learn more', 'Join the waitlist', 'Deploy now', 'View the work', 'Deal me in'];
  const drafts = new Map();
  let selected = specimens[0], state = 'idle', context = 'canvas', format = 'html';
  let currentCSS = '', currentHTML = '';
  const initial = b => ({label:defaults[specimens.indexOf(b)],size:'original',radius:'original',icon:'original',motion:'original',colors:{...palette}});
  const draft = () => {
    if (!drafts.has(selected.cls)) drafts.set(selected.cls, initial(selected));
    return drafts.get(selected.cls);
  };
  const field = (label, id, options) => `<div class="wb-field"><label for="wb-${id}">${label}</label><select id="wb-${id}">${options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select></div>`;
  host.innerHTML = `
    <div class="wb-heading"><div><p class="wb-eyebrow">Workbench · 5 specimens</p><h2 id="wb-title">Make it yours.</h2><p>Shape a button, try its states, take the code.</p></div><a href="#groups">Browse all ${BUTTONS.length} buttons ↗</a></div>
    <div class="wb-picks" role="group" aria-label="Workbench button">${specimens.map(b => `<button type="button" class="wb-pick" data-specimen="${b.cls}" aria-pressed="false"><small>${b.no}</small>${b.name}</button>`).join('')}</div>
    <div class="wb-body">
      <div class="wb-preview">
        <div class="wb-stage"><div class="wb-stage-label"><span id="wb-specimen-name"></span><span id="wb-state-name">Live preview</span></div><div class="wb-sample" id="wb-sample"></div></div>
        <div class="wb-states" role="group" aria-label="Preview state">${['idle','hover','pressed','focus','disabled','loading','success'].map(s => `<button type="button" class="wb-state" data-state="${s}" aria-pressed="${s === 'idle'}">${s[0].toUpperCase()+s.slice(1)}</button>`).join('')}</div>
        <p class="wb-preview-note" id="wb-preview-note">Hover, tab, or press the button to try it.</p>
      </div>
      <div class="wb-controls">
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
    <details class="wb-code"><summary>Inspect export</summary><div class="wb-actions" style="margin-top:14px" role="group" aria-label="Export format"><button type="button" class="act" data-format="html" aria-pressed="true">HTML + CSS</button><button type="button" class="act" data-format="react" aria-pressed="false">React</button></div><pre tabindex="0"><code id="wb-code"></code></pre></details>
    <style id="wb-preview-css"></style>`;
  const $ = selector => host.querySelector(selector);
  const sample = $('#wb-sample');
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
  function build() {
    const d = draft();
    // Stable class per design prevents exported palettes/styles from leaking into other buttons.
    const cls = 'lab-' + selected.cls.slice(4) + '-' + hash(JSON.stringify(d));
    let css = selected.css.replaceAll(selected.cls, cls)
      .replaceAll(':is(:hover, :focus-visible, .is-active)', ':not(:disabled):is(:hover, :focus-visible)')
      .replaceAll(':active', ':not(:disabled):active');
    if (d.motion === 'relaxed') css = css.replace(/(\d*\.?\d+)s\b/g, (_, n) => `${+(Number(n)*1.8).toFixed(3)}s`);
    const vars = ['ink','paper','accent','pop','hot'].map(k=>`  --cta-${k}: ${d.colors[k]};`).join('\n');
    const originalHeight = selected.css.match(/height:\s*(\d+)px/)[1];
    const size = {compact:'min-height:40px;height:auto;padding:10px 16px;font-size:14px;',comfortable:'min-height:52px;height:auto;padding:14px 24px;font-size:16px;',large:'min-height:64px;height:auto;padding:18px 30px;font-size:18px;'}[d.size] || `height:auto;min-height:${originalHeight}px;padding-top:8px;padding-bottom:8px;`;
    const radius = {square:'0',soft:'12px',pill:'999px'}[d.radius];
    let overrides = `\n.${cls}.${cls} { ${size}${radius ? `border-radius:${radius};` : ''}${d.icon !== 'original' ? 'gap:12px;' : ''} }\n`;
    if (radius && selected.cls === 'cta-corner-trace') overrides += `.${cls}::before, .${cls}::after { border-radius:inherit; }\n`;
    if (d.motion === 'none') overrides += `.${cls}, .${cls} *, .${cls}::before, .${cls}::after { transition:none !important; animation:none !important; }\n`;
    currentCSS = `${scopedBase(cls)}\n\n.${cls} {\n${vars}\n}\n\n${css}\n${overrides}${statusCSS(cls)}`;
    const tpl = document.createElement('template'); tpl.innerHTML = selected.html;
    const button = tpl.content.querySelector('button');
    button.className = cls;
    let label = [...button.children].find(el=>el.tagName==='SPAN' && !el.querySelector('svg'));
    if (!label) { button.replaceChildren(); label=document.createElement('span'); button.append(label); }
    label.classList.add('wb-label'); label.textContent = d.label.trim() || defaults[specimens.indexOf(selected)];
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
    currentHTML = button.outerHTML;
  }
  // JSX text is emitted as a string expression, including quotes, braces and angle brackets.
  function jsx(node) {
    if(node.nodeType === 3) return `{${JSON.stringify(node.textContent)}}`;
    if(node.nodeType !== 1) return '';
    if(node.classList.contains('wb-label')) return '<span className="wb-label">{children}</span>';
    const attrs = [...node.attributes].map(a=>` ${jsxAttr(a.name)}={${JSON.stringify(a.value)}}`).join('');
    return `<${node.localName}${attrs}>${[...node.childNodes].map(jsx).join('')}</${node.localName}>`;
  }
  function exportCode(kind) {
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
    build();
    // Forced states exist only in the workbench stylesheet; they never ship in exports.
    const previewCSS=currentCSS.replaceAll(':is(:hover, :focus-visible)', ':is(:hover, :focus-visible, [data-preview="hover"], [data-preview="focus"], [data-preview="pressed"])')
      .replaceAll(':active', ':is(:active, [data-preview="pressed"])')
      .replaceAll(':focus-visible {', ':is(:focus-visible, [data-preview="focus"]) {');
    $('#wb-preview-css').textContent=previewCSS;
    const colors=draft().colors;
    for(const key of ['stage','ink','paper']) $('.wb-stage').style.setProperty('--wb-'+key, colors[key]);
    sample.className='wb-sample' + (context === 'card' ? ' wb-context-card' : '');
    sample.innerHTML=context === 'card' ? '<small>Your next project</small><h3>A little detail.<br>A different feeling.</h3><p>Try your button alongside real content. See how its color, shape and movement fit.</p>'+currentHTML : currentHTML;
    const button=sample.querySelector('button');
    button.dataset.preview=state;
    if(state === 'disabled' || state === 'loading') button.disabled=true;
    if(state === 'loading' || state === 'success') button.dataset.status=state;
    if(state === 'loading') button.setAttribute('aria-busy','true');
    $('#wb-specimen-name').textContent=selected.name;
    $('#wb-state-name').textContent=state === 'idle' ? 'Live preview' : state+' preview';
    $('#wb-preview-note').textContent=({idle:'Hover, tab, or press the button to try it.',focus:'Focus appearance is pinned. Tab to the button to try real keyboard focus.',loading:'Loading is simulated here. Your app controls when it starts and ends.',success:'Success is simulated here. Your app decides when an action is complete.'})[state] || 'This state is pinned for inspection. Exports start at rest.';
    host.querySelectorAll('[data-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.state===state)));
    updateCode();
  }
  function syncControls() {
    const d=draft();
    for(const key of ['label','size','radius','icon','motion']) $('#wb-'+key).value=d[key];
    host.querySelectorAll('[data-color]').forEach(input=>input.value=d.colors[input.dataset.color]);
    host.querySelectorAll('[data-specimen]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.specimen===selected.cls)));
    renderPreview();
  }
  host.querySelectorAll('[data-specimen]').forEach(b=>b.addEventListener('click',()=>{ selected=specimens.find(s=>s.cls===b.dataset.specimen); state='idle'; syncControls(); }));
  host.querySelectorAll('[data-state]').forEach(b=>b.addEventListener('click',()=>{ state=b.dataset.state; renderPreview(); }));
  for(const key of ['label','size','radius','icon','motion']) $('#wb-'+key).addEventListener(key === 'label' ? 'input' : 'change',e=>{ draft()[key]=e.target.value; renderPreview(); });
  host.querySelectorAll('[data-color]').forEach(input=>input.addEventListener('input',()=>{draft().colors[input.dataset.color]=input.value; renderPreview();}));
  $('#wb-context').addEventListener('change',e=>{context=e.target.value; renderPreview();});
  $('#wb-use-palette').addEventListener('click',()=>{draft().colors={...palette}; syncControls(); toast('Library colors applied to this specimen');});
  $('#wb-reset').addEventListener('click',()=>{drafts.set(selected.cls,initial(selected)); state='idle'; syncControls(); toast('Specimen reset');});
  host.querySelectorAll('[data-format]').forEach(b=>b.addEventListener('click',()=>{format=b.dataset.format; updateCode();}));
  for(const kind of ['html','react']) $('#wb-copy-'+kind).addEventListener('click',async()=>{
    format=kind; updateCode();
    const ok=await copyText(exportCode(kind));
    if(ok) toast(`Copied customized ${selected.name} as ${kind === 'html' ? 'HTML + CSS' : 'React'}`);
    else { $('.wb-code').open=true; $('#wb-code').scrollIntoView({block:'nearest'}); selectNode($('#wb-code')); toast('Code selected. Press ⌘C or Ctrl+C to copy.'); }
  });
  syncControls();
})();
