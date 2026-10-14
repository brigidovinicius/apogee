-- Exact official URL audited with the bounded transport on 14/10/2026.
-- Each course/campus is one programme; shifts and places do not create cards.
insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,terms_checked_at,
  crawl_interval_hours,notes
) values (
  'ifsc-qualification-courses-2026-2','IFSC — qualificação e idiomas 2026.2','Instituto Federal de Santa Catarina','IFSC',
  'federal_institute','https://www.ifsc.edu.br/qualifica',array['www.ifsc.edu.br'],array['/qualifica'],
  array['https://www.ifsc.edu.br/qualifica'],'html',array['mixed'],array[]::text[],array['formacao'],90,true,'verified',
  'operator_authorized_agent','https://www.ifsc.edu.br/qualifica','2026-10-14T21:24:57Z','codex:operator-authorized-agent',
  '2026-10-14T21:24:57Z','2026-10-14T21:24:57Z',24,
  'URL exata HTTP 200, sem redirecionamento/autenticação; robots permitido e coletor limitado compatível. Listagem oficial dos editais 24 a 27/2026/2 comprova inscrições de 7 a 27/10/2026, cursos/vagas e gratuidade. Uma ficha por curso/câmpus; turnos consolidados, módulos e vagas não multiplicados. Requisitos variam por curso: consultar edital; não inferir endereço/localidade do nome do câmpus, nem bolsa ou remuneração. Campos de auditoria humana permanecem vazios. Fonte e evidências: references/source-audit-ifsc-qualification-20261014.json.'
) on conflict(id) do nothing;
