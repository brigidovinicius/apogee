import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';

const compile = source => ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;

test('server validation focuses the first invalid field and preserves no-error focus', () => {
  const previous = globalThis.HTMLElement;
  class Element { calls=0; focus(){this.calls++;} }
  globalThis.HTMLElement=Element;
  try {
    const field=new Element(),message=new Element();
    let effect;
    const form={elements:{namedItem:name=>name==='videoUrl'?field:null},querySelector:()=>message};
    const mod={exports:{}};
    new Function('require','module','exports',compile(readFileSync(new URL('../components/ui/use-form-error-focus.ts',import.meta.url),'utf8')))(()=>({useRef:()=>({current:form}),useEffect:fn=>{effect=fn;}}),mod,mod.exports);
    mod.exports.useFormErrorFocus({errors:{videoUrl:'Invalid'}});effect();
    assert.equal(field.calls,1);assert.equal(message.calls,0);
    mod.exports.useFormErrorFocus({message:'Conflict'});effect();
    assert.equal(message.calls,1);
    mod.exports.useFormErrorFocus({});effect();
    assert.equal(field.calls,1);assert.equal(message.calls,1);
  } finally { if(previous===undefined)delete globalThis.HTMLElement;else globalThis.HTMLElement=previous; }
});

test('search preview shows the canonical generated URL for title and custom address', () => {
  const shared={exports:{}};
  new Function('exports',compile(readFileSync(new URL('../lib/blog/shared.ts',import.meta.url),'utf8')))(shared.exports);
  const seo={exports:{}};
  new Function('require','exports',compile(readFileSync(new URL('../lib/blog/seo.ts',import.meta.url),'utf8')))(()=>shared.exports,seo.exports);
  const draft={title:'Ciência & ideias em movimento',slug:'',excerpt:'Exemplo',body:'Texto',seoTitle:'',seoDescription:'',focusKeyword:''};
  assert.equal(seo.exports.analyzeSeo(draft).previewSlug,'ciencia-ideias-em-movimento');
  assert.equal(seo.exports.analyzeSeo({...draft,slug:' Um Endereço Personalizado! '}).previewSlug,'um-endereco-personalizado');
  assert.equal(seo.exports.analyzeSeo({...draft,title:''}).previewSlug,'');
});

test('interactive review transport rejects every request without delegating to a network client', async () => {
  const {fakeFetch,blocked,events}=await import('./interactive-review/transport.mjs');
  const start=events.length;
  assert.throws(blocked,/REVIEW_WRITE_BLOCKED/);
  const result=await fakeFetch('https://example.invalid/api/admin/posts',{method:'POST'});
  assert.equal(result.status,503);
  assert.equal(events.length,start+1);
  assert.equal(events.at(-1).type,'blocked-fetch');
});
