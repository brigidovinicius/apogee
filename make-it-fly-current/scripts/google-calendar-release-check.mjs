// Read-only local preflight. No network, database connection, deploy or approval.
import {readFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {legalApprovals,legalDocumentVersions} from '../lib/legal-documents.mjs';

export const launchEvidenceGates=Object.freeze([
  'guardianReviewProcess','existingAccountsPlan','retentionAndProviders','supportDelivery',
  'googleBranding','googleAudienceProduction','googleDomainAndScopes','quotaAndPilotCapacity',
  'backupRestore','productionMigrations','workerHealth','alertReceiverDelivery','externalMonitor','publishedPilot',
]);
export function evaluateGoogleRelease({env={},evidence={},candidateSha='',checkoutClean=false,manifest=[]}={}) {
  const checks=[];
  const add=(id,ok,detail)=>checks.push({id,status:ok?'pass':'pending',detail});
  const enabled=name=>env[name]==='true';
  const approvals=legalApprovals(env);
  let origin=false;try{origin=new URL(env.BETTER_AUTH_URL).href==='https://www.apogee.community/';}catch{}
  const overrides=!!env.GOOGLE_CALENDAR_CLIENT_ID===!!env.GOOGLE_CALENDAR_CLIENT_SECRET;
  const pair=overrides&&!!(env.GOOGLE_CALENDAR_CLIENT_ID||env.GOOGLE_CLIENT_ID)&&!!(env.GOOGLE_CALENDAR_CLIENT_SECRET||env.GOOGLE_CLIENT_SECRET);
  add('candidate',/^[a-f0-9]{40}$/.test(candidateSha)&&checkoutClean,'Revisão Git exata e árvore local limpa; não comprova publicação.');
  add('localMigrations',['0008_radar_calendar','0009_google_calendar','0010_supervised_registration','0011_google_calendar_retries','0012_google_calendar_observability'].every(tag=>manifest.some(m=>m.tag===tag&&/^[a-f0-9]{64}$/.test(m.sha256))),
    'Arquivos locais inventariados; aplicação no banco real é evidência separada.');
  add('httpsOrigin',origin,'Origem HTTPS de produção esperada, sem caminho ou parâmetros.');
  add('supervisedRegistration',enabled('MEMBERS_SUPERVISED_REGISTRATION_ENABLED'),'Proteção de conta ativa na configuração pretendida.');
  add('privacyVersion',approvals.privacy,'Aprovação editorial da versão exata de privacidade.');
  add('termsVersion',approvals.terms,'Aprovação editorial da versão exata dos termos.');
  add('calendarFlags',enabled('RADAR_CALENDAR_PERSONAL_ENABLED')&&enabled('RADAR_GOOGLE_CALENDAR_ENABLED'),'Calendário e integração habilitados na configuração pretendida.');
  add('oauthPairPresence',pair,'Presença consistente do par OAuth; não valida a credencial com o Google.');
  add('encryptionKeyFormat',/^[a-f0-9]{64}$/i.test(env.GOOGLE_CALENDAR_ENCRYPTION_KEY??''),'Formato da chave de criptografia; não comprova restauração/decriptação.');
  add('syncSecretLength',(env.GOOGLE_CALENDAR_SYNC_SECRET??'').length>=32,'Comprimento mínimo do segredo interno.');
  add('readOnlyMonitorSecret',(env.GOOGLE_CALENDAR_MONITOR_SECRET??'').length>=32&&env.GOOGLE_CALENDAR_MONITOR_SECRET!==env.GOOGLE_CALENDAR_SYNC_SECRET,'Credencial do monitor distinta da credencial de escrita.');
  add('emailConfiguration',enabled('MEMBERS_EMAIL_ENABLED')&&enabled('MEMBERS_RESEND_DOMAIN_VERIFIED')&&/^re_[A-Za-z0-9_-]{10,}$/.test(env.MEMBERS_RESEND_API_KEY??'')&&env.MEMBERS_RESEND_FROM==='contato@apogee.community',
    'Configuração do remetente; entrega e atendimento exigem evidência própria.');
  let webhook=false;try{const url=new URL(env.GOOGLE_CALENDAR_MONITOR_ALERT_WEBHOOK_URL||env.GOOGLE_CALENDAR_ALERT_WEBHOOK_URL);webhook=url.protocol==='https:'&&!url.username&&!url.password&&!url.hash;}catch{}
  add('alertDestination',webhook,'Destino HTTPS configurado; não envia alertas nem valida o receptor.');
  const integer=(name,fallback,max)=>{const value=Number(env[name]??fallback);return Number.isInteger(value)&&value>=1&&value<=max;};
  add('queueLimits',integer('GOOGLE_CALENDAR_SYNC_BATCH_SIZE',3,20)&&integer('GOOGLE_CALENDAR_SYNC_BUDGET_SECONDS',90,120)&&integer('GOOGLE_CALENDAR_SYNC_MAX_LAG_SECONDS',900,86400),
    'Limites técnicos da fila; não representam capacidade de usuários medida.');
  add('retryLimits',integer('GOOGLE_CALENDAR_RETRY_BASE_SECONDS',60,3600)&&integer('GOOGLE_CALENDAR_RETRY_MAX_SECONDS',3600,86400)&&integer('GOOGLE_CALENDAR_RETRY_MAX_ATTEMPTS',8,30)&&Number(env.GOOGLE_CALENDAR_RETRY_MAX_SECONDS??3600)>=Number(env.GOOGLE_CALENDAR_RETRY_BASE_SECONDS??60),
    'Configuração de espera e limite de tentativas.');
  const candidateMatches=evidence.candidateSha===candidateSha&&/^[a-f0-9]{40}$/.test(candidateSha);
  const evidenceChecks=launchEvidenceGates.map(id=>{
    const item=evidence.gates?.[id];
    const dated=typeof item?.checkedAt==='string'&&Number.isFinite(Date.parse(item.checkedAt))&&Date.parse(item.checkedAt)<=Date.now();
    const recorded=candidateMatches&&item?.status==='recorded'&&typeof item.reference==='string'&&item.reference.trim().length>=8&&dated;
    return {id,status:recorded?'recorded':'pending'};
  });
  const configurationReady=checks.every(c=>c.status==='pass'),evidenceComplete=evidenceChecks.every(c=>c.status==='recorded');
  return {mode:'local-read-only',candidateSha,configurationReady,evidenceComplete,readyForHumanReview:configurationReady&&evidenceComplete,
    releaseAuthorized:false,notice:'Referências declaradas não foram verificadas automaticamente. Este relatório não autoriza publicação ou migração.',
    documentVersions:legalDocumentVersions,checks,evidenceChecks,manifest};
}
async function main() {
  if(process.argv.includes('--help')){console.log('Uso: node scripts/google-calendar-release-check.mjs [--evidence arquivo.json]\nSomente leitura local. Não conecta à produção, não imprime valores de configuração e não autoriza deploy.');return;}
  const args=process.argv.slice(2);if(args.length&&!(args.length===2&&args[0]==='--evidence'))throw Error('Invalid arguments');
  const app=new URL('../',import.meta.url),repo=new URL('../../',import.meta.url);
  const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:fileURLToPath(repo),encoding:'utf8'}).trim();
  const clean=!execFileSync('git',['status','--porcelain'],{cwd:fileURLToPath(repo),encoding:'utf8'}).trim();
  const journal=JSON.parse(await readFile(new URL('drizzle/meta/_journal.json',app),'utf8'));
  const manifest=[];
  for(const entry of journal.entries){
    if(!/^\d{4}_[a-z0-9_]+$/.test(entry.tag))throw Error('Invalid migration tag');
    manifest.push({tag:entry.tag,sha256:createHash('sha256').update(await readFile(new URL('drizzle/'+entry.tag+'.sql',app))).digest('hex')});
  }
  let evidence={};
  if(args.length){if((await stat(args[1])).size>131072)throw Error('Evidence too large');const text=await readFile(args[1],'utf8');evidence=JSON.parse(text);if(!evidence||typeof evidence!=='object')throw Error('Invalid evidence');}
  const report=evaluateGoogleRelease({env:process.env,evidence,candidateSha:sha,checkoutClean:clean,manifest});
  console.log(JSON.stringify(report,null,2));process.exitCode=report.readyForHumanReview?0:2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href) {
  main().catch(()=>{console.log(JSON.stringify({mode:'local-read-only',readyForHumanReview:false,releaseAuthorized:false,error:'Não foi possível avaliar os arquivos ou argumentos locais.'}));process.exitCode=2;});
}
