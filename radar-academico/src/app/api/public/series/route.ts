import { isRadarConsumerAuthorized } from '@/lib/auth/radar-consumer';
import { listPublicSeries } from '@/lib/alerts/series';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  const headers={'Cache-Control':'no-store'};
  if(!isRadarConsumerAuthorized(request))return Response.json({error:'Não autorizado'},{status:401,headers});
  try {return Response.json({series:await listPublicSeries()},{headers});}
  catch {return Response.json({error:'Acompanhamento temporariamente indisponível'},{status:503,headers});}
}
