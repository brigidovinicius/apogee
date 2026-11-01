import 'server-only';
import { randomUUID } from 'node:crypto';
import { getSql } from '@/lib/members/db';
import { calendarFilterQuery } from './calendar-filters';

export type SavedCalendarFilter={id:string;name:string;query:string};
const idPattern=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function listSavedCalendarFilters(userId:string):Promise<SavedCalendarFilter[]> {
  const rows=await getSql()`select id,name,filter_query from radar_calendar_filter where user_id=${userId} order by lower(name),id`;
  return rows.map(r=>({id:String(r.id),name:String(r.name),query:String(r.filter_query)}));
}
export async function storeCalendarFilter(userId:string,name:unknown,query:unknown) {
  if(typeof name!=='string'||!name.trim()||name.trim().length>80||/[\u0000-\u001f\u007f]/.test(name))throw Error('Informe um nome de até 80 caracteres.');
  if(typeof query!=='string'||query.length>2048)throw Error('Filtros inválidos.');
  const canonical=calendarFilterQuery(new URLSearchParams(query));
  await getSql().begin(async tx=>{
    await tx`select pg_advisory_xact_lock(hashtextextended(${'calendar-filters:'+userId},0))`;
    const existing=await tx`select id from radar_calendar_filter where user_id=${userId} and lower(name)=lower(${name.trim()})`;
    if(existing.length) {
      await tx`update radar_calendar_filter set name=${name.trim()},filter_query=${canonical},updated_at=now() where user_id=${userId} and id=${existing[0].id}`;
      return;
    }
    const [count]=await tx`select count(*)::int as count from radar_calendar_filter where user_id=${userId}`;
    if(Number(count.count)>=20)throw Error('Você pode salvar até 20 combinações. Remova uma para continuar.');
    await tx`insert into radar_calendar_filter(id,user_id,name,filter_query) values(${randomUUID()},${userId},${name.trim()},${canonical})`;
  });
}
export async function removeCalendarFilter(userId:string,id:unknown) {
  if(typeof id!=='string'||!idPattern.test(id))throw Error('Filtro inválido.');
  await getSql()`delete from radar_calendar_filter where user_id=${userId} and id=${id}`;
}
