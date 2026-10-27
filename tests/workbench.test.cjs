const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {JSDOM, VirtualConsole} = require('jsdom');
const {transformSync} = require('esbuild');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'index.html'),'utf8')
  .replace('<script src="workbench-adapters.js"></script>', () => '<script>'+fs.readFileSync(path.join(root,'workbench-adapters.js'),'utf8')+'</script>')
  .replace('<script src="workbench.js"></script>', () => '<script>'+fs.readFileSync(path.join(root,'workbench.js'),'utf8')+'</script>');
function fixture(t, options = {}) {
  const errors=[];
  const vc=new VirtualConsole();
  vc.on('jsdomError', e=>{if(e.type !== 'css-parsing') errors.push(e.message);});
  let copied='';
  const dom=new JSDOM(source, {url:'http://localhost/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
    w.matchMedia=()=>({matches:true});
    w.HTMLElement.prototype.scrollIntoView=()=>{};
    if (options.saved !== undefined) w.localStorage.setItem('button-lab-workbench-v1',options.saved);
    if (options.blockStorage) w.Storage.prototype.setItem=()=>{throw new w.DOMException('Full','QuotaExceededError');};
    Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}},configurable:true});
  }});
  t.after(()=>dom.window.close());
  const doc=dom.window.document;
  const $=s=>doc.querySelector(s);
  const click=s=>$(s).click();
  const change=(s,value)=>{const el=$(s);el.value=value;el.dispatchEvent(new dom.window.Event(el.type === 'text'||el.type === 'color'?'input':'change',{bubbles:true}));};
  const copy=async kind=>{click('#wb-copy-'+kind);await Promise.resolve();return copied;};
  assert.deepEqual(errors,[]);
  return {dom,doc,$,click,change,copy,errors};
}
const specimens=['classic','hard-press','shine-sweep','corner-trace','deck'];
test('all five specimens support preview states, with native disabled and busy semantics',t=>{
  const {$,click}=fixture(t);
  for(const name of specimens){
    click(`[data-specimen="cta-${name}"]`);
    for(const state of ['idle','hover','pressed','focus','disabled','loading','success']){
      click(`[data-state="${state}"]`);
      const b=$('#wb-sample button');
      assert.equal(b.disabled,state==='disabled'||state==='loading');
      assert.equal(b.dataset.preview,state);
      assert.equal(b.getAttribute('aria-busy'),state==='loading'?'true':null);
      assert.equal($(`[data-state="${state}"]`).getAttribute('aria-pressed'),'true');
    }
  }
});
test('edits survive switching specimens; reset only resets the selected specimen',t=>{
  const {$,click,change}=fixture(t);
  change('#wb-label','Build with RIPSlop');change('#wb-size','large');change('#wb-radius','pill');
  click('[data-specimen="cta-deck"]');change('#wb-label','Launch the Lab');
  click('[data-specimen="cta-classic"]');
  assert.equal($('#wb-label').value,'Build with RIPSlop');assert.equal($('#wb-size').value,'large');
  click('#wb-reset');assert.equal($('#wb-label').value,'Learn more');
  click('[data-specimen="cta-deck"]');assert.equal($('#wb-label').value,'Launch the Lab');
});
test('HTML exports are self-contained, escaped, and do not carry pinned states or global colors',async t=>{
  const {$,click,change,copy}=fixture(t);
  const label='Ship <script>alert("x")</script> & {now}';
  change('#wb-label',label);change('[data-color="accent"]','#123456');
  click('[data-state="loading"]');
  const code=await copy('html');
  const exportDOM=new JSDOM(code);t.after(()=>exportDOM.window.close());
  const b=exportDOM.window.document.querySelector('button');
  assert.equal(b.querySelector('.wb-label').textContent,label);
  assert.equal(exportDOM.window.document.querySelector('script'),null);
  assert.equal(b.disabled,false);assert.equal(b.hasAttribute('data-preview'),false);
  assert.equal(b.hasAttribute('data-status'),false);
  assert.ok(code.includes('--cta-accent: #123456'));
  assert.ok(!code.includes(':root'));assert.ok(!/\.cta[\s:{]/.test(code));
  assert.equal($('#color-accent').value,'#2f45ff');
});
test('different custom designs produce separate CSS classes and motion respects reduced preferences',async t=>{
  const {click,change,copy}=fixture(t);
  const first=await copy('html');
  change('[data-color="pop"]','#ff8800');change('#wb-motion','none');
  const second=await copy('html');
  const a=new JSDOM(first),b=new JSDOM(second);t.after(()=>{a.window.close();b.window.close();});
  assert.notEqual(a.window.document.querySelector('button').className,b.window.document.querySelector('button').className);
  assert.ok(second.includes('transition:none !important; animation:none !important;'));
  assert.ok(second.includes('@media(prefers-reduced-motion:reduce)'));
  click('[data-state="pressed"]');assert.equal(await copy('html'),second);
});
test('React exports compile and expose working children, action, and state props for every specimen',async t=>{
  const {click,change,copy}=fixture(t);
  for(const name of specimens){
    click(`[data-specimen="cta-${name}"]`);
    const label='RIPSlop < > {ship} "today" & tomorrow';change('#wb-label',label);
    const code=await copy('react');
    const compiled=transformSync(code,{loader:'jsx',format:'cjs'}).code;
    const module={exports:{}};new Function('require','module','exports',compiled)(require,module,module.exports);
    const Button=module.exports.default;
    const onClick=()=>{};
    const tree=Button({children:'Custom action',onClick});
    assert.equal(tree.props.children[1].props.onClick,onClick);
    assert.equal(React.Children.toArray(tree.props.children[1].props.children).find(child=>child.props?.className==='wb-label').props.children,'Custom action');
    for(const props of [{},{loading:true},{disabled:true},{success:true}]){
      const markup=renderToStaticMarkup(React.createElement(Button,props));
      const output=new JSDOM(markup);const b=output.window.document.querySelector('button');
      assert.equal(b.disabled,Boolean(props.loading||props.disabled));
      assert.equal(b.dataset.status,props.loading?'loading':props.success?'success':undefined);
      assert.equal(b.querySelector('.wb-label').textContent,label);
      output.window.close();
    }
  }
});
test('icon choices and card context keep the accessible label intact',t=>{
  const {$,change}=fixture(t);
  change('#wb-label','Make something');
  for(const icon of ['arrow','plus','none','original']){
    change('#wb-icon',icon);change('#wb-context','card');
    assert.equal($('#wb-sample .wb-label').textContent,'Make something');
    assert.equal($('#wb-sample button').querySelectorAll('svg').length,icon==='none'?0:1);
  }
});
test('blocked clipboard opens and selects the requested export',async t=>{
  const {dom,$,click}=fixture(t);
  dom.window.navigator.clipboard.writeText=async()=>{throw new Error('blocked');};
  dom.window.document.execCommand=()=>false;
  // jsdom has no layout scrollIntoView.
  $('#wb-code').scrollIntoView=()=>{};
  click('#wb-copy-react');
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal($('.wb-code').open,true);
  assert.ok(dom.window.getSelection().toString().startsWith('import React'));
});
const storageKey='button-lab-workbench-v1';
test('drafts, selected button, tray and preview settings survive a reload',t=>{
  const f=fixture(t);f.change('#wb-label','RIPSlop launch');f.change('#wb-size','large');f.change('[data-color="accent"]','#112233');f.change('#wb-context','card');
  f.click('[data-specimen="cta-deck"]');f.change('#wb-label','Second design');f.click('[data-state="pressed"]');
  const fresh=fixture(t,{saved:f.dom.window.localStorage.getItem(storageKey)});
  assert.equal(fresh.$('#wb-label').value,'Second design');assert.equal(fresh.$('#wb-context').value,'card');assert.equal(fresh.$('[data-state="pressed"]').getAttribute('aria-pressed'),'true');
  fresh.click('[data-specimen="cta-classic"]');assert.equal(fresh.$('#wb-label').value,'RIPSlop launch');assert.equal(fresh.$('#wb-size').value,'large');assert.equal(fresh.$('[data-color="accent"]').value,'#112233');
});
test('favorites are independent snapshots, restored after reload, with remove and undo',async t=>{
  const f=fixture(t);f.change('#wb-label','Original version');f.change('#wb-context','card');
  const original=await f.copy('html');
  f.change('#wb-favorite-name','RIPSlop <img src=x>');f.click('#wb-save-favorite button');
  assert.equal(f.$('#wb-favorite-list img'),null);
  f.change('#wb-label','Changed later');
  const fresh=fixture(t,{saved:f.dom.window.localStorage.getItem(storageKey)});
  fresh.click('[data-favorite-load]');assert.equal(fresh.$('#wb-label').value,'Original version');assert.equal(await fresh.copy('html'),original);
  fresh.change('#wb-label','Another edit');fresh.click('[data-favorite-load]');assert.equal(fresh.$('#wb-label').value,'Original version');
  fresh.click('[data-favorite-remove]');assert.equal(fresh.$('[data-favorite-load]'),null);assert.deepEqual(JSON.parse(fresh.dom.window.localStorage.getItem(storageKey)).favorites,[]);
  fresh.click('#wb-undo-remove');assert.ok(fresh.$('[data-favorite-load]'));assert.equal(JSON.parse(fresh.dom.window.localStorage.getItem(storageKey)).favorites.length,1);
});
test('every card can be added; a full tray asks which button to replace and preserves its edits',t=>{
  const f=fixture(t);f.change('#wb-label','Keep my draft');
  assert.equal(f.doc.querySelectorAll('[data-workbench-open]').length,111);
  f.click('[data-workbench-open="cta-sticker"]');assert.equal(f.$('#wb-replace').hidden,false);assert.equal(f.doc.querySelectorAll('.wb-tray-item').length,5);
  f.change('#wb-replace-choice','cta-classic');f.click('#wb-confirm-replace');
  assert.ok(f.$('[data-specimen="cta-sticker"]'));assert.equal(f.$('#wb-label').disabled,false);assert.ok(f.$('#wb-sample iframe'));assert.equal(f.doc.querySelectorAll('.wb-tray-item').length,5);
  f.click('[data-tray-remove="cta-sticker"]');f.click('[data-workbench-open="cta-classic"]');assert.equal(f.$('#wb-label').value,'Keep my draft');
  const fresh=fixture(t,{saved:f.dom.window.localStorage.getItem(storageKey)});assert.equal(fresh.doc.querySelectorAll('.wb-tray-item').length,5);assert.equal(fresh.$('#wb-label').value,'Keep my draft');
});
test('empty trays survive reload and can accept a favorite or a new library button',t=>{
  const f=fixture(t);for(const el of [...f.doc.querySelectorAll('[data-tray-remove]')]) el.click();
  assert.equal(f.$('.wb-body').hidden,true);assert.equal(f.$('#wb-save-favorite button').disabled,true);
  const fresh=fixture(t,{saved:f.dom.window.localStorage.getItem(storageKey)});assert.equal(fresh.$('#wb-empty').hidden,false);
  fresh.click('[data-workbench-open="cta-confetti"]');assert.equal(fresh.$('.wb-body').hidden,false);assert.equal(fresh.doc.querySelectorAll('.wb-tray-item').length,1);
});
test('invalid saved values are sanitized and unavailable storage is reported without breaking editing',t=>{
  const saved=JSON.stringify({version:1,selected:'bad',tray:['bad','cta-classic','cta-classic'],drafts:{'cta-classic':{size:'huge',colors:{ink:'red;display:none'},label:'A'.repeat(100)}},favorites:[null,{id:'x',specimen:'bad',name:'bad'}]});
  const f=fixture(t,{saved});assert.equal(f.$('#wb-label').value.length,64);assert.equal(f.$('#wb-size').value,'original');assert.equal(f.$('[data-color="ink"]').value,'#0a0a0a');assert.equal(f.doc.querySelectorAll('.wb-tray-item').length,1);
  const broken=fixture(t,{saved:'{bad json'});assert.ok(broken.$('#wb-storage-note').textContent.includes('could not be read'));
  const full=fixture(t,{blockStorage:true});full.change('#wb-label','Still editable');assert.ok(full.$('#wb-storage-note').textContent.includes('unavailable or full'));assert.equal(full.$('#wb-sample .wb-label').textContent,'Still editable');
});
test('all 111 registry buttons export compilable React and runnable standalone HTML',async t=>{
  const f=fixture(t);
  for(const link of [...f.doc.querySelectorAll('[data-workbench-open]')]){
    link.click();if(!f.$('#wb-replace').hidden) f.click('#wb-confirm-replace');
    const code=await f.copy('react');
    const compiled=transformSync(code,{loader:'jsx',format:'cjs'}).code;
    const module={exports:{}};new Function('require','module','exports',compiled)(require,module,module.exports);
    assert.ok(renderToStaticMarkup(React.createElement(module.exports.default)).includes('<button'),link.dataset.workbenchOpen);
    const errors=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(e.type!=='css-parsing')errors.push(e.message);});
    const out=new JSDOM(await f.copy('html'),{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false});}});
    assert.deepEqual(errors,[],link.dataset.workbenchOpen);out.window.close();
  }
  assert.deepEqual(f.errors,[]);
});
test('loading a favorite outside a full tray waits for an explicit replacement',t=>{
  const f=fixture(t);f.change('#wb-label','Favorite snapshot');f.change('#wb-favorite-name','Primary');f.click('#wb-save-favorite button');
  f.click('[data-workbench-open="cta-sticker"]');f.change('#wb-replace-choice','cta-classic');f.click('#wb-confirm-replace');
  f.click('[data-favorite-load]');assert.equal(f.$('#wb-replace').hidden,false);assert.equal(f.$('[data-specimen="cta-classic"]'),null);
  f.click('#wb-cancel-replace');assert.equal(f.$('[data-specimen="cta-classic"]'),null);
  f.click('[data-favorite-load]');f.click('#wb-confirm-replace');assert.equal(f.$('#wb-label').value,'Favorite snapshot');assert.equal(f.doc.querySelectorAll('.wb-tray-item').length,5);
});

test('global navigation separates the library and workbench, including deep links and history', t => {
  const f = fixture(t);
  assert.equal(f.$('#workbench').hidden, true); assert.equal(f.$('#library').hidden, false);
  f.click('[data-lab-view=workbench]');
  assert.equal(f.$('#library').hidden, true); assert.equal(f.$('#workbench').hidden, false);
  assert.equal(f.$('[data-lab-view=workbench]').getAttribute('aria-current'), 'page');
  for (const hash of ['#group-dot','#cta-sticker','#workbench','#wb-favorites-title','#library']) {
    f.dom.window.history.replaceState(null,'',hash); f.dom.window.dispatchEvent(new f.dom.window.HashChangeEvent('hashchange'));
    assert.equal(f.$('#library').hidden, hash === '#workbench' || hash.startsWith('#wb-'));
  }
  f.click('[data-workbench-open="cta-sticker"]'); assert.equal(f.$('#library').hidden,true); assert.equal(f.$('#wb-replace').hidden,false);
});

test('all 111 customized designs retain text, effects, state controls and runnable exports', async t => {
  const f = fixture(t), errors = [];
  const label = 'RIP < & {go}';
  for (const link of [...f.doc.querySelectorAll('[data-workbench-open]')]) {
    link.click(); if (!f.$('#wb-replace').hidden) f.click('#wb-confirm-replace');
    for (const [key,value] of Object.entries({label,size:'large',radius:'soft',icon:'plus',motion:'relaxed'})) {
      assert.equal(f.$('#wb-'+key).disabled,false,link.dataset.workbenchOpen); f.change('#wb-'+key,value);
    }
    f.change('[data-color=accent]','#aabbcc');
    const html = await f.copy('html');
    assert.ok(html.includes('#aabbcc')); assert.ok(!html.includes('data-preview='));
    const vc = new VirtualConsole(); vc.on('jsdomError', e=>{if(e.type !== 'css-parsing') errors.push(`${link.dataset.workbenchOpen}: ${e.message}`);});
    const standalone = new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false});}});
    const button = standalone.window.document.querySelector('button');
    assert.ok(button.getAttribute('aria-label')?.includes(label) || button.textContent.includes(label),link.dataset.workbenchOpen);
    assert.equal(button.querySelector('script'),null);
    assert.ok(button.querySelector('.wb-icon-art,.wb-custom-icon,.wb-extra-icon'),link.dataset.workbenchOpen);
    if (link.dataset.workbenchOpen === 'cta-cart') {
      button.click(); const fly = button.querySelector('.fly'); fly.dispatchEvent(new standalone.window.Event('animationend'));
      assert.equal(button.querySelector('.qty').textContent,'1'); assert.ok(button.getAttribute('aria-label').startsWith(label));
    }
    if (link.dataset.workbenchOpen === 'cta-nova') { button.click(); assert.equal(button.querySelectorAll('.spark svg').length,16); }
    if (link.dataset.workbenchOpen === 'cta-board') assert.equal([...button.querySelectorAll('.tile .a')].map(el=>el.textContent).join(''),label.replaceAll(' ','\u00a0'));
    if (link.dataset.workbenchOpen === 'cta-terminal') assert.equal(button.querySelector('.ghost').textContent,label);
    if (link.dataset.workbenchOpen === 'cta-letters') assert.equal(button.querySelector('.word').textContent,label.replaceAll(' ','\u00a0'));
    if (link.dataset.workbenchOpen === 'cta-ransom') assert.equal(button.querySelector('.word').textContent,label.replaceAll(' ','\u00a0'));
    if (link.dataset.workbenchOpen === 'cta-burger') {button.click();assert.equal(button.getAttribute('aria-expanded'),'true');}
    standalone.window.close();
    const code = await f.copy('react');
    const compiled = transformSync(code,{loader:'jsx',format:'cjs'}).code;
    const mod = {exports:{}}; new Function('require','module','exports',compiled)(require,mod,mod.exports);
    const rendered = renderToStaticMarkup(React.createElement(mod.exports.default,{loading:true}));
    const reactDoc = new JSDOM(rendered).window;
    assert.equal(reactDoc.document.querySelector('button').disabled,true,link.dataset.workbenchOpen);
    assert.equal(reactDoc.document.querySelector('button').dataset.status,'loading'); reactDoc.close();
    f.click('[data-state=loading]');
    const iframe = f.$('#wb-sample iframe');
    if (iframe) {
      const preview = new JSDOM(iframe.srcdoc,{runScripts:'dangerously',pretendToBeVisual:true,virtualConsole:vc,beforeParse(w){w.matchMedia=()=>({matches:false});}});
      assert.equal(preview.window.document.querySelector('button').disabled,true);assert.equal(preview.window.document.querySelector('button').dataset.status,'loading');preview.window.close();
    }
  }
  assert.deepEqual(errors,[]);
});

test('slower motion changes time values without rewriting design class names ending in s', async t => {
  const f=fixture(t);
  f.click('[data-workbench-open="cta-letter-cascade"]');f.click('#wb-confirm-replace');
  f.change('#wb-label','Build with RIPSlop');f.change('#wb-icon','plus');f.change('#wb-motion','relaxed');f.change('#wb-radius','soft');
  const html=await f.copy('html'), doc=new JSDOM(html).window;
  const cls=doc.document.querySelector('button').className;
  assert.match(cls,/\ds$/);assert.ok(html.includes(`.${cls} .word { display: flex; }`));
  assert.ok(html.includes('transition-delay: 32.4ms'));doc.close();
});
