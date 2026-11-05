import {timingSafeEqual} from 'node:crypto';
import {runCollectionDigests} from '@/lib/opportunities/collection-digest-worker';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
 const secret=process.env.RADAR_COLLECTION_DIGEST_SECRET??'';
 const candidate=request.headers.get('authorization')??'';
 const expected=Buffer.from('Bearer '+secret),received=Buffer.from(candidate);
 if(secret.length<32||received.length!==expected.length||!timingSafeEqual(received,expected))return Response.json({error:'Unauthorized'},{status:401});
 try{return Response.json(await runCollectionDigests(),{headers:{'Cache-Control':'no-store'}});}
 catch{return Response.json({error:'Não foi possível processar os resumos.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
