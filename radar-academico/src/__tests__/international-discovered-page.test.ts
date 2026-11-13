import { beforeEach, expect, it, vi } from 'vitest';
vi.mock('@/lib/ingestion/fetch-source', () => ({ fetchOfficialResource: vi.fn() }));
import { fetchOfficialResource } from '@/lib/ingestion/fetch-source';
import { prepareDiscoveredPage, internationalEligibilityNote, BRAZIL_ELIGIBILITY_TOPIC } from '@/lib/ingestion/international-discovered-page';
import { publicationIssue } from '@/lib/ingestion/publication';
import { isOfficialSourceUrl } from '@/lib/ingestion/validate-url';
import type { OfficialSource } from '@/lib/ingestion/types';

const source: OfficialSource = { id:'auto-page-international-test',name:'Hackathon',institutionName:'Official Organizer',institutionAcronym:'',sourceType:'official_reference',baseUrl:'https://official.example.org/hackathon',allowedDomains:['official.example.org'],allowedPathPrefixes:['/hackathon'],listingUrls:['https://official.example.org/hackathon'],extractionMode:'html',audienceScope:[],geographicScope:[],categories:['competicoes','eventos'],priority:0,active:true,notes:internationalEligibilityNote([BRAZIL_ELIGIBILITY_TOPIC]) };
const page = (text:string, links='') => `<main><h1>Hackathon de tecnologia</h1><p>${text}</p><p>Inscrições abertas até 31/12/2099 pelo formulário de inscrição.</p>${links}</main>`;
const rulesLink = '<a href="/hackathon/rules">Official rules</a>';
const resource = (body:string, contentType='text/html') => ({body:Buffer.from(body),contentType,hash:'a'.repeat(64),cached:false});
beforeEach(() => { vi.mocked(fetchOfficialResource).mockReset(); });

it.each([
  'The hackathon IS NOT open to: residents of Quebec, Brazil, Cuba and Iran.',
  'Specific countries/territories excluded: Belarus, Brazil, Crimea.',
  'Participants from Brazil may not participate.',
  'The competition excludes residents of Brazil.',
  'Open worldwide except Brazil.',
  'Brazilians cannot apply.',
  'Residentes no Brasil não podem participar.',
  'Estão excluídos os residentes no Brasil.',
])('never turns a worldwide banner into permission over an exclusion: %s', async text => {
  vi.mocked(fetchOfficialResource).mockResolvedValue(resource(`<main><h1>Rules</h1><p>${text}</p></main>`));
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.',rulesLink),source)).toEqual({reason:'eligibility_br_excluded'});
  expect(fetchOfficialResource).toHaveBeenCalledTimes(1);
});

it('reads exclusions beyond a long rules introduction', async () => {
  vi.mocked(fetchOfficialResource).mockResolvedValue(resource(`<main>Open to entrants from all countries. ${'Other competition details. '.repeat(1500)} Not open to residents of Brazil.</main>`));
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.', rulesLink), source))
    .toEqual({ reason: 'eligibility_br_excluded' });
});

it('reads the actual linked rules even if the event page advertises worldwide participation',async()=>{
  vi.mocked(fetchOfficialResource).mockResolvedValue(resource('<main><h1>Rules</h1><p>Open to entrants from all countries. Teams must include adults.</p></main>'));
  const result=await prepareDiscoveredPage(page('Open to developers worldwide.',rulesLink),source);
  expect(result).toHaveProperty('candidate');
  if(!('candidate'in result))throw Error('Expected an eligible candidate');
  expect(publicationIssue(result.candidate,source)).toBeNull();
  expect(result.candidate.evidenceJson.eligibility_br).toMatchObject({source_url:source.baseUrl,supporting_url:source.baseUrl+'/rules',supporting_sha256:'a'.repeat(64),excerpt:expect.stringContaining('all countries')});
  const rulesPolicy=vi.mocked(fetchOfficialResource).mock.calls[0][1];
  expect(isOfficialSourceUrl(source.baseUrl+'/rules',[rulesPolicy])).toBe(true);
  expect(isOfficialSourceUrl(source.baseUrl+'/rules/other',[rulesPolicy])).toBe(false);
  expect(isOfficialSourceUrl(source.baseUrl+'/rules',[source])).toBe(false);
});

it.each(['View the official rules and eligibility', 'Rules & Regulations', 'Terms and Conditions'])('checks linked restrictions under the label %s', async label => {
  vi.mocked(fetchOfficialResource).mockResolvedValue(resource('<main>Not open to residents of Brazil.</main>'));
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.', `<a href="/hackathon/rules">${label}</a>`), source))
    .toEqual({ reason: 'eligibility_br_excluded' });
  expect(fetchOfficialResource).toHaveBeenCalledTimes(1);
});

it.each([
  'Built for a global community.',
  'Only accepted applicants may take part.',
  'Open worldwide. Only residents of India may enter.',
  'Brazil is not excluded.',
])('retains missing or incomplete geographic eligibility: %s',async text=>{
  expect(await prepareDiscoveredPage(page(text),source)).toEqual({reason:'eligibility_br_unconfirmed'});
});

it('does not borrow worldwide eligibility from the footer',async()=>{
  expect(await prepareDiscoveredPage(page('Apply now.')+'<footer>Open to developers worldwide.</footer>',source)).toEqual({reason:'eligibility_br_unconfirmed'});
});

it.each([
  '<a href="https://other.example.org/rules">Rules</a>',
  '<a href="/unrelated/rules">Rules</a>',
  rulesLink+'<a href="/hackathon/rules-2">Rules</a>',
])('does not widen trusted host/path or guess between rules: %s',async links=>{
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.',links),source)).toEqual({reason:'eligibility_br_unconfirmed'});
  expect(fetchOfficialResource).not.toHaveBeenCalled();
});

it('reserves a rules page from the existing budget before making any request',async()=>{
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.',rulesLink),source,()=>false)).toEqual({reason:'processing_budget_exhausted'});
  expect(fetchOfficialResource).not.toHaveBeenCalled();
});

it('propagates network and robots failures instead of treating unavailable rules as permission',async()=>{
  vi.mocked(fetchOfficialResource).mockRejectedValue(new Error('robots disallowed'));
  await expect(prepareDiscoveredPage(page('Open to developers worldwide.',rulesLink),source)).rejects.toThrow('robots disallowed');
});

it('does not pretend an unsupported rule document was checked',async()=>{
  vi.mocked(fetchOfficialResource).mockResolvedValue(resource('PDF unavailable to this adapter','application/pdf'));
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.',rulesLink),source)).toEqual({reason:'eligibility_br_unconfirmed'});
});

it('withdraws eligibility on a later successful recheck that adds a Brazil exclusion',async()=>{
  vi.mocked(fetchOfficialResource).mockResolvedValueOnce(resource('<main>Open to entrants from all countries.</main>')).mockResolvedValueOnce(resource('<main>Not open to residents of Brazil.</main>'));
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.',rulesLink),source)).toHaveProperty('candidate');
  expect(await prepareDiscoveredPage(page('Open to developers worldwide.',rulesLink),source)).toEqual({reason:'eligibility_br_excluded'});
});

it('preserves the current national-source pipeline without adding requests',async()=>{
  expect(await prepareDiscoveredPage(page('Inscrições abertas.'),{...source,notes:''})).toHaveProperty('candidate');
  expect(fetchOfficialResource).not.toHaveBeenCalled();
});
