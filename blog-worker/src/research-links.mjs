import {referenceUrl} from './corroboration.mjs';
// Old journal citations often use HTTP. Upgrade only the official DOI resolver;
// other HTTP links, credentials and unregistered redirect destinations stay blocked.
export function canonicalResearchUrl(value,base){
  const u=new URL(value,base);
  if(u.protocol==='http:'&&!u.username&&!u.password&&!u.port&&['doi.org','dx.doi.org'].includes(u.hostname)&&/^\/10\.\d{4,9}\//i.test(u.pathname))u.protocol='https:';
  return referenceUrl(u.href);
}
