import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {articleReferenceParts,trustedArticleReference} from '../lib/blog/article-links.mjs';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const nasa='https://www.nasa.gov/science/';
test('numbered citations and literal URLs point directly to registered HTTPS sources, preserving all visible text',()=>{
 const text='A apuração [1] está em '+nasa+'. Veja também [2].',parts=articleReferenceParts(text,[{url:nasa}]);
 assert.equal(parts.map(p=>p.text).join(''),text);
 assert.deepEqual(parts.filter(p=>p.href).map(p=>p.href),[nasa,nasa]);
 assert.equal(parts.find(p=>p.text==='[2]').href,null);
 assert.equal(trustedArticleReference(nasa+'?utm_source=blog'),nasa);
 assert.ok(articleReferenceParts('HTTPS://www.nasa.gov/science/').some(p=>p.href===nasa));
 assert.equal(trustedArticleReference('https://docs.cloud.google.com/dns/docs/records-overview'),'https://docs.cloud.google.com/dns/docs/records-overview');
});
test('unknown hosts, lookalikes, credentials, local addresses, active protocols and redirect wrappers never become active references',()=>{
 for(const url of ['https://unknown.invalid/a','https://nasa.gov.evil.test/a','https://user:secret@www.nasa.gov/a','https://127.0.0.1/a','http://www.nasa.gov/a','javascript:alert(1)','https://www.nasa.gov/redirect?url=https://evil.test','https://www.nasa.gov/a?next=https%3A%2F%2Fevil.test','https://www.nasa.gov/a?target=%2F%2Fevil.test'])assert.equal(trustedArticleReference(url),null,url);
 assert.ok(articleReferenceParts('Uma fonte [1].',[{url:'https://unknown.invalid/a'}]).every(p=>!p.href));
 for(const url of ['https://www.nasa.gov/%72edirect?url=x','https://www.nasa.gov/a?next=https%253A%252F%252Fevil.test'])assert.equal(trustedArticleReference(url),null);
});
test('public and member rendering link inline references, credit URLs and source titles without executing markup or restoring the hidden AI caption',async()=>{
 const frame={'@/components/site/site-header':{SiteHeader:()=>null},'@/components/site/site-footer':{SiteFooter:()=>null},'@/components/site/share-button':{ShareButton:()=>null},'next/link':{__esModule:true,default:({children,href})=>React.createElement('a',{href},children)},'next/navigation':{notFound:()=>{throw Error('not-found');}}};
 const post={id:1,slug:'test',title:'Referência sintética',excerpt:'Apenas teste privado.',category:'tecnologia',body:'Texto <script>never()</script> [1].\n\nFontes:\n[1] NASA — '+nasa+' (2026-11-19)',coverMediaId:'00000000-0000-4000-8000-000000000001',authorName:'Redação Apogee',publishedAt:new Date(),updatedAt:new Date()};
 const load=opportunityLoader({...frame,'@/lib/blog/data':{getPublicPost:async()=>post,listPostMedia:async()=>[{id:'00000000-0000-4000-8000-000000000001',alt:'Capa de teste',caption:'Foto: NASA. '+nasa,width:1536,height:1024}]}});
 for(const member of [false,true]){
  const html=renderToStaticMarkup(await load('components/blog/blog-article.tsx').BlogArticle({params:Promise.resolve({slug:'test'}),member}));
  assert.ok(html.includes('href="'+nasa+'" target="_blank" rel="noopener noreferrer">[1]</a>'));
  assert.ok(html.includes('href="'+nasa+'" target="_blank" rel="noopener noreferrer">'+nasa+'</a>'));
  assert.ok(html.includes('&lt;script&gt;never()&lt;/script&gt;'));assert.equal(html.includes('<script>never'),false);
  assert.equal(html.includes('Imagem ilustrativa fotorrealista'),false);
 }
});
