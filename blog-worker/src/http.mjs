import https from 'node:https';
import {lookup} from 'node:dns/promises';
import {isIP} from 'node:net';
import {fail} from './policy.mjs';

export function publicIPv4(address) {
  if(isIP(address)!==4)return false;
  const [a,b,c]=address.split('.').map(Number);
  return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)
    ||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||(b===0&&(c===0||c===2))))
    ||(a===198&&(b===18||b===19||(b===51&&c===100)))||(a===203&&b===0&&c===113));
}
export function allowedUrl(value,hosts) {
  let u;try{u=new URL(value);}catch{fail('invalid_url');}
  if(u.protocol!=='https:' || u.username || u.password || (u.port&&u.port!=='443') || isIP(u.hostname)
    || !hosts.includes(u.hostname) || value.length>2048)fail('url_not_allowed');
  return u;
}
export function retryAfterSeconds(value,at=Date.now()) {
  if(typeof value!=='string')return 0;
  const seconds=/^\d+$/.test(value)?Number(value):(Date.parse(value)-at)/1000;
  return Number.isFinite(seconds)?Math.min(7*86400,Math.max(0,Math.ceil(seconds))):0;
}
// DNS is resolved once and pinned into TLS's lookup; no redirects, proxy or private IP fallback.
export async function getFeed(url,hosts,{resolve=lookup,request=https.request,maxBytes=2*1024*1024,etag,lastModified,accept='application/rss+xml,application/atom+xml,application/xml,text/xml',timeoutMs=20000,statuses=[200,304]}={}) {
  const u=allowedUrl(url,hosts),addresses=await resolve(u.hostname,{all:true,family:4});
  if(!addresses.length || addresses.some(x=>!publicIPv4(x.address)))fail('private_address');
  return new Promise((resolve,reject)=>{
    const headers={'User-Agent':'ApogeeBlog/0.1 (+https://www.apogee.community)','Accept':accept};
    if(etag)headers['If-None-Match']=etag;
    if(lastModified)headers['If-Modified-Since']=lastModified;
    const req=request(u,{headers,signal:AbortSignal.timeout(timeoutMs),lookup:(_host,options,cb)=>{
      if(options.all)cb(null,[{address:addresses[0].address,family:4}]);else cb(null,addresses[0].address,4);
    }},res=>{
      if(res.statusCode===304){res.resume();resolve({notModified:true});return;}
      if(!statuses.includes(res.statusCode)){res.resume();reject(Object.assign(Error('feed_http'),{retryAfter:retryAfterSeconds(res.headers['retry-after'])}));return;}
      if(Number(res.headers['content-length']??0)>maxBytes){res.destroy();reject(Error('feed_size'));return;}
      let size=0;const chunks=[];
      res.on('data',chunk=>{size+=chunk.length;if(size>maxBytes){res.destroy();reject(Error('feed_size'));}else chunks.push(chunk);});
      res.on('error',()=>reject(Error('feed_read')));
      res.on('end',()=>resolve({body:Buffer.concat(chunks).toString('utf8'),etag:res.headers.etag??null,lastModified:res.headers['last-modified']??null,status:res.statusCode,location:res.headers.location??null,contentType:res.headers['content-type']??null,robots:res.headers['x-robots-tag']??null}));
    });
    req.on('error',()=>reject(Error('feed_network')));req.end();
  });
}
export async function boundedJson(response,maxBytes=262144) {
  if(Number(response.headers.get('content-length')??0)>maxBytes)fail('response_size');
  if(!response.body)fail('empty_response');
  const reader=response.body.getReader();const chunks=[];let size=0;
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)fail('response_size');chunks.push(Buffer.from(value));}}
  finally{await reader.cancel().catch(()=>{});}
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
