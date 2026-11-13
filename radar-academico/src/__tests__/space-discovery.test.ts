import { expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { discoveryDocument, sameDiscoveryScope } from '@/lib/discovery/documents';
import { singleOpportunityArticle, normalizeDiscoveredPage } from '@/lib/ingestion/discovered-page';
import { publicationIssue } from '@/lib/ingestion/publication';
import type { OfficialSource } from '@/lib/ingestion/types';
import { normalizeCommunityEdition } from '@/lib/ingestion/normalize-community-editions-20261020';

const root='https://www.gov.br/inpe/pt-br/assuntos/eventos';
const detail=root+'/curso-de-astronomia';
const source: OfficialSource={id:'auto-page-space-test',name:'Curso',institutionName:'INPE',institutionAcronym:'INPE',
  sourceType:'public_research_institution',baseUrl:detail,allowedDomains:['www.gov.br'],allowedPathPrefixes:[new URL(detail).pathname],
  listingUrls:[detail],extractionMode:'html',audienceScope:[],geographicScope:[],categories:['formacao','eventos'],priority:0,active:true};
const plone=(body:string,heading='Curso de Astronomia')=>`<header><h1>Portal gov.br</h1></header><div id="content"><h1 class="documentFirstHeading">${heading}</h1><div class="documentByLine">Publicado em 01/01/2099</div><div id="content-core">${body}</div></div>`;

it('reads only one Plone rich-text detail, without publication or related deadlines',()=>{
  const html=plone('<div id="parent-fieldname-text"><p>Inscrições abertas para o curso de astronomia até 10/11/2099 pelo formulário de inscrição.</p></div>')+
    '<aside><p>Outra chamada: inscrições até 31/12/2100.</p></aside>';
  const article=singleOpportunityArticle(html)!;
  expect(article.title).toBe('Curso de Astronomia');
  expect(article.text).not.toContain('2100');
  expect(article.text).not.toContain('Publicado');
  const candidate=normalizeDiscoveredPage(html,source)!;
  expect(candidate).toMatchObject({deadlineAt:'2099-11-10',opportunityStatus:'open',categories:['formacao']});
  expect(publicationIssue(candidate,source)).toBeNull();
});

it('rejects Plone folders and ambiguous or missing rich-text bodies',()=>{
  for(const body of ['<article class="tileItem"><h2>Bolsa A</h2></article><article class="tileItem"><h2>Bolsa B</h2></article>',
    '<div id="parent-fieldname-text">A</div><div id="parent-fieldname-text">B</div>','']){
    expect(singleOpportunityArticle(plone(body))).toBeNull();
  }
});

it('discovers content and pagination without government navigation, preserving agency boundaries',()=>{
  const html='<nav><a href="https://www.gov.br/aeb/edital">Edital de outra agência</a></nav>'+plone(
    `<a href="${detail}">Curso de Astronomia</a><a class="proximo" href="${root}?b_start:int=20">Próximo »</a>`,'Eventos')+
    '<footer><a href="https://www.gov.br/inpe/edital-antigo">Edital no rodapé</a></footer>';
  const parsed=discoveryDocument({body:Buffer.from(html),contentType:'text/html'},root,root);
  expect(parsed.links.map(l=>l.url)).toEqual([detail]);
  expect(parsed.pages).toEqual([root+'?b_start:int=20']);
  expect(sameDiscoveryScope(root,'https://www.gov.br/aeb/pt-br/assuntos/noticias')).toBe(false);
});

it('preserves navigation-based pagination on calendars outside the Plone template',()=>{
  const parsed=discoveryDocument({body:Buffer.from(`<main><a href="${detail}">Curso de Astronomia</a></main><nav><a rel="next" href="${root}?page=2">Próximo</a></nav>`),contentType:'text/html'},root,root);
  expect(parsed.pages).toContain(root+'?page=2');
});

// Read-only replay of operator-captured public pages; no network or database.
it.skipIf(!process.env.RADAR_SPACE_AUDIT_FOLDER)('replays official INPE/AEB pages and the changed SouJava programme',async()=>{
  const folder=process.env.RADAR_SPACE_AUDIT_FOLDER!;
  const results=[];
  for(const [file,url] of [
    ['inpe-eventos','https://www.gov.br/inpe/pt-br/assuntos/eventos'],
    ['inpe-abertos','https://www.gov.br/inpe/pt-br/assuntos/anuncio-de-oportunidades/abertos'],
    ['aeb-noticias','https://www.gov.br/aeb/pt-br/assuntos/noticias'],
  ]){
    const body=await readFile(`${folder}/${file}.html`);
    const parsed=discoveryDocument({body,contentType:'text/html'},url,url);
    expect(parsed.links.length).toBeGreaterThan(0);
    expect(parsed.links.some(link=>/^https:\/\/www\.gov\.br\/(?:mec|economia|mre)\//.test(link.url))).toBe(false);
    results.push({file,links:parsed.links.length,pages:parsed.pages.length});
  }
  const url='https://encontros.soujava.org.br/talks/novembro-2026/';
  const soujava={...source,id:'soujava-november-2026',baseUrl:url,listingUrls:[url],allowedDomains:['encontros.soujava.org.br'],allowedPathPrefixes:['/talks/novembro-2026/']};
  const [candidate]=normalizeCommunityEdition(await readFile(`${folder}/soujava.html`,'utf8'),'',soujava,new Date('2026-11-12T18:00:00Z'));
  expect(candidate).toMatchObject({opportunityStatus:'open',eventStartsAt:'2026-11-13'});
  expect(publicationIssue(candidate,soujava,new Date('2026-11-12T18:00:00Z'))).toBeNull();
  console.log(JSON.stringify({readOnly:true,results,soujava:{title:candidate.title,status:candidate.opportunityStatus}}));
});
