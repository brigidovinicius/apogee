// Local-only acceptance harness. Real authentication/actions, synthetic catalogue.
import assert from 'node:assert/strict';
import { readFile, readdir, writeFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer, request } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { hashPassword } from 'better-auth/crypto';
import { previewHeaders } from '../lib/navigation/local-preview.mjs';
const app = new URL('../', import.meta.url);
const state = new URL('../../.local/radar-calendar/', import.meta.url);
const config = JSON.parse(await readFile(new URL('config.json', state), 'utf8'));
const dbUrl = new URL(config.DATABASE_URL);
assert.equal(dbUrl.protocol, 'postgresql:');
assert.equal(dbUrl.hostname, '127.0.0.1');
assert.equal(dbUrl.port, '48763');
assert.equal(dbUrl.pathname, '/apogee_radar_calendar_local');
assert.equal(dbUrl.username, 'radar_calendar_local');
// Next loads .env itself: refuse files that might contain unrelated credentials.
assert.deepEqual((await readdir(app)).filter(n => /^\.env(?:$|\.)/.test(n) && n !== '.env.example'), []);
const mode = process.argv[2];
assert.ok(['setup', 'serve', 'status', 'grant', 'revoke'].includes(mode), 'Use setup, serve, status, grant or revoke');
const sql = postgres(dbUrl.href, { ssl:false, max:2, prepare:false, onnotice:()=>{} });
const identity = (await sql`select current_database() as db, current_user as role, inet_server_addr()::text as host, inet_server_port() as port`)[0];
assert.equal(identity.db,'apogee_radar_calendar_local');
assert.equal(identity.role,'radar_calendar_local');
assert.match(identity.host,/^127\.0\.0\.1(?:\/32)?$/);
assert.equal(identity.port,48763);
const marker = 'apogee-radar-calendar-local-v1';
const accounts = [{key:'vitalicio',name:'Teste Vitalício',access:true},{key:'gratuito',name:'Teste Gratuito',access:false},{key:'revogado',name:'Teste Revogado',access:false}];
function fixtures() {
  const date = days => new Date(Date.now()+days*86400000).toISOString().slice(0,10);
  const checked = new Date(Date.now()-60000).toISOString();
  const base = {institution:'Demonstração local — dados fictícios',benefitType:'other',applicantType:'high_school_student',categories:['competicoes'],officialUrl:'https://example.invalid/radar/edital-teste',lastCheckedAt:checked,requirementsText:'Requisito de demonstração: estudante. Sem inscrição real.',amountText:'Participação gratuita',deadlineAt:date(7),deadlinePrecision:'date_only',opportunityStatus:'open',nationallyEligible:true};
  const stage = (id,name,kind,start,end) => ({id,name,kind,start,...(end?{end}:{}),sourceUrl:base.officialUrl,checkedAt:checked});
  return [
    {...base,id:'demo-olimpiada',title:'Olimpíada de Matemática — Demonstração local',discovery:{primaryType:'competicoes',subtype:'olimpiada',areas:['matematica'],editions:[{id:'demo',name:'Edição de teste',stages:[stage('inscricoes','Inscrições','registration',date(-7),date(7)),stage('prova','Prova','exam',date(17)),stage('resultado','Resultado','result',date(40))]}]}},
    {...base,id:'demo-hackathon',title:'Hackathon — Demonstração local',deadlineAt:date(9),discovery:{primaryType:'competicoes',subtype:'hackathon',areas:['tecnologia'],editions:[{id:'demo',name:'Edição de teste',stages:[stage('inscricoes','Inscrições','registration',date(-2),date(9)),stage('evento','Encontro de equipes','event',date(20))]}]}},
    {...base,id:'demo-vestibular',title:'Vestibular — Demonstração local',categories:['formacao'],opportunityStatus:'closed',deadlineAt:null,deadlinePrecision:'not_informed',discovery:{primaryType:'formacao',subtype:'vestibular',areas:[],editions:[{id:'demo',name:'Edição de teste',stages:[stage('prova','Segunda fase','exam',date(24)+'T13:00:00-03:00',date(24)+'T18:00:00-03:00'),stage('chamada','Primeira chamada','result',date(50))]}]}},
  ];
}
async function verifyMarker() {assert.equal((await sql`select marker from radar_local_environment`)[0]?.marker,marker);}
if(mode==='setup') {
  try {
    if(!(await sql`select to_regclass('public.radar_local_environment') as name`)[0].name) {
      assert.equal((await sql`select count(*)::int as n from pg_tables where schemaname='public'`)[0].n,0,'Refuse an unrelated populated database');
      await sql`create table radar_local_environment (marker text primary key)`;
      await sql`insert into radar_local_environment values (${marker})`;
      await sql`create table radar_local_migrations (tag text primary key,checksum text not null)`;
    }
    await verifyMarker();
    const journal=JSON.parse(await readFile(new URL('drizzle/meta/_journal.json',app),'utf8'));
    for(const entry of journal.entries) {
      const body=await readFile(new URL(`drizzle/${entry.tag}.sql`,app),'utf8');
      const checksum=createHash('sha256').update(body).digest('hex');
      const [prior]=await sql`select checksum from radar_local_migrations where tag=${entry.tag}`;
      if(prior){assert.equal(prior.checksum,checksum,'Applied local migration changed');continue;}
      await sql.begin(async tx=>{await tx.unsafe(body);await tx`insert into radar_local_migrations values (${entry.tag},${checksum})`;});
    }
    for(const account of accounts) {
      const id=`radar-local-${account.key}`;
      const password=await hashPassword(config.LOCAL_TEST_PASSWORD);
      const inserted=await sql`insert into "user" (id,name,email,email_verified,username,role) values (${id},${account.name},${account.key+'@radar.test'},true,${'local_'+account.key},'member') on conflict (id) do nothing returning id`;
      if(inserted.length){
        await sql`insert into account (id,account_id,provider_id,user_id,password) values (${id+'-credential'},${id},'credential',${id},${password})`;
        if(account.access)await sql`insert into radar_legacy_access (user_id) values (${id})`;
      }
    }
    await sql`create table if not exists radar_local_catalogue (id text primary key,payload jsonb not null)`;
    for(const item of fixtures())await sql`insert into radar_local_catalogue values (${item.id},${sql.json(item)}) on conflict (id) do nothing`;
    await writeFile(new URL('CONTAS-DE-TESTE.md',state),`# Teste local do Radar\n\nhttp://127.0.0.1:4381/membros/entrar?next=%2Fmembros%2Foportunidades\n\nSenha local: ${config.LOCAL_TEST_PASSWORD}\n\n${accounts.map(a=>'- '+a.key+'@radar.test — '+(a.access?'acesso vitalício de teste':'sem acesso vitalício')).join('\n')}\n\nUse e-mail e senha. O login Google, e-mail e pagamentos estão desabilitados. A conexão Google Agenda é separada e só é ativada com a configuração privada de teste.\n\nAbra uma oportunidade, salve, entre em Meu calendário e gere o link privado. O .ics pode ser assinado por aplicativo neste Mac. Google Agenda/Outlook na nuvem não conseguem consultar 127.0.0.1; nenhum túnel público foi criado.\n`,{mode:0o600});
    console.log('Migrações locais verificadas; contas e oportunidades de teste preservadas.');
  } finally {await sql.end();}
} else if(mode!=='serve') {
  try {
    await verifyMarker();
    if(mode==='grant'||mode==='revoke') {
      const key=process.argv[3];assert.ok(accounts.some(a=>a.key===key),'Use an explicit local account');
      const id=`radar-local-${key}`;
      if(mode==='grant')await sql`insert into radar_legacy_access (user_id) values (${id}) on conflict do nothing`;
      else await sql`delete from radar_legacy_access where user_id=${id}`;
      console.log(`Acesso local ${mode==='grant'?'concedido':'revogado'}: ${key}`);
    } else console.log(JSON.stringify({database:identity.db,migrations:(await sql`select count(*)::int as n from radar_local_migrations`)[0].n,accounts:await sql`select u.email,exists(select 1 from radar_legacy_access a where a.user_id=u.id) as lifetime from "user" u order by email`,saved:(await sql`select count(*)::int as n from radar_saved_opportunity where removed_at is null`)[0].n}));
  } finally {await sql.end();}
} else {
  await verifyMarker();
  assert.ok((await sql`select tag from radar_local_migrations where tag='0008_radar_calendar'`).length);
  assert.ok((await sql`select tag from radar_local_migrations where tag='0010_supervised_registration'`).length,'Run local setup before supervised preview');
  // These four fixed fictional identities are QA fixtures, never a real age check.
  await sql`update "user" set adult_declared=true where id in ('radar-local-vitalicio','radar-local-gratuito','radar-local-revogado','radar-local-admin') and email=replace(id,'radar-local-','')||'@radar.test'`;
  await sql`insert into member_adult_review(user_id,status,reviewed_at,evidence_reference)
    select id,'approved',now(),'DADO FICTICIO: aprovacao apenas para testes locais'
    from "user" where id in ('radar-local-vitalicio','radar-local-gratuito','radar-local-revogado','radar-local-admin') and email=replace(id,'radar-local-','')||'@radar.test'
    on conflict(user_id) do nothing`;
  const editorial=process.argv[3]==='--editorial' ? JSON.parse(await readFile(new URL('editorial-config.json',state),'utf8')) : null;
  let google = null;
  try {
    const file = new URL('google-calendar.json',state);
    const info = await stat(file); assert.equal(info.mode & 0o077,0,'Google test config must be private (0600)');
    google = JSON.parse(await readFile(file,'utf8'));
    assert.equal(google.marker,'apogee-google-calendar-local-v1');
    assert.equal(google.GOOGLE_CALENDAR_CLIENT_ID,'914658639835-earocvt248dibbrmp00cmfamh2qcs6qa.apps.googleusercontent.com','Only the verified Apogee Local client is allowed');
    assert.match(google.GOOGLE_CALENDAR_ENCRYPTION_KEY,/^[a-f0-9]{64}$/i);
    assert.ok(google.GOOGLE_CALENDAR_CLIENT_SECRET && google.GOOGLE_CALENDAR_SYNC_SECRET.length >= 32);
  } catch(error) { if(error.code!=='ENOENT')throw error; }
  const runtimeEnv=Object.fromEntries(['PATH','TMPDIR','LANG','HOME','CODEX_NPM_QUEUE_OWNER'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
  let radarChild;
  if(editorial) {
    assert.equal(editorial.marker,'apogee-radar-editorial-local-v1');
    for(const key of ['DATABASE_READER_URL','DATABASE_EDITOR_URL']) {
      const url=new URL(editorial[key]);
      assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'48763');assert.equal(url.pathname,'/radar_calendar_editorial_local');
      assert.equal(url.username,key==='DATABASE_READER_URL'?'radar_reader':'radar_editor');
    }
    const radar=new URL('../../radar-academico/',import.meta.url);
    assert.deepEqual((await readdir(radar)).filter(n=>/^\.env(?:$|\.)/.test(n)&&n!=='.env.example'),[]);
    radarChild=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{
      cwd:fileURLToPath(radar),stdio:'inherit',env:{...runtimeEnv,NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=512',NEXT_TELEMETRY_DISABLED:'1',
        DATABASE_READER_URL:editorial.DATABASE_READER_URL,DATABASE_EDITOR_URL:editorial.DATABASE_EDITOR_URL,DATABASE_POOL_MAX:'2',DATABASE_SSL:'false',
        RADAR_ACADEMICO_API_TOKEN:editorial.PUBLIC_API_TOKEN,RADAR_ACADEMICO_ADMIN_API_TOKEN:editorial.ADMIN_API_TOKEN},
    });
  }
  const catalogue=createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1:48762');
    if(url.pathname!=='/catalogue'||req.headers.authorization!==`Bearer ${config.RADAR_ACADEMICO_API_TOKEN}`){res.writeHead(404).end();return;}
    try{
      const rows=await sql`select payload from radar_local_catalogue order by id`;
      const items=rows.map(r=>r.payload).filter(i=>url.searchParams.get('view')==='calendar'||['open','upcoming'].includes(i.opportunityStatus));
      if(editorial) {
        const endpoint=new URL('http://127.0.0.1:3000/api/public/opportunities');
        if(url.searchParams.get('view')==='calendar')endpoint.searchParams.set('view','calendar');
        const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${editorial.PUBLIC_API_TOKEN}`},signal:AbortSignal.timeout(5000)});
        assert.equal(response.status,200);const body=await response.json();assert.equal(body.version,3);assert.ok(Array.isArray(body.opportunities));
        items.push(...body.opportunities);
      }
      res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'}).end(JSON.stringify({version:3,opportunities:items}));
    }catch{res.writeHead(503).end();}
  });
  const proxy=createServer((req,res)=>{
    const upstream=request({hostname:'127.0.0.1',port:48761,method:req.method,path:req.url,headers:previewHeaders(req.headers)},response=>{
      res.writeHead(response.statusCode,{...response.headers,'X-Robots-Tag':'noindex, nofollow'});response.pipe(res);
    });
    upstream.on('error',()=>{if(!res.headersSent)res.writeHead(503);res.end();});
    res.on('close',()=>upstream.destroy());req.pipe(upstream);
  });
  const listen=(server,port)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  await listen(catalogue,48762);await listen(proxy,4381);
  const env={
    ...runtimeEnv,
    NODE_ENV:'production',NODE_OPTIONS:'--max-old-space-size=768',NEXT_TELEMETRY_DISABLED:'1',APOGEE_LOCAL_PREVIEW:'1',
    DATABASE_URL:dbUrl.href,DATABASE_SSL_MODE:'disable',DATABASE_POOL_MAX:'2',BETTER_AUTH_URL:'http://127.0.0.1:4381',BETTER_AUTH_SECRET:config.BETTER_AUTH_SECRET,
    APPLICATION_HOSTING_PROVIDER:'caddy',RADAR_ACADEMICO_API_URL:'http://127.0.0.1:48762/catalogue',RADAR_ACADEMICO_API_TOKEN:config.RADAR_ACADEMICO_API_TOKEN,
    RADAR_CALENDAR_PERSONAL_ENABLED:'true',MEMBERS_SUPERVISED_REGISTRATION_ENABLED:'true',STRIPE_MODE:'test',RADAR_BILLING_ENABLED:'false',MEMBERS_EMAIL_ENABLED:'false',GOOGLE_CLIENT_ID:'',GOOGLE_CLIENT_SECRET:'',
    ...(google?Object.fromEntries(['GOOGLE_CALENDAR_CLIENT_ID','GOOGLE_CALENDAR_CLIENT_SECRET','GOOGLE_CALENDAR_ENCRYPTION_KEY','GOOGLE_CALENDAR_SYNC_SECRET'].map(k=>[k,google[k]])):{}),
    RADAR_GOOGLE_CALENDAR_ENABLED:google?'true':'false',
    ...(editorial?{RADAR_LOCAL_EDITORIAL:'1',RADAR_ACADEMICO_ADMIN_API_URL:'http://radar-academico:3000/api/internal/editorial/sources',RADAR_ACADEMICO_ADMIN_API_TOKEN:editorial.ADMIN_API_TOKEN}:{}),
  };
  const child=spawn(process.execPath,[...(editorial?['--import',fileURLToPath(new URL('./calendar-local-network.mjs',import.meta.url))]:[]),'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','48761'],{cwd:fileURLToPath(app),env,stdio:'inherit'});
  console.log('Homologação LOCAL: http://127.0.0.1:4381 — autenticação real, banco e catálogo isolados; sem deploy.');
  if(editorial)console.log('Painel integrado ao Radar real em 127.0.0.1:3000, usando somente o banco editorial local e fontes fictícias.');
  let syncing = false;
  const timer = google ? setInterval(async()=>{
    if(syncing)return; syncing=true;
    try {
      const response=await fetch('http://127.0.0.1:48761/api/internal/google-agenda/sync',{method:'POST',headers:{Authorization:'Bearer '+google.GOOGLE_CALENDAR_SYNC_SECRET},signal:AbortSignal.timeout(150000)});
      if(!response.ok)console.warn('Google Agenda: sincronização local pendente.');
    } catch { console.warn('Google Agenda: serviço local indisponível.'); }
    finally { syncing=false; }
  },60000):null;
  for(const signal of ['SIGTERM','SIGINT'])process.on(signal,()=>{child.kill(signal);radarChild?.kill(signal);});
  radarChild?.once('exit',()=>child.kill('SIGTERM'));
  child.once('exit',async code=>{if(timer)clearInterval(timer);radarChild?.kill('SIGTERM');catalogue.close();proxy.close();await sql.end();process.exitCode=code??1;});
}
