import { createHash } from 'node:crypto';
import type { OfficialSource } from './types';

const targetId = 'xlsx-20261014-001-ufsc';
const roots = new Set(['https://noticias.ufsc.br', 'https://noticias.ufsc.br/']);
export const UFSC_ENSUS_URL = 'https://joinville.ufsc.br/2026/10/28/ensus-2027-abre-inscricoes-e-submissao-de-trabalhos-cientificos/';
export const UFSC_SECARTE_PERFORMANCE_URL = 'https://secarte.ufsc.br/performance-nada-sera-devolvido-em-silencio/';
export const UFSC_DAC_PERFORMANCE_URL = 'https://dac.ufsc.br/2026/11/13/performance-nada-sera-devolvido-em-silencio/';
// Each host was read from the verified UFSC index and audited on 19/11/2026.
// This does not grant authority to arbitrary subdomains or shared platforms.
const hosts = new Set(['noticias.ufsc.br', 'www.ca.ufsc.br', 'petletras.paginas.ufsc.br',
  'ara.ufsc.br', 'blumenau.ufsc.br']);

export function auditedUfscTarget(lead: { target_id: string; target_official_url: string;
  target_organizer?: string }) {
  return lead.target_id === targetId && roots.has(lead.target_official_url) && lead.target_organizer === 'UFSC';
}

export function auditedUfscChild(lead: Parameters<typeof auditedUfscTarget>[0] & { url: string }) {
  try {
    const url = new URL(lead.url);
    return auditedUfscTarget(lead) && url.protocol === 'https:' && !url.port &&
      !url.username && !url.password && hosts.has(url.hostname);
  } catch { return false; }
}

export function auditedUfscPage(source: OfficialSource) {
  try {
    const url = new URL(source.baseUrl);
    return source.institutionName === 'UFSC' && hosts.has(url.hostname) &&
      source.id === `auto-page-${createHash('sha256').update(source.baseUrl).digest('hex').slice(0, 32)}` &&
      /^radar:discovery-page:v1; target=xlsx-20261014-001-ufsc; authority=https:\/\/noticias\.ufsc\.br\/?$/.test(source.notes ?? '');
  } catch { return false; }
}

/** Encoded and decoded caps, robots, DNS, TLS and redirect policy remain enforced. */
export function ufscDiscoveryGzip(source: OfficialSource, input: string) {
  return source.id === targetId && roots.has(source.baseUrl) && roots.has(input) ||
    auditedUfscPage(source) && input === source.baseUrl;
}
