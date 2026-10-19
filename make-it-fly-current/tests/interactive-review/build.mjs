import {createRequire} from 'node:module';
import path from 'node:path';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const root=path.resolve(import.meta.dirname,'../..'), require=createRequire(root+'/package.json');
const {webpack}=require('next/dist/compiled/webpack/webpack');
const here=import.meta.dirname, boundary=here+'/boundaries.tsx';
const alias={'@review':here};
for(const name of ['next/navigation','next/cache','next/headers','next/link','@/lib/members/dal','@/lib/admin/access','@/lib/members/auth','@/lib/members/forum','@/lib/members/rate-limit','@/lib/blog/data']) alias[name+'$']=boundary;
alias['next/image$']=here+'/image.tsx';
alias['@']=root;
const destination='/private/tmp/apogee-design-review';mkdirSync(destination,{recursive:true});
await new Promise((resolve,reject)=>webpack({mode:'development',context:root,target:'web',devtool:false,entry:here+'/entry.tsx',output:{path:destination,filename:'interactive.js'},resolve:{extensions:['.tsx','.ts','.js','.mjs'],alias},module:{rules:[{test:/\.tsx?$|\.module\.css$/,exclude:/node_modules/,use:here+'/transform.cjs'}]},optimization:{minimize:false}},(error,stats)=>{if(error||stats.hasErrors())reject(error??new Error(stats.toString({all:false,errors:true})));else {
 const names=stats.toJson({all:false,modules:true}).modules.map(m=>m.identifier??m.name??'');
 const forbidden=names.filter(name=>/lib[\/]members[\/](db|auth|dal)\.|lib[\/]blog[\/]data\.|lib[\/]admin[\/]access\.|node_modules[\/](postgres|drizzle-orm|better-auth)[\/]/.test(name));
 if(forbidden.length){reject(new Error('Real transport in review bundle: '+forbidden.join(',')));return;}
 writeFileSync(destination+'/interactive-safety.json',JSON.stringify({modules:names.length,realTransportModules:forbidden,mutations:'blocked'},null,2));
 console.log(stats.toString({all:false,warnings:true,timings:true}));resolve();
 }}));
for(const kind of ['profileedit','editor']) {
 const file=destination+'/'+kind+'.html';let html=readFileSync(file,'utf8');
 if(html.includes('data-interactive-review'))continue;
 html=html.replace('dados fictícios · sem sessão, gravações ou envio de formulários.','modo interativo · dados fictícios · gravações e envios bloqueados.');
 if(kind==='profileedit') {
  const start=html.indexOf('<div class="members_avatarEditor');
  const end=html.indexOf('</main>',start);
  if(start<0||end<0)throw Error('Profile fixture host not found');
  // Profile form is inside the final panel and container wrappers in main.
  html=html.slice(0,start)+'<div data-interactive-review="profileedit"></div></div></div>'+html.slice(end);
 } else {
  const start=html.indexOf('<form class="posts_editor');
  const end=html.indexOf('</main>',start);
  if(start<0||end<0)throw Error('Editor fixture host not found');
  html=html.slice(0,start)+'<div data-interactive-review="editor"></div></div>'+html.slice(end);
 }
 html=html.replace('<script>document.addEventListener(\'submit\',e=>e.preventDefault());</script>','');
 html=html.replace('</body>','<script defer src="/__review/interactive.js"></script></body>');
 writeFileSync(file,html);
}
console.log('INTERACTIVE_REVIEW_READY (writes blocked)');
