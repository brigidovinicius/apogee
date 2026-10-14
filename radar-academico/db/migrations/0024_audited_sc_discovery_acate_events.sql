-- Individual exact-URL audits: references/source-audit-sc-20261014.json.
-- Discovery monitors remain private and cannot publish opportunities.
update discovery_targets set enabled=true,official_verified_at='2026-10-14T20:42:11Z',
  official_verified_url=official_url,official_verified_by='codex:operator-authorized-agent',
  official_review_note='Método operator_authorized_agent, 14/10/2026. Domínio institucional oficial; URL exata HTTP 200, sem autenticação; robots.txt permitido (UFSC: ausência HTTP 404). Coletor limitado compatível; listagem de notícias/editais como descoberta privada. Cada programa exige auditoria própria antes de publicação; não herdar localização, prazo ou elegibilidade. Evidência: references/source-audit-sc-20261014.json.'
where (id,official_url) in (
  ('xlsx-20261014-001-ufsc','https://noticias.ufsc.br'),
  ('xlsx-20261014-004-ifsc','https://www.ifsc.edu.br/editais'),
  ('xlsx-20261014-024-fapesc','https://fapesc.sc.gov.br')
) and official_verified_at is null and not enabled;

insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,terms_checked_at,
  crawl_interval_hours,notes
) values (
  'acate-audited-events','ACATE — edições próprias auditadas','Associação Catarinense de Tecnologia','ACATE',
  'official_reference','https://www.acate.com.br/agenda-de-eventos/',array['www.acate.com.br'],
  array['/agenda-de-eventos/'],array['https://www.acate.com.br/agenda-de-eventos/'],'html',
  array['mixed'],array[]::text[],array['eventos'],90,true,'verified',
  'operator_authorized_agent','https://www.acate.com.br/agenda-de-eventos/',
  '2026-10-14T20:45:28Z','codex:operator-authorized-agent','2026-10-14T20:45:28Z','2026-10-14T20:45:28Z',24,
  'Agenda e três URLs exatas auditadas em 14/10/2026; robots permitido, acesso público sem login. Somente Decola Rio do Sul/Lages 2026 e Peopletech Summit 2026; outras páginas da agenda exigem auditoria do organizador. Inscreva-se oficial comprova chamada atual; não consultar Sympla/terceiros, nem inferir vagas ou gratuidade. Início sem fuso explícito permanece data; retirada no começo do dia. Cada encontro regional é uma edição independente por data/página. Adaptador recusa prazo mencionado inválido, mudança de estrutura ou ausência de chamada. Prioridade SC operacional somente até 18/10; valor fixo não cria filtro geográfico permanente. Evidência: references/source-audit-sc-20261014.json.'
) on conflict(id) do nothing;
