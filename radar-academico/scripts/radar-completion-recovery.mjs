import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
const root=new URL('../',import.meta.url);
export async function recoveryPackage() {
  const files=['references/radar-completion-20261101/access-candidates.json','references/radar-completion-20261101/recovery-targets.json',
    'scripts/radar-completion-recovery.mjs','src/__tests__/completion-source-audit.test.ts','src/lib/ingestion/fetch-source.ts',
    'src/lib/ingestion/safe-request.ts','src/lib/ingestion/validate-url.ts','src/lib/ingestion/structured-events.ts'];
  const data=await Promise.all(files.map(name=>readFile(new URL(name,root),'utf8')));
  return {manifestHash:createHash('sha256').update(data.join('\n')).digest('hex'),targets:JSON.parse(data[1])};
}
/** A pending state must still exactly match the original package before recovery. */
export async function installRecoveryPackage(client,pkg,audit,now=new Date()) {
  if(audit.complete!==true||audit.manifestHash!==pkg.manifestHash||!Array.isArray(audit.results)||
    !Number.isFinite(Date.parse(audit.checkedAt))||Date.parse(audit.checkedAt)>+now+60000||+now-Date.parse(audit.checkedAt)>86400000)throw Error('Auditoria ausente, divergente ou vencida');
  let activated=0,preserved=0;
  for(const target of pkg.targets) {
    if(!audit.results.some(row=>row.id===target.id&&row.url===target.url&&row.outcome==='checked'))throw Error('Auditoria não confirma o alvo de recuperação');
    const result=await client.query(`update discovery_targets set official_url=$6,organizer=$7,evidence_url=$6,enabled=true,
      official_verified_at=$8::timestamptz,official_verified_url=$6,official_verified_by='codex:operator-authorized-agent',
      official_review_note=$9,notes=notes || E'\nRecuperação 01/11/2026: ' || $9,
      next_check_at=null,last_status='not_checked',updated_at=now()
      where id=$1 and official_url=$2 and organizer=$3 and notes=$4 and official_review_note=$5
        and not enabled and official_verified_at is null returning id`,
      [target.id,target.expectedOriginalUrl,target.expectedOrganizer,target.expectedNotes,target.expectedReviewNote,
        target.url,target.organizer,audit.checkedAt,target.reviewNote]);
    if(result.rows.length) {
      activated++;
      await client.query(`insert into ingestion_runs(started_at,finished_at,status,execution_metadata)
        values(now(),now(),'skipped',$1::jsonb)`,[JSON.stringify({component:'discovery-recovery',target_id:target.id,manifest_hash:pkg.manifestHash})]);
    } else preserved++;
  }
  return {activated,preserved};
}
async function main() {
  const pkg=await recoveryPackage();
  if(!process.argv.includes('--apply')) {console.log(JSON.stringify({mode:'plan_only',manifestHash:pkg.manifestHash,targets:pkg.targets.map(t=>({id:t.id,url:t.url}))}));return;}
  const auditPath=process.argv.find(v=>v.startsWith('--audit='))?.slice(8);
  if(!auditPath||!process.env.DATABASE_EDITOR_URL)throw Error('Auditoria e conexão de editor necessárias');
  const audit=JSON.parse(await readFile(auditPath,'utf8'));
  const {Client}=await import('pg');
  const client=new Client({connectionString:process.env.DATABASE_EDITOR_URL});
  try {
    await client.connect();await client.query('begin');await client.query("select set_config('app.is_admin','true',true)");
    const result=await installRecoveryPackage(client,pkg,audit);
    await client.query('commit');console.log(JSON.stringify(result));
  } catch(error){await client.query('rollback').catch(()=>{});throw error;}finally{await client.end();}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)main().catch(()=>{console.error('Recuperação não aplicada. Confira auditoria e estado atual; nenhum segredo foi exibido.');process.exitCode=1;});
