import {pathToFileURL} from 'node:url';

// One bounded invocation, intended for a timer. No recipient, token or provider body in logs.
export async function digestBatch({origin,secret,fetcher=fetch}) {
 const url=new URL(origin);
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw Error('Origem interna inválida.');
 if(typeof secret!=='string'||secret.length<32)throw Error('Segredo dos resumos ausente.');
 const response=await fetcher(new URL('/api/colecoes/resumos',url),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+secret},signal:AbortSignal.timeout(110000)});
 if(!response.ok)throw Error('Processamento de resumos indisponível.');
 const data=await response.json();
 if(typeof data.enabled!=='boolean'||['checked','accepted','retry','cancelled'].some(k=>!Number.isSafeInteger(data[k])||data[k]<0))throw Error('Resposta de resumos inválida.');
 return {component:'collection-digest',at:new Date().toISOString(),enabled:data.enabled,checked:data.checked,accepted:data.accepted,retry:data.retry,cancelled:data.cancelled};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{console.log(JSON.stringify(await digestBatch({origin:process.env.RADAR_COLLECTION_DIGEST_INTERNAL_ORIGIN??'http://web:3000',secret:process.env.RADAR_COLLECTION_DIGEST_SECRET})));}
 catch{console.error(JSON.stringify({component:'collection-digest',status:'failed'}));process.exitCode=1;}
}
