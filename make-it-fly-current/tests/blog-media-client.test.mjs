import test from 'node:test';
import assert from 'node:assert/strict';
import {opportunityLoader} from './helpers/load-opportunity-module.mjs';
const {readMediaResponse}=opportunityLoader()('lib/blog/media-client.ts');

test('image responses keep successful media and safe server validation messages',async()=>{
  const media={id:'fixture',url:'/blog/media/fixture.webp'};
  assert.deepEqual(await readMediaResponse(Response.json({media},{status:201})),{media});
  await assert.rejects(()=>readMediaResponse(Response.json({error:'Descreva a imagem.'},{status:400})),/Descreva a imagem/);
});
test('proxy HTML, text and malformed responses never expose JSON parser errors in the image manager',async()=>{
  for(const [status,body,message] of [[413,'<html>too large</html>',/arquivo menor/],[403,'Access denied',/Entre novamente/],[502,'Bad gateway',/Tente novamente/],[200,'Invalid Server Actions request.',/Tente novamente/],[200,'null',/Tente novamente/]]){
    await assert.rejects(()=>readMediaResponse(new Response(body,{status})),message);
  }
});
