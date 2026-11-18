import { readFile,lstat,writeFile,rename } from 'node:fs/promises';
import { reconcileOnce } from './reconcile.mjs';
const file='/tmp/radar-finance-health.json';
if(process.argv[2]==='healthcheck') {
  try {const d=JSON.parse(await readFile(file,'utf8'));process.exitCode=d.alive&&Date.now()-Date.parse(d.at)<4500000?0:1;}
  catch {process.exitCode=1;}
} else {
  async function secret(path) {const s=await lstat(path);if(!s.isFile()||s.isSymbolicLink()||s.size>8192)throw Error('invalid_secret');return (await readFile(path,'utf8')).trim()}
  let pool,stop=false,wake;const halt=()=>{stop=true;wake?.()};process.on('SIGTERM',halt);process.on('SIGINT',halt);
  try {
    if(process.env.RADAR_FINANCE_ENABLED!=='true')throw Error('disabled');
    const keyText=await secret(process.env.RADAR_FINANCE_KEY_FILE);const key=/^OPENAI_ADMIN_KEY=(sk-[A-Za-z0-9_-]{20,})$/.exec(keyText)?.[1];
    if(!key)throw Error('invalid_secret');
    const url=new URL(await secret(process.env.RADAR_FINANCE_DATABASE_URL_FILE));
    if(url.protocol!=='postgresql:'||url.hostname!=='postgres'||url.username!=='radar_ai_reconciler'||url.search||url.hash)throw Error('invalid_database');
    const {default:pg}=await import('pg');pool=new pg.Pool({connectionString:url.href,max:1,connectionTimeoutMillis:10000,statement_timeout:20000});
    const store={config:async()=>(await pool.query('select radar_ai.reconciliation_config() value')).rows[0].value,
      refresh:async(cost,at,reference)=>(await pool.query('select radar_ai.refresh_reconciliation($1,$2,$3) value',[cost,at,reference])).rows[0].value};
    do {
      let result;try {result=await reconcileOnce({store,apiKey:key});}catch {result={updated:false,reason:'verification_unavailable'}}
      const health={component:'radar-cost-reconciliation',alive:true,at:new Date().toISOString(),...result};
      await writeFile(file+'.tmp',JSON.stringify(health),{mode:0o600});await rename(file+'.tmp',file);console.log(JSON.stringify(health));
      if(process.argv[2]==='check'||stop)break;
      await new Promise(resolve=>{const timer=setTimeout(resolve,3600000);wake=()=>{clearTimeout(timer);resolve()}});
    }while(!stop);
  }finally {await pool?.end();process.off('SIGTERM',halt);process.off('SIGINT',halt)}
}
