import { describe, expect, it } from 'vitest';
import { calendarDate, classifyDiscovery, parseDiscovery } from '@/lib/ingestion/discovery';
import type { OfficialSource } from '@/lib/ingestion/types';

const source = { active:true, allowedDomains:['example.edu.br'], allowedPathPrefixes:['/edital'], baseUrl:'https://example.edu.br/edital' } as OfficialSource;
const stage = {id:'exam',name:'Prova',kind:'exam',start:'2099-11-01',sourceUrl:'https://example.edu.br/edital/2026',checkedAt:'2026-10-28T12:00:00Z'};
const discovery = {primaryType:'competicoes',subtype:'olimpiada',areas:['matematica'],editions:[{id:'2026',name:'2026',stages:[stage]}]};
const withStage = (patch:Record<string,unknown>) => ({...discovery,editions:[{...discovery.editions[0],stages:[{...stage,...patch}]}]});

describe('verified classification and stage boundary',()=>{
  it('preserves distinct type, subtype, areas and all five stage kinds',()=>{
    const input={...discovery,areas:['matematica','matematica','fisica'],editions:[{...discovery.editions[0],stages:['registration','exam','result','enrollment','event'].map(kind=>({...stage,id:kind,kind}))}]};
    const result=parseDiscovery(input,source);
    expect(result).toMatchObject({primaryType:'competicoes',subtype:'olimpiada',areas:['matematica','fisica']});
    expect(result.editions[0].stages).toHaveLength(5);
    expect(parseDiscovery({areas:[],editions:[]},source)).toEqual({areas:[],editions:[]});
  });
  it.each(['2099-02-30','2099-13-01','2099-01-01T12:00:00','not-a-date'])('rejects invalid or timezone-free date %s',value=>{
    expect(()=>calendarDate(value)).toThrow();
  });
  it('accepts leap days and exact timezone-qualified intervals',()=>{
    expect(calendarDate('2028-02-29')).toBe('2028-02-29');
    expect(parseDiscovery(withStage({start:'2099-11-01T13:00:00-03:00',end:'2099-11-01T18:00:00Z'}),source).editions[0].stages[0].end).toBe('2099-11-01T18:00:00Z');
  });
  it.each([{end:'2099-10-31'},{end:'2099-11-01T12:00:00Z'},{sourceUrl:'https://example.edu.br.evil.test/edital'},{sourceUrl:'https://example.edu.br/unreviewed'},{sourceUrl:'javascript:alert(1)'},{checkedAt:'2099-01-01T00:00:00Z'},{checkedAt:'2026-10-28'},{kind:'unknown'},{id:'exam:collision'},{name:''}])('rejects invalid stage %j',patch=>{
    expect(()=>parseDiscovery(withStage(patch),source)).toThrow();
  });
  it('rejects repeated identifiers and oversized editions or stage lists',()=>{
    for(const input of [
      {...discovery,editions:[discovery.editions[0],discovery.editions[0]]},
      {...discovery,editions:[{...discovery.editions[0],stages:[stage,stage]}]},
      {...discovery,editions:Array.from({length:11},(_,i)=>({...discovery.editions[0],id:String(i)}))},
      {...discovery,editions:[{...discovery.editions[0],stages:Array.from({length:31},(_,i)=>({...stage,id:String(i)}))}]},
      {...discovery,primaryType:'unknown'}, {...discovery,subtype:'unknown'}, {...discovery,areas:['unknown']},
    ])expect(()=>parseDiscovery(input,source)).toThrow();
  });
  it('classifies conservative title evidence without inventing eligibility or dates',()=>{
    expect(classifyDiscovery('Olimpíada de Matemática',['competicoes'])).toEqual({primaryType:'competicoes',subtype:'olimpiada',areas:['matematica'],editions:[]});
    expect(classifyDiscovery('Hackathon de robótica',['competicoes'])).toMatchObject({subtype:'hackathon',areas:['robotica']});
    expect(classifyDiscovery('Olimpíada de Matemática',['formacao']).subtype).toBeUndefined();
    expect(classifyDiscovery('Programa para estudantes')).toEqual({areas:[],editions:[]});
  });
});
