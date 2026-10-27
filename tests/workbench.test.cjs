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
  .replace('<script src="workbench.js"></script>', () => '<script>'+fs.readFileSync(path.join(root,'workbench.js'),'utf8')+'</script>');
function fixture(t) {
  const errors=[];
  const vc=new VirtualConsole();
  vc.on('jsdomError', e=>{if(e.type !== 'css-parsing') errors.push(e.message);});
  let copied='';
  const dom=new JSDOM(source, {url:'http://localhost/',runScripts:'dangerously',virtualConsole:vc,beforeParse(w){
    w.matchMedia=()=>({matches:true});
    Object.defineProperty(w.navigator,'clipboard',{value:{writeText:async text=>{copied=text;}},configurable:true});
  }});
  t.after(()=>dom.window.close());
  const doc=dom.window.document;
  const $=s=>doc.querySelector(s);
  const click=s=>$(s).click();
  const change=(s,value)=>{const el=$(s);el.value=value;el.dispatchEvent(new dom.window.Event(el.type === 'text'||el.type === 'color'?'input':'change',{bubbles:true}));};
  const copy=async kind=>{click('#wb-copy-'+kind);await Promise.resolve();return copied;};
  assert.deepEqual(errors,[]);
  return {dom,doc,$,click,change,copy};
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
