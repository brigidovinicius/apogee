// Official Antigravity hooks. This process never has provider or database credentials.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
const [event,folder]=process.argv.slice(2);
const stop=reason=>({terminationBehavior:'terminate',injectSteps:[{errorMessage:{userMessage:reason}}]});
export async function decide(event,payload,config,folder) {
  if(config.kind==='diagnostic')return event==='tool'?{decision:'deny',reason:'Account check never uses tools'}:stop('Account check never invokes a model');
  if(payload.modelName!==config.model)return event==='tool'?{decision:'deny',reason:'Model outside editorial policy'}:stop('Model outside editorial policy');
  if(event==='invocation'){
    if(!Number.isSafeInteger(payload.invocationNum)||payload.invocationNum>=config.maxInvocations)return stop('Editorial invocation limit');
    await writeFile(join(folder,'invocation-'+payload.invocationNum+'.json'),JSON.stringify({model:payload.modelName,number:payload.invocationNum}),{mode:0o600});return {};
  }
  if(event==='tool'){
    // CLI 1.5.3 implements --json-schema through its built-in finish tool.
    // It only returns structured data; it has no filesystem/network side effects.
    if(payload.toolCall?.name==='finish'){
      const keys=Object.keys(payload.toolCall.args??{}).sort().join(',');
      const expected=config.kind==='image'?'image_path':config.kind==='comparison'?'claims':'excerpt,paragraphs,seoDescription,seoTitle,title';
      return keys===expected?{decision:'auto_approve',reason:'Return the requested structured output'}:{decision:'deny',reason:'Unexpected output fields'};
    }
    if(config.kind!=='image'||payload.toolCall?.name!=='generate_image')return {decision:'deny',reason:'Only one editorial image tool is permitted; no commands, web, files, MCP or subagents'};
    try{await mkdir(join(folder,'image-requested'));}catch{return {decision:'deny',reason:'The image has already been requested; no retry'};}
    await writeFile(join(folder,'image-call.json'),JSON.stringify({artifactDirectoryPath:payload.artifactDirectoryPath,conversationId:payload.conversationId}),{mode:0o600});
    return {decision:'auto_approve',reason:'One image explicitly requested by the editor',overwrite:{Prompt:config.prompt,ImageName:'apogee_cover',ImagePaths:[]}};
  }
  return stop('Unknown editorial hook');
}
if(folder){
  let out;
  try{let raw='';for await(const chunk of process.stdin){raw+=chunk;if(raw.length>524288)throw Error('large hook');}
    const config=JSON.parse(await readFile(join(resolve(folder),'policy.json'),'utf8'));
    out=await decide(event,JSON.parse(raw),config,resolve(folder));
  }catch{out=event==='tool'?{decision:'deny',reason:'Editorial hook unavailable'}:stop('Editorial hook unavailable');}
  process.stdout.write(JSON.stringify(out));
}
