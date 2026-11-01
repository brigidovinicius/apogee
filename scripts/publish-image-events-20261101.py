#!/usr/bin/env python3
"""Bounded, authorized editorial batch; run on apogee-vps, without exposing credentials."""
import argparse
import json
import re
from pathlib import Path
import subprocess

root = Path(__file__).resolve().parents[1]
batch = json.loads((root / 'research/tech-business-events-20261101/publication-batch.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--apply', action='store_true')
parser.add_argument('--site-sha', help='Exact reviewed site revision, already deployed with the prize-nature guard')
args = parser.parse_args()
assert len(batch['items']) == 11
assert len({x['source']['id'] for x in batch['items']}) == 11
assert all(x['source']['id'].startswith('images-') for x in batch['items'])
assert all(x['opportunity']['deadlineAt'] is None and x['opportunity']['deadlinePrecision'] == 'not_informed' for x in batch['items'])
if args.apply:
    assert re.fullmatch(r'[a-f0-9]{40}', args.site_sha or ''), 'Informe o SHA exato do site já publicado'
    backup = Path('/opt/apogee-backups/image-events-20261101')
    assert (backup / 'radar-before.dump').is_file(), 'Backup anterior obrigatório'
    subprocess.run(['sha256sum', '--status', '--check', str(backup / 'SHA256SUMS')], check=True)
    for container, expected in [('radar-academico-web-1', 'd2c80ade6811185c6758b6fc597a67b54c86896e'),
                                ('apogee-site-web-1', args.site_sha)]:
        revision = subprocess.check_output(['docker', 'inspect', container, '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}'], text=True).strip()
        assert revision == expected, 'Revisão de produção mudou; reaudite o lote antes de aplicar'

def run(container, code):
    prefix = 'const batch=' + json.dumps(batch, ensure_ascii=True) + ';const apply=' + str(args.apply).lower() + ';\n'
    result = subprocess.run(['docker', 'exec', '-i', container, 'node', '--input-type=module'],
                            input=prefix + code, text=True, capture_output=True)
    if result.returncode:
        # Drivers may include connection details in exceptions; return only the
        # bounded messages explicitly emitted by our script, never raw stderr.
        print(result.stdout)
        raise SystemExit('Lote interrompido. Confira o recibo; nenhum erro com credenciais foi impresso.')
    print(result.stdout)

run('radar-academico-web-1', r'''
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.DATABASE_EDITOR_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});
try {
 await c.connect(); await c.query(apply?'begin':'begin read only');
 const {rows}=await c.query(`select session_user=$1 and current_user=$1 and not(r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication or r.rolinherit) and r.rolcanlogin and not exists(select 1 from pg_auth_members where member=r.oid) as safe from pg_roles r where r.rolname=session_user`,['radar_editor']);
 if(rows[0]?.safe!==true)throw Error('Papel de runtime inesperado');
 await c.query('set local search_path=pg_catalog,public,pg_temp');
 await c.query('set local row_security=on');
 await c.query("select set_config('app.is_admin','true',true)");
 if(apply)await c.query("select pg_advisory_xact_lock(hashtextextended('image-events-20261101',0))");
 const plan=[];
 for(const entry of batch.items){
  const s=entry.source,o=entry.opportunity,u=new URL(s.url);
  if(u.protocol!=='https:'||u.username||u.password)throw Error('URL inválida');
  const prior=(await c.query('select id,base_url,active,verification_status,extraction_mode from official_sources where id=$1',[s.id])).rows[0];
  if(prior && (prior.base_url!==s.url||!prior.active||prior.verification_status!=='verified'||prior.extraction_mode!=='reference_only'))throw Error('Fonte existente exige revisão: '+s.id);
  const identities=(await c.query(`select distinct o.id,o.deleted_at,o.official_source_id from opportunities o left join opportunity_sources os on os.opportunity_id=o.id where lower(btrim(o.title))=lower(btrim($1)) or regexp_replace(os.source_page_url,'/+$','')=regexp_replace($2,'/+$','')`,[o.title,s.url])).rows;
  if(identities.some(x=>x.deleted_at||x.official_source_id!==s.id))throw Error('Identidade ou exclusão anterior encontrada: '+s.id);
  plan.push({source:s.id,sourceExists:!!prior,opportunityExists:identities.length>0});
  if(apply&&!prior)await c.query(`insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,state_code,city_name,categories,priority,active,verification_status,audit_evidence_url,audited_at,audited_by,notes) values($1,$2,$3,'','official_reference',$4,$5,$6,$7,'reference_only',array['mixed'],$8,$9,$10,$11,70,true,'verified',$4,now(),'authorized-image-events-20261101',$12)`,[s.id,s.name,s.institution,s.url,[u.hostname],[u.pathname],[s.url],[s.cityName??s.stateCode??'Brasil'],s.stateCode,s.cityName,s.categories,s.notes]);
 }
 await c.query(apply?'commit':'rollback');
 console.log(JSON.stringify({phase:'sources',apply,plan}));
}catch(e){await c.query('rollback').catch(()=>{});console.log(JSON.stringify({phase:'sources',error:e.message?.startsWith('Identidade')||e.message?.startsWith('Fonte existente')?e.message:'Validação de fontes falhou'}));process.exitCode=1;}finally{await c.end();}
''')

run('apogee-site-web-1', r'''
const u=new URL(process.env.RADAR_ACADEMICO_ADMIN_API_URL);u.pathname='/api/internal/editorial/opportunities';
const headers={Authorization:`Bearer ${process.env.RADAR_ACADEMICO_ADMIN_API_TOKEN}`,Accept:'application/json','Content-Type':'application/json'};
async function request(method,body){const r=await fetch(u,{method,headers,...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error(`API ${method}: HTTP ${r.status}`);return await r.json();}
try{
 const existing=(await request('GET')).opportunities;
 const results=[];
 for(const entry of batch.items){
  const o=entry.opportunity,prior=existing.find(x=>x.officialSourceId===o.officialSourceId&&x.title===o.title&&x.officialUrl===o.officialUrl);
  if(prior){results.push({key:entry.id,id:prior.id,action:'preserved'});continue;}
  if(!apply){results.push({key:entry.id,action:'planned'});continue;}
  const saved=await request('POST',o);results.push({key:entry.id,id:saved.id,action:'created'});
  console.log(JSON.stringify({phase:'opportunity',...results.at(-1)}));
 }
 const after=(await request('GET')).opportunities;
 if(apply&&batch.items.some(e=>!after.some(o=>o.officialSourceId===e.source.id)))throw Error('Ficha ausente após gravação');
 console.log(JSON.stringify({phase:'catalogue',apply,results,visible:after.length}));
}catch(e){console.log(JSON.stringify({phase:'catalogue',error:e.message}));process.exitCode=1;}
''')

# Preserve every existing field and evidence entry. Only these three reviewed
# editorial deltas change, with the same source-first locking and version guard
# used by catalogue-management. No broad source update or reactivation occurs.
run('radar-academico-web-1', r'''
import pg from 'pg';
const c=new pg.Client({connectionString:process.env.DATABASE_EDITOR_URL,ssl:process.env.DATABASE_SSL==='true'?{rejectUnauthorized:true}:undefined});
const targets=[{id:'1be77ed9-9e2c-4732-ab7c-529d9a1c5ac7',source:'exp-luma-builders-2026',version:1,prize:true,areas:['tecnologia','ia','negocios']},{id:'2cdb99e7-0c16-4e6f-86f4-d1af4ee7cae4',source:'enap-innovation-week-2026',version:2,areas:['tecnologia','ia','dados']},{id:'d09f2cec-d79b-4b9a-a0f1-8c2efbb5359a',source:'recnplay-2026',version:2,areas:['tecnologia','negocios']}];
try{
 await c.connect();await c.query(apply?'begin':'begin read only');
 const who=(await c.query('select current_user')).rows[0].current_user;if(who!=='radar_editor')throw Error('Papel inesperado');
 await c.query('set local search_path=pg_catalog,public,pg_temp');await c.query('set local row_security=on');await c.query("select set_config('app.is_admin','true',true)");
 const results=[];
 for(const t of targets){
  if(apply)await c.query('select pg_advisory_xact_lock(hashtextextended($1,0))',[t.source]);
  const before=(await c.query('select * from opportunities where id=$1'+(apply?' for update':''),[t.id])).rows[0];
  if(!before||before.deleted_at||before.official_source_id!==t.source)throw Error('Ficha editorial mudou');
  if(t.prize&&!String(before.amount_text).includes('25 mil em prêmios'))throw Error('Premiação não confirmada no texto auditado');
  const discovery={...before.discovery,areas:[...new Set([...(before.discovery?.areas??[]),...t.areas])]};
  const benefit=t.prize?'prize':before.benefit_type;
  const changed=JSON.stringify(discovery)!==JSON.stringify(before.discovery)||benefit!==before.benefit_type;
  if(changed&&before.version!==t.version)throw Error('Versão editorial mudou desde a revisão');
  if(apply&&changed){
   const overrides={...(before.management_overrides??{}),discovery,...(t.prize?{benefitType:'prize'}:{})};
   const updated=await c.query('update opportunities set discovery=$1,benefit_type=$2,management_overrides=$3,version=version+1,updated_at=now() where id=$4 and version=$5 returning id',[discovery,benefit,overrides,t.id,before.version]);if(updated.rowCount!==1)throw Error('Versão mudou');
   await c.query(`insert into opportunity_management_events(opportunity_id,actor,action,previous_data,new_data) values($1,'codex:authorized-image-events-20261101','update',$2,$3)`,[t.id,before,{discovery,benefitType:benefit,reason:'Temas e premiação revisados em fontes oficiais; valor monetário não presumido.'}]);
  }
  results.push({id:t.id,changed,priorVersion:before.version});
 }
 await c.query(apply?'commit':'rollback');console.log(JSON.stringify({phase:'editorial-metadata',apply,results}));
}catch(e){await c.query('rollback').catch(()=>{});console.log(JSON.stringify({phase:'editorial-metadata',error:'Revisão dos metadados não aplicada'}));process.exitCode=1;}finally{await c.end();}
''')
