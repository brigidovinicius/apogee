/* eslint-disable @typescript-eslint/no-require-imports -- Webpack CommonJS loader. */
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
module.exports = function(source) {
  if (this.resourcePath.endsWith('.module.css')) {
    const dir = path.resolve(this.rootContext, '.next/static/css');
    const css = fs.readdirSync(dir).map(f=>fs.readFileSync(path.join(dir,f),'utf8')).join('\n');
    const base=path.basename(this.resourcePath,'.module.css'), map={};
    for(const m of css.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*?)_([A-Za-z][A-Za-z0-9_-]*?)__([A-Za-z0-9_-]+)/g)) if(m[1]===base) map[m[2]]=m[0].slice(1);
    for(const m of source.matchAll(/\.([A-Za-z][A-Za-z0-9_-]*)\s*\{[^}]*?composes:\s*([A-Za-z][A-Za-z0-9_-]*)\s*;/g)) if(map[m[1]]&&map[m[2]])map[m[1]]+=' '+map[m[2]];
    if(!Object.keys(map).length)throw Error('Missing built CSS: '+base);
    return 'export default '+JSON.stringify(map);
  }
  if(this.resourcePath.endsWith('/components/members/profile-form.tsx')) source=source.replace('@/app/membros/actions','@review/profile-action');
  if(this.resourcePath.endsWith('/app/admin/posts/post-editor.tsx')) source=source.replace('"./actions"','"@review/post-action"');
  return ts.transpileModule(source,{fileName:this.resourcePath,compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;
};
