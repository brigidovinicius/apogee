-- FAPESP is the funder's own current-open-fellowships portal, not an aggregator.
alter table opportunities drop constraint if exists opportunities_application_route_check;
alter table opportunities add constraint opportunities_application_route_check
  check (application_route in ('direct_student_application','direct_application','application_via_university','application_via_department','application_via_professor','application_via_project_coordinator','institutional_call','invitation_only','unclear'));

insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,terms_checked_at,
  crawl_interval_hours,notes
) values (
  'fapesp-open-fellowships','FAPESP — Oportunidades de Bolsas','Fundação de Amparo à Pesquisa do Estado de São Paulo','FAPESP',
  'government_foundation','https://fapesp.br/oportunidades/',
  array['fapesp.br','www.fapesp.br'],array['/oportunidades/'],
  array['https://fapesp.br/oportunidades/'],'html',
  array['mixed'],array[]::text[],array['bolsas','pesquisa'],95,true,'verified',
  'operator_authorized_agent','https://fapesp.br/oportunidades/',now(),'codex:official-source-review',now(),null,
  24,'Portal oficial da própria FAPESP, robots.txt verificado em 14/10/2026. Somente páginas individuais com prazo, projeto e rota de candidatura explícitos são publicadas. Lista de vagas abertas também é conferida na rechecagem. Cidade sem UF comprovada fica sem localização estruturada.'
)
on conflict (id) do nothing;
