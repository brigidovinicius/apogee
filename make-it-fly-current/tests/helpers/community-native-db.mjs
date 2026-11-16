import { mkdtemp,readFile,writeFile,realpath,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync,spawnSync } from "node:child_process";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import postgres from "postgres";
import { fileURLToPath } from "node:url";
export async function nativeCommunityDatabase({directory,preserve=false}={}) {
  const dir=directory?await realpath(directory):await mkdtemp(path.join(tmpdir(),'apg-community-'));
  const marker={purpose:'apogee-native-community-fixture',workspace:fileURLToPath(new URL('../../',import.meta.url))};
  const bin=process.env.PG_BIN??'/opt/homebrew/bin',data=path.join(dir,'data');
  if(directory) {
    if(path.dirname(dir)!==await realpath(tmpdir()) || !path.basename(dir).startsWith('apg-community-')) throw Error('Diretório de revisão inválido.');
    const owner=JSON.parse(await readFile(path.join(dir,'fixture-owner.json'),'utf8'));
    if(owner.purpose!==marker.purpose || owner.workspace!==marker.workspace) throw Error('Esta base não pertence à prévia local.');
    const status=spawnSync(path.join(bin,'pg_ctl'),['-D',data,'status'],{stdio:'ignore'});
    if(status.status!==3) throw Error('Base de revisão em uso ou estado desconhecido. Não foi interrompida.');
  } else {
    await writeFile(path.join(dir,'fixture-owner.json'),JSON.stringify(marker),{mode:0o600});
    execFileSync(path.join(bin,'initdb'),['-D',data,'-U','apogee_local','-A','trust','--no-locale','--encoding=UTF8'],{stdio:'ignore'});
  }
  const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-F -p ${port} -h 127.0.0.1 -k ${dir}`,'-w','start'],{stdio:'ignore'});
  const url=`postgres://apogee_local@127.0.0.1:${port}/postgres`;
  const sql=postgres(url,{ssl:false,max:8,prepare:false,onnotice:()=>{}});
  try {
    if(!directory) {
    await sql.unsafe('create schema drizzle; create table drizzle.__drizzle_migrations(id serial primary key,hash text not null,created_at bigint)');
    const root=new URL('../../drizzle/',import.meta.url);
    const entries=JSON.parse(await readFile(new URL('meta/_journal.json',root),'utf8')).entries;
    for(const entry of entries.slice(0,17)) {
      const source=await readFile(new URL(`${entry.tag}.sql`,root),'utf8');
      await sql.unsafe(source);
      await sql`insert into drizzle.__drizzle_migrations(hash,created_at) values(${createHash('sha256').update(source).digest('hex')},${entry.when})`;
    }
    }
    return {sql,url,dir,data,resumed:Boolean(directory),close:async()=>{await sql.end();execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});if(!preserve)await rm(dir,{recursive:true});}};
  } catch(error) {
    await sql.end();execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});if(!preserve&&!directory)await rm(dir,{recursive:true});throw error;
  }
}
