import {describe,it,expect} from 'vitest';
import {eventHasNotStarted} from '@/lib/ingestion/event-start';
import {publicationIssue} from '@/lib/ingestion/publication';
import {normalizedAlertEmail,changedFields} from '@/lib/alerts/monitoring';
import type{OfficialSource,OpportunityCandidate}from'@/lib/ingestion/types';
const source={id:'event',active:true,allowedDomains:['event.example'],allowedPathPrefixes:['/']} as OfficialSource;
const proof={source_url:'https://event.example/edition',excerpt:'Inscrições abertas. Evento em 21/10/2026 às 09h.'};
const item:OpportunityCandidate={officialSourceId:'event',title:'Evento',institution:'Organizador',applicantType:'mixed',benefitType:'other',requirementsText:'Público amplo',amountText:'Gratuito',stateCode:null,cityName:null,reviewStatus:'approved',extractionMethod:'html',contentHash:'test',sourcePageUrl:proof.source_url,categories:['eventos'],opportunityStatus:'open',deadlinePrecision:'not_informed',eventStartsAt:'2026-10-21T09:00:00-03:00',applicationRoute:'direct_application',evidenceJson:{event_start:proof,registration_availability:proof,opportunity_status:proof}};
describe('eventos sem prazo e avisos',()=>{
 it('retira no instante e, sem horário, no começo do dia em Brasília',()=>{
  expect(eventHasNotStarted(item.eventStartsAt,new Date('2026-10-21T11:59:59Z'))).toBe(true);
  expect(eventHasNotStarted(item.eventStartsAt,new Date('2026-10-21T12:00:00Z'))).toBe(false);
  expect(eventHasNotStarted('2026-10-21',new Date('2026-10-21T02:59:59Z'))).toBe(true);
  expect(eventHasNotStarted('2026-10-21',new Date('2026-10-21T03:00:00Z'))).toBe(false);
  expect(eventHasNotStarted('2026-02-30')).toBe(false);expect(eventHasNotStarted(null)).toBe(false);
 });
 it('exige evidência oficial de início e inscrição e rejeita fonte alheia',()=>{
  const now=new Date('2026-10-14T15:00:00Z');expect(publicationIssue(item,source,now)).toBeNull();
  expect(publicationIssue({...item,evidenceJson:{...item.evidenceJson,event_start:{...proof,source_url:'https://third-party.example/event'}}},source,now)).toBe('missing_evidence');
  expect(publicationIssue({...item,deadlineAt:'2026-10-20'},source,now)).toBe('invalid_deadline');
  expect(publicationIssue({...item,opportunityStatus:'upcoming'},source,now)).toBe('invalid_deadline');
 });
 it('normaliza email sem aceitar injeção ou listas de destinatários',()=>{
  expect(normalizedAlertEmail(' User@Example.com ')).toBe('user@example.com');
  expect(()=>normalizedAlertEmail('user@example.com\nBcc: x@example.com')).toThrow();
  expect(()=>normalizedAlertEmail('one@example.com,two@example.com')).toThrow();
 });
 it('compara apenas dados materiais',()=>{
  const before={title:'Evento',state:'open',officialUrl:'https://event.example'};
  expect(changedFields(before,{...before,checkedAt:'today'})).toEqual([]);
  expect(changedFields(before,{...before,state:'event_started'})).toEqual(['situação das inscrições ou do evento']);
 });
});

import {normalizeOpportunity} from '@/lib/ingestion/normalize-opportunity';
import {eventStartFromText} from '@/lib/ingestion/event-start';
it('extrai um evento sem prazo somente de fonte auditada para eventos e início explícito',()=>{
 const eventSource:OfficialSource={...source,name:'Organizador',institutionName:'Organizador',institutionAcronym:'ORG',sourceType:'official_reference',baseUrl:'https://event.example/',listingUrls:[],extractionMode:'html',audienceScope:['mixed'],geographicScope:[],categories:['eventos'],priority:1};
 const input={title:'Encontro de empreendedorismo',url:proof.source_url,source:eventSource,text:'Inscrições abertas pelo formulário de inscrição. O evento acontece em 21/10/2026 às 09h30. Participação gratuita.'};
 expect(normalizeOpportunity(input)).toMatchObject({deadlinePrecision:'not_informed',eventStartsAt:'2026-10-21T09:30:00-03:00',categories:['eventos'],opportunityStatus:'open'});
 expect(normalizeOpportunity({...input,source:{...eventSource,categories:['formacao']}})).toBeNull();
 expect(normalizeOpportunity({...input,text:input.text+' Inscrições até 31/02/2026.'})).toBeNull();
 expect(normalizeOpportunity({...input,text:'Inscrições abertas pelo formulário de inscrição. Publicado em 21/10/2026.'})).toBeNull();
 expect(eventStartFromText('Data do evento: 21/10/2026. Início do evento: 22/10/2026.')).toBeNull();
});
