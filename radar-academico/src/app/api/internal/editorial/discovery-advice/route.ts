import { isRadarAdminConsumerAuthorized } from '@/lib/auth/radar-admin-consumer';
import { runAutomaticDiscoveryAdvice } from '@/lib/discovery/automatic-ai';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(request:Request) {
  if(!isRadarAdminConsumerAuthorized(request))return Response.json({error:'Não autorizado'},{status:401});
  try { return Response.json(await runAutomaticDiscoveryAdvice(),{headers:{'Cache-Control':'no-store'}}); }
  catch { return Response.json({error:'Priorização indisponível'},{status:503}); }
}
