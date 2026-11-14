import { mkdtemp,readFile,rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createServer } from "node:net";
import { createHash } from "node:crypto";
import postgres from "postgres";
export async function nativeCommunityDatabase() {
  const dir=await mkdtemp(path.join(tmpdir(),'apg-community-'));
  const port=await new Promise((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
  const data=path.join(dir,'data'),bin=process.env.PG_BIN??'/opt/homebrew/bin';
  execFileSync(path.join(bin,'initdb'),['-D',data,'-U','apogee_local','-A','trust','--no-locale','--encoding=UTF8'],{stdio:'ignore'});
  execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-l',path.join(dir,'postgres.log'),'-o',`-F -p ${port} -h 127.0.0.1 -k ${dir}`,'-w','start'],{stdio:'ignore'});
  const url=`postgres://apogee_local@127.0.0.1:${port}/postgres`;
  const sql=postgres(url,{ssl:false,max:8,prepare:false,onnotice:()=>{}});
  try {
    await sql.unsafe('create schema drizzle; create table drizzle.__drizzle_migrations(id serial primary key,hash text not null,created_at bigint)');
    const root=new URL('../../drizzle/',import.meta.url);
    const entries=JSON.parse(await readFile(new URL('meta/_journal.json',root),'utf8')).entries;
    for(const entry of entries.slice(0,17)) {
      const source=await readFile(new URL(`${entry.tag}.sql`,root),'utf8');
      await sql.unsafe(source);
      await sql`insert into drizzle.__drizzle_migrations(hash,created_at) values(${createHash('sha256').update(source).digest('hex')},${entry.when})`;
    }
    return {sql,url,dir,data,close:async()=>{await sql.end();execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});await rm(dir,{recursive:true});}};
  } catch(error) {
    await sql.end();execFileSync(path.join(bin,'pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});await rm(dir,{recursive:true});throw error;
  }
}
