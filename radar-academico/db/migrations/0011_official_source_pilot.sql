-- Small official-source pilot. Each source has a bounded listing and exact host/path allowlist.
-- Agent review is recorded separately; human audit fields remain untouched.
alter table official_sources
  add column if not exists verification_method text,
  add column if not exists verification_evidence_url text,
  add column if not exists verified_at timestamptz,
  add column if not exists verified_by text;

comment on column official_sources.verification_method is 'How the official source was checked; does not imply a human audit.';
comment on column official_sources.verification_evidence_url is 'Official page used for the source verification.';

insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,terms_checked_at,
  crawl_interval_hours,notes
) values (
  'cnpq-chamadas-abertas-2026','Chamadas abertas do CNPq','CNPq','CNPq',
  'federal_government','https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas',
  array['www.gov.br'],
  array['/cnpq/pt-br/chamadas/Busca_abertas','/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/'],
  array['https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas'],'html',
  array[]::text[],array['Brasil'],array['bolsas','pesquisa'],90,true,'verified',
  'operator_authorized_agent','https://www.gov.br/cnpq/pt-br/chamadas/Busca_abertas',now(),'codex:official-source-review',now(),now(),
  24,'Página oficial e robots.txt conferidos em 14/10/2026. Apenas chamadas com prazo, público e candidatura comprovados podem ser publicadas.'
), (
  'nasa-space-apps-2026','NASA Space Apps Challenge 2026','NASA Space Apps Challenge','NASA',
  'official_reference','https://www.spaceappschallenge.org/2026/',
  array['www.spaceappschallenge.org'],
  array['/blog/explore-the-next-frontier-at-the-2026-nasa-space-apps-challenge/','/2026/'],
  array['https://www.spaceappschallenge.org/blog/explore-the-next-frontier-at-the-2026-nasa-space-apps-challenge/'],'html',
  array[]::text[],array['Global'],array['competicoes','eventos'],85,true,'verified',
  'operator_authorized_agent','https://www.spaceappschallenge.org/2026/',now(),'codex:official-source-review',now(),now(),
  24,'Página oficial, regras públicas e robots.txt conferidos em 14/10/2026. Edição global com opção virtual; não atribuir país, UF ou cidade sem evidência da edição local.'
)
on conflict (id) do nothing;
