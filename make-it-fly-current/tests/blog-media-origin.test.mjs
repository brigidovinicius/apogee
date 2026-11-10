import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const origin='https://www.apogee.community';
function fixture(){
  let reads=0,deletes=0;
  const media=opportunityLoader({'@/lib/members/mail':{applicationOrigin:()=>origin},'./data':{
    getAdminPost:async()=>{reads++;return {id:1};},removePostMedia:async()=>{deletes++;return 'removed';}
  }})('lib/blog/media.ts');
  return {...media,counts:()=>({reads,deletes})};
}
const id='00000000-0000-0000-0000-000000000001';
test('blog media accepts the configured site origin behind an internal Next container URL',async()=>{
  const media=fixture();
  const request=new Request('http://0.0.0.0:3000/api/admin/posts/1/media',{method:'POST',headers:{origin,'content-type':'application/json'},body:'{}'});
  assert.equal((await media.uploadBlogMedia(request,1)).status,415,'valid origin reaches media validation instead of being rejected as a foreign site');
  assert.equal(media.counts().reads,1);
  assert.equal((await media.deleteBlogMedia(new Request('http://0.0.0.0:3000/api/admin/posts/1/media',{method:'DELETE',headers:{origin}}),1,id)).status,200);
  assert.equal(media.counts().deletes,1);
});
test('missing, foreign and forged forwarded origins remain denied before data access',async()=>{
  for(const headers of [{},{origin:'https://other.example'},{origin:'https://other.example',host:'other.example','x-forwarded-host':'other.example','x-forwarded-proto':'https'}]){
    const media=fixture();
    for(const method of ['POST','DELETE']){
      const request=new Request('https://other.example/api/admin/posts/1/media',{method,headers});
      const response=method==='POST'?await media.uploadBlogMedia(request,1):await media.deleteBlogMedia(request,1,id);
      assert.equal(response.status,403);
    }
    assert.deepEqual(media.counts(),{reads:0,deletes:0});
  }
});
