// Own disposable cluster only; no Docker, downloads, .env or existing databases.
import { execFileSync, spawn } from 'node:child_process';
import { mkdtemp, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import pg from 'pg';
const bin=process.env.RADAR_POSTGRES_BIN;
if(!bin)throw Error('RADAR_POSTGRES_BIN must point to installed binaries');
const root=await mkdtemp(join(tmpdir(),'radar-jobs-pg-')),data=join(root,'data'),socket=join(root,'socket');await mkdir(socket);
const probe=createServer();await new Promise((done,reject)=>{probe.once('error',reject);probe.listen(0,'127.0.0.1',done);});
const port=probe.address().port;await new Promise(done=>probe.close(done));
const run=(name,args)=>execFileSync(join(bin,name),args,{encoding:'utf8',stdio:'pipe',env:{...process.env,LC_ALL:'C',LANG:'C'}});
let started=false;
try{
  run('initdb',['-D',data,'-U','postgres','--auth=trust','--no-locale','--encoding=UTF8']);
  run('pg_ctl',['-D',data,'-l',join(root,'postgres.log'),'-o',`-h 127.0.0.1 -p ${port} -k ${socket} -c shared_buffers=16MB -c max_connections=12`,'-w','start']);started=true;
  const bootstrap=new pg.Client({host:socket,port,user:'postgres',database:'postgres'});
  try{await bootstrap.connect();await bootstrap.query('create database radar_jobs_test');}finally{await bootstrap.end();}
  process.exitCode=await new Promise((done,reject)=>{
    const child=spawn(process.execPath,[resolve('node_modules/vitest/vitest.mjs'),'run','--maxWorkers=1','src/__tests__/jobs.test.ts','src/__tests__/job-api.test.ts','src/__tests__/jobs.integration.test.ts'],{
      stdio:'inherit',env:{PATH:process.env.PATH,HOME:process.env.HOME,TMPDIR:process.env.TMPDIR,
        RADAR_JOBS_TEST_ADMIN_URL:`postgresql://postgres@127.0.0.1:${port}/radar_jobs_test`}});
    child.once('error',reject);child.once('exit',code=>done(code??1));
  });
}finally{if(started)run('pg_ctl',['-D',data,'-m','fast','-w','stop']);console.log(`Disposable PostgreSQL evidence: ${root}`);}
