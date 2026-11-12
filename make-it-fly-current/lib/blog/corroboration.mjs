import { createHash } from 'node:crypto';
import catalog from './reference-catalog.json' with { type: 'json' };

export const referenceCatalog = Object.freeze(catalog);
export const taxonomy = Object.freeze({
  ciencia: { label: 'Ciência', subcategories: { aeroespacial: 'Aeroespacial', neurociencia: 'Neurociência' } },
  tecnologia: { label: 'Tecnologia', subcategories: { ia: 'Inteligência Artificial', 'software-ferramentas': 'Software e Ferramentas', 'hardware-robotica': 'Hardware e Robótica' } },
  negocios: { label: 'Negócios', subcategories: { marketing: 'Marketing', 'empreendedorismo-startups': 'Empreendedorismo e Startups' } },
});
export const CRITERION = 'facts-v1-90-critical-independent';
export const MAX_DOCUMENTS = 10;
const stable = v => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable(v[k])])) : v;
export const dossierHash = v => createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(stable(v))).digest('hex');
const reject = code => { throw Object.assign(new Error(code), { code }); };
const string = (v, min, max) => typeof v === 'string' && v.trim() === v && v.length >= min && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(v);
export function referenceUrl(value, reference) {
  let u; try { u = new URL(value); } catch { reject('invalid_reference_url'); }
  const host = u.hostname.replace(/^www\./, '');
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || value.length > 2048
    || !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) || /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host)
    || (reference && !(reference.hosts ?? [new URL(reference.url).hostname.replace(/^www\./, '')]).includes(host))) reject('invalid_reference_url');
  u.hash = ''; for (const k of [...u.searchParams.keys()]) if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  u.searchParams.sort(); return u.href;
}
const unique = values => new Set(values).size === values.length;
export function validateDossier(value) {
  if (!value || value.schema_version !== 1 || !string(value.event_key, 8, 180) || typeof value.category !== 'string' || !Object.hasOwn(taxonomy,value.category)
    || (value.subcategory !== null && !Object.hasOwn(taxonomy[value.category].subcategories, value.subcategory))
    || !Array.isArray(value.documents) || value.documents.length > MAX_DOCUMENTS || !Array.isArray(value.claims) || value.claims.length > 16) reject('invalid_dossier');
  if (!unique(value.claims.map(c => String(c.text).normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim()))) reject('duplicate_claim');
  if (Buffer.byteLength(JSON.stringify(value)) > 180000 || !unique(value.documents.map(d => d.id)) || !unique(value.claims.map(c => c.id))) reject('invalid_dossier');
  const urls = [];
  for (const d of value.documents) {
    const ref = referenceCatalog.find(r => r.id === d.reference_id);
    if (!ref || !/^E[1-9]\d?$/.test(d.id ?? '') || !string(d.title, 3, 220) || !string(d.text, 80, 12000)
      || dossierHash(d.text) !== d.content_hash || !string(d.rights_reference, 8, 500)
      || !(d.published_at === null || (typeof d.published_at === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(d.published_at) && Number.isFinite(Date.parse(d.published_at)) && new Date(d.published_at.slice(0,10)+'T12:00:00Z').toISOString().slice(0,10)===d.published_at.slice(0,10))) || !['primary', 'independent', 'derivative', 'context'].includes(d.kind)
      || typeof d.same_event !== 'boolean' || !string(d.independence_note, 0, 1000)) reject('invalid_dossier_document');
    urls.push(referenceUrl(d.url, ref)); referenceUrl(d.origin_url);
    if (d.kind === 'independent' && !string(d.independence_note, 20, 1000)) reject('independence_unverified');
  }
  if (!unique(urls)) reject('duplicate_document');
  const ids = new Set(value.documents.map(d => d.id));
  for (const claim of value.claims) {
    if (!/^C[1-9]\d?$/.test(claim.id ?? '') || !string(claim.text, 8, 500) || typeof claim.critical !== 'boolean'
      || !Array.isArray(claim.cells) || claim.cells.length !== ids.size || !unique(claim.cells.map(c => c.document_id))) reject('invalid_claim');
    for (const cell of claim.cells) {
      if (!ids.has(cell.document_id) || !['supports', 'contradicts', 'not_mentioned', 'unverifiable'].includes(cell.status)
        || !string(cell.quote, 0, 700) || !string(cell.note, 0, 500)) reject('invalid_claim_cell');
      if (['supports', 'contradicts'].includes(cell.status)) {
        const doc = value.documents.find(d => d.id === cell.document_id);
        if (cell.quote.length < 8 || !doc.text.includes(cell.quote)) reject('quote_not_in_document');
      } else if (cell.quote !== '') reject('invalid_claim_cell');
    }
  }
  const normalized=structuredClone(value);
  for(const doc of normalized.documents){const ref=referenceCatalog.find(r=>r.id===doc.reference_id);doc.url=referenceUrl(doc.url,ref);doc.origin_url=referenceUrl(doc.origin_url);doc.publisher_key=ref.publisher;}
  return normalized;
}
export function assessDossier(input, { comparisonVerified = false } = {}) {
  const d = validateDossier(input), docs = new Map(d.documents.map(doc => [doc.id, doc]));
  const claims = d.claims.map(c => {
    const supports = c.cells.filter(v => v.status === 'supports');
    const supportedDocs = supports.map(v => docs.get(v.document_id));
    const corroborated = supportedDocs.some(a => supportedDocs.some(b => a.origin_url !== b.origin_url && a.publisher_key !== b.publisher_key));
    const status = c.cells.some(v => v.status === 'contradicts') ? 'divergent' : c.cells.some(v => v.status === 'unverifiable') ? 'pending' : corroborated ? 'convergent' : 'pending';
    return { id: c.id, text: c.text, critical: c.critical, status, origins: [...new Set(supports.map(s => referenceUrl(docs.get(s.document_id).origin_url)))], cells: c.cells };
  });
  const used = new Set(claims.filter(c => c.status === 'convergent').flatMap(c => c.cells.filter(v => v.status === 'supports').map(v => v.document_id)));
  const primary = d.documents.filter(doc => doc.kind === 'primary' && used.has(doc.id));
  const independent = d.documents.filter(doc => doc.kind === 'independent' && used.has(doc.id)
    && primary.some(p => referenceUrl(p.origin_url) !== referenceUrl(doc.origin_url)
      && referenceCatalog.find(r => r.id === p.reference_id).publisher !== referenceCatalog.find(r => r.id === doc.reference_id).publisher));
  const total = claims.length, convergent = claims.filter(c => c.status === 'convergent').length;
  const blockers = [];
  if (!total) blockers.push('comparison_incomplete');
  if (!d.documents.length || d.documents.some(doc => !doc.same_event)) blockers.push('event_unverified');
  if (!primary.length || !independent.length) blockers.push('independence_unverified');
  if (!claims.some(c => c.critical) || claims.some(c => c.critical && c.status !== 'convergent')) blockers.push('critical_fact_unresolved');
  if (total && convergent * 100 < total * 90) blockers.push('compatibility_below_90');
  if (!comparisonVerified) blockers.push('comparison_required');
  return { criterion: CRITERION, hash: dossierHash(d), total, convergent, percentage: total ? 100 * convergent / total : null,
    eligible: blockers.length === 0, comparison_verified: comparisonVerified, blockers, claims, documents: d.documents.length,
    publishers: new Set(d.documents.map(doc => referenceCatalog.find(r => r.id === doc.reference_id).publisher)).size,
    origins: new Set(d.documents.map(doc => referenceUrl(doc.origin_url))).size,
    independent_analyses: independent.length };
}
export function approvedEvidence(dossier, verification) {
  const d = validateDossier(dossier);
  const assessment = assessDossier(d, { comparisonVerified: verification?.hash === dossierHash(d) && !!verification?.actor_id });
  if (!assessment.eligible) reject(assessment.blockers[0]);
  // Only verified convergent facts enter the generation context. Originals and
  // contradictions stay in the versioned dossier; never silently excerpt them away.
  return d.documents.map(doc => {
    const claims = assessment.claims.filter(c => c.status === 'convergent' && c.cells.some(v => v.document_id === doc.id && v.status === 'supports'));
    if (!claims.length) return null;
    const text = [...new Set(claims.map(c => c.cells.find(v => v.document_id === doc.id).quote))].join('\n');
    return { id: doc.id, source_id: doc.reference_id, title: doc.title, url: doc.url, published_at: doc.published_at,
      rights_reference: doc.rights_reference, text, content_hash: dossierHash(text), claim_ids: claims.map(c => c.id) };
  }).filter(Boolean);
}
export function validateComparison(value, dossier) {
  if (!value || Object.keys(value).join() !== 'claims' || !Array.isArray(value.claims)) reject('invalid_comparison');
  return validateDossier({ ...dossier, claims: value.claims });
}
export const comparisonSchema = { type: 'object', additionalProperties: false, required: ['claims'], properties: { claims: { type: 'array', maxItems: 16, items: {
  type: 'object', additionalProperties: false, required: ['id', 'text', 'critical', 'cells'], properties: {
    id: { type: 'string', pattern: '^C[1-9]\\d?$' }, text: { type: 'string', minLength: 8, maxLength: 500 }, critical: { type: 'boolean' }, cells: { type: 'array', items: {
      type: 'object', additionalProperties: false, required: ['document_id', 'status', 'quote', 'note'], properties: {
        document_id: { type: 'string', pattern: '^E[1-9]\\d?$' }, status: { type: 'string', enum: ['supports', 'contradicts', 'not_mentioned', 'unverifiable'] }, quote: { type: 'string', maxLength: 240 }, note: { type: 'string', maxLength: 240 },
      },
    } },
  },
} } } };
