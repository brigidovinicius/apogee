import {readFile} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import postgres from 'postgres';
import {Blocked,fail} from './policy.mjs';
import {Store,migrate} from './store.mjs';
import {loadConfig,tick,heartbeat,healthy} from './worker.mjs';
import {googleSubscriptionProvider} from './google-provider.mjs';

export async function database(env,administrative=false) {
  const raw=env[administrative?'BLOG_MIGRATION_DATABASE_URL':'BLOG_DATABASE_URL'];
  if(!raw)fail('database_missing');
  const url=new URL(raw);
  if(!['postgres:','postgresql:'].includes(url.protocol)||!url.username||!url.pathname.slice(1))fail('database_invalid');
  const local=env.BLOG_LOCAL_TEST==='1'&&['127.0.0.1','localhost'].includes(url.hostname);
  const ca=env.BLOG_DATABASE_CA_CERT_FILE?await readFile(env.BLOG_DATABASE_CA_CERT_FILE,'utf8'):null;
  if(!local&&!ca)fail('database_ca_required');
  // Explicit TLS config: query-string SSL options cannot disable certificate validation.
  return postgres({host:url.hostname,port:Number(url.port||5432),username:decodeURIComponent(url.username),password:decodeURIComponent(url.password),
    database:url.pathname.slice(1),ssl:local?false:{ca,rejectUnauthorized:true},max:2,prepare:false,connect_timeout:10,idle_timeout:20});
}
async function main(env=process.env,args=process.argv.slice(2)) {
  const command=args[0]??'check',file=env.BLOG_HEALTH_FILE??'/tmp/apogee-blog-health.json';
  if(command==='healthcheck'){process.exitCode=await healthy(file)?0:1;return;}
  const directory=pathToFileURL(resolve(env.BLOG_CONFIG_DIR??fileURLToPath(new URL('../config/',import.meta.url)))+'/');
  const config=await loadConfig(directory);
  if(command==='check'){console.log(JSON.stringify({status:'configuration_valid',generation_enabled:config.policy.generation_enabled,enabled_sources:config.sources.filter(s=>s.enabled).length,approved_prices:config.catalog.filter(p=>p.approved).length}));return;}
  if(!['run','once','status','migrate','attest-grant','attest-subscription','reconcile','correct-image-price','resume'].includes(command))fail('invalid_command');
  const admin=['migrate','attest-grant','attest-subscription','reconcile','correct-image-price','resume'].includes(command);
  if(admin&&!args.includes('--execute'))fail('explicit_execution_required');
  const sql=await database(env,admin),store=new Store(sql);
  try{
    if(command==='migrate'){console.log(JSON.stringify({status:await migrate(sql)}));return;}
    if(command==='status'){console.log(JSON.stringify(await store.summary()));return;}
    if(command==='resume'){console.log(JSON.stringify(await store.resume()));return;}
    const identity={organization_id:env.BLOG_OPENAI_ORGANIZATION_ID,project_id:env.BLOG_OPENAI_PROJECT_ID};
    if(command==='attest-grant'||command==='attest-subscription'||command==='reconcile'||command==='correct-image-price'){
      const at=args.indexOf('--file');if(at<0||!args[at+1])fail('grant_file_missing');
      const record=JSON.parse(await readFile(args[at+1],'utf8'));
      console.log(JSON.stringify(command==='attest-subscription'?await store.attestSubscription(record):command==='correct-image-price'?await store.correctImagePrice(record):command==='reconcile'?await store.reconcile(record):await store.attestGrant(record,identity)));return;
    }
    let stopped=false,wake;
    const stop=()=>{stopped=true;wake?.();};
    for(const signal of ['SIGTERM','SIGINT'])process.on(signal,stop);
    try{do{
      let state;
      try{
        const current=await loadConfig(directory);
        if(current.policy.provider!=='google_subscription')fail('paid_api_disabled');
        const provider=current.policy.generation_enabled?googleSubscriptionProvider({binary:env.BLOG_GOOGLE_CLI_PATH,sha256:env.BLOG_GOOGLE_CLI_SHA256,env}):null;
        state={component:'blog-worker',at:new Date().toISOString(),alive:true,...await tick({store,config:current,identity,provider})};
      }catch(error){state={component:'blog-worker',at:new Date().toISOString(),alive:false,reason:error instanceof Blocked?error.code:'internal_error'};}
      await heartbeat(file,state);console.log(JSON.stringify(state));
      if(command==='once'||stopped)break;
      await new Promise(done=>{const timer=setTimeout(done,60000);wake=()=>{clearTimeout(timer);done();};});
    }while(!stopped);}finally{for(const signal of ['SIGTERM','SIGINT'])process.off(signal,stop);}
  }finally{await sql.end({timeout:5});}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try{await main();}catch(error){console.error(JSON.stringify({component:'blog-worker',status:'failed',reason:error instanceof Blocked?error.code:'internal_error'}));process.exitCode=1;}
}
