import { calendarNavigationQuery } from './calendar-filters';
import { memberRadarPath } from './navigation';

/** Return destinations are allowlisted and canonicalized before any redirect. */
export function calendarReturnPath(value:unknown):string {
  if(typeof value!=='string'||value.length>4096||value.includes('\\'))return '/membros/meu-calendario';
  try {
    const url=new URL(value,'https://apogee.invalid');
    if(url.origin!=='https://apogee.invalid')return '/membros/meu-calendario';
    if(url.pathname==='/membros/colecoes/acompanhadas'||/^\/membros\/colecoes\/seguir\/[a-f0-9]{48}$/.test(url.pathname))return url.pathname;
    if(/^\/membros\/colecoes(?:\/[0-9a-f-]{36})?$/.test(url.pathname))return url.pathname;
    if(url.pathname==='/oportunidades'||url.pathname==='/membros/oportunidades')return memberRadarPath(url.searchParams);
    if(/^\/membros\/oportunidades\/[A-Za-z0-9_-]+$/.test(url.pathname))return url.pathname;
    if(url.pathname==='/membros/meu-calendario'||/^\/calendarios\/[a-z-]+$/.test(url.pathname)) {
      if(url.pathname.startsWith('/calendarios/')) {url.searchParams.set('calendario',url.pathname.split('/')[2]);url.searchParams.set('catalogo','1');}
      const params=calendarNavigationQuery(url.searchParams);
      // Fragments are not sent to the server: carry this allowlisted intent
      // through login, account verification and the calendar page itself.
      const google=url.searchParams.get('integracao')==='google'||url.hash==='#google-calendar-heading';
      if(google)params.set('integracao','google');
      const query=params.toString();
      return '/membros/meu-calendario'+(query?'?'+query:'')+(google?'#google-calendar-heading':'');
    }
  }catch{}
  return '/membros/meu-calendario';
}
