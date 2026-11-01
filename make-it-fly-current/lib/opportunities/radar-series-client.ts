import 'server-only';
export type RadarSeries={id:string;name:string;organizer:string;lastCheckedAt:string|null;checkStatus:string;alertsAvailable:boolean};
export async function listRadarSeries():Promise<RadarSeries[]> {
  const origin=process.env.RADAR_ACADEMICO_API_URL,token=process.env.RADAR_ACADEMICO_API_TOKEN;
  if(!origin||!token)throw Error('Acompanhamento indisponível');
  const response=await fetch(new URL('/api/public/series',origin),{cache:'no-store',redirect:'error',headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(5000)});
  if(!response.ok)throw Error('Acompanhamento indisponível');
  const data:unknown=await response.json();
  if(!data||typeof data!=='object'||!('series'in data)||!Array.isArray(data.series))throw Error('Resposta inválida');
  return data.series.slice(0,300).flatMap((row:unknown)=>{
    if(!row||typeof row!=='object')return [];
    const r=row as Record<string,unknown>;
    if(typeof r.id!=='string'||!/^[a-z0-9][a-z0-9-]{0,79}$/.test(r.id)||typeof r.name!=='string'||typeof r.organizer!=='string')return [];
    return [{id:r.id,name:r.name.slice(0,500),organizer:r.organizer.slice(0,300),lastCheckedAt:typeof r.lastCheckedAt==='string'&&Number.isFinite(Date.parse(r.lastCheckedAt))?new Date(r.lastCheckedAt).toISOString():null,checkStatus:typeof r.checkStatus==='string'?r.checkStatus:'not_checked',alertsAvailable:r.alertsAvailable===true}];
  });
}
