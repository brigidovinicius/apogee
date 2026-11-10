// Load THIS checkout's CMS data functions against the temporary test database.
// A sibling installation may supply matching dependencies, never its application code or .env.
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,join,dirname,relative as relativePath} from 'node:path';

const site=fileURLToPath(new URL('../../make-it-fly-current/',import.meta.url));
const dependencies=process.env.BLOG_TEST_CMS_DEPENDENCIES_FROM??site;
const require=createRequire(join(resolve(dependencies),'package.json'));
const lock=JSON.parse(readFileSync(join(site,'package-lock.json'),'utf8'));
for(const name of ['typescript','drizzle-orm']){
  const file=join(resolve(dependencies),'node_modules',name,'package.json');
  if(JSON.parse(readFileSync(file,'utf8')).version!==lock.packages['node_modules/'+name].version)throw Error('cms_test_dependency_version_mismatch');
}
const ts=require('typescript'),{drizzle}=require('drizzle-orm/postgres-js');
export function loadCms(sql,entry="lib/blog/data.ts"){
  const db=drizzle(sql),cache=new Map();
  function load(relative){
    if(relative.endsWith('.json'))return JSON.parse(readFileSync(join(site,relative),'utf8'));
    if(cache.has(relative))return cache.get(relative).exports;
    const loaded={exports:{}};cache.set(relative,loaded);
    const source=readFileSync(join(site,relative),'utf8');
    const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText;
    const localRequire=name=>{
      if(name==='server-only')return {};
      if(name==='@/lib/members/db')return {getDb:()=>db,getSql:()=>sql};
      if(name==='@/lib/members/schema')return load('lib/members/schema.ts');
      if(name==='node:crypto')return require(name);
      if(name.startsWith('.')){const base=join(dirname(relative),name);return load(base.endsWith('.mjs')||base.endsWith('.json')?base:base+'.ts');}
      if(!['drizzle-orm','drizzle-orm/pg-core'].includes(name))throw Error('unexpected_cms_test_import');
      return require(name);
    };
    new Function('require','module','exports',compiled)(localRequire,loaded,loaded.exports);
    return loaded.exports;
  }
  return load(entry);
}
