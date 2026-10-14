insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,
  crawl_interval_hours,notes
) values (
  'senac-sc-psg-open-cohorts','Senac SC — turmas com vagas gratuitas PSG',
  'Senac Santa Catarina','Senac SC','official_reference',
  'https://portal.sc.senac.br/cursos-gratuitos',array['portal.sc.senac.br'],
  array['/cursos-gratuitos'],array['https://portal.sc.senac.br/cursos-gratuitos'],'html',
  array['mixed'],array['Santa Catarina'],array['formacao'],80,true,'verified',
  'operator_authorized_agent','https://portal.sc.senac.br/cursos-gratuitos',
  now(),'codex:official-source-review',now(),24,
  'Listagem oficial e interface verificadas em 14/10/2026: JSON incorporado à página com matrícula liberada, prazo e vagas PSG gratuitas. Uma ficha por curso, cidade e início; vagas, turnos e versões do plano não multiplicam a edição. Requisitos de renda, idade, escolaridade e conhecimento preservados. Cursos de aprendizagem condicionados a contrato de trabalho não contam como vagas de emprego. Registrar interesse não equivale a matrícula. robots.txt respondeu HTTP 200 com HTML sem diretivas de bloqueio. Uma página por coleta diária, sem API externa ou navegador automatizado.'
)
on conflict (id) do nothing;
