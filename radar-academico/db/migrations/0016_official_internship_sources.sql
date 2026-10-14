-- Organizers' own pages: one municipal internship listing and one company programme.
alter table official_sources drop constraint if exists official_sources_source_type_check;
alter table official_sources add constraint official_sources_source_type_check check (source_type in (
  'federal_government','state_government','municipal_government','government_foundation',
  'federal_university','state_university','federal_institute','public_research_institution',
  'official_reference','corporate_organizer'
));

insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,
  crawl_interval_hours,notes
) values (
  'sjc-open-internships','São José dos Campos — estágios abertos','Prefeitura de São José dos Campos','PMSJC',
  'municipal_government','https://servicos.sjc.sp.gov.br/concurso/',
  array['servicos.sjc.sp.gov.br'],array['/concurso/'],
  array['https://servicos.sjc.sp.gov.br/concurso/abertos.aspx'],'html',
  array['mixed'],array[]::text[],array['carreira'],85,true,'verified',
  'operator_authorized_agent','https://servicos.sjc.sp.gov.br/concurso/concurso_detalhe.aspx?codigo=192',now(),'codex:official-source-review',now(),
  24,'Portal oficial municipal. Listagem de inscrições abertas e edital mensal verificados em 14/10/2026. O edital de outubro encerra em 15/10/2026 às 23h59 de São Paulo. A candidatura ocorre em sistema indicado pela prefeitura; esse site externo não é monitorado.'
),(
  'braskem-internship-programme','Braskem — Programa de Estágio 2027','Braskem','Braskem',
  'corporate_organizer','https://www.braskem.com.br/',
  array['www.braskem.com.br'],array['/bahia-release/'],
  array['https://www.braskem.com.br/bahia-release/braskem-abre-inscricoes-para-programa-de-estagio-2027-com-mais-de-100-vagas-em-cinco-estados'],'html',
  array['undergraduate_student'],array[]::text[],array['carreira'],85,true,'verified',
  'operator_authorized_agent','https://www.braskem.com.br/bahia-release/braskem-abre-inscricoes-para-programa-de-estagio-2027-com-mais-de-100-vagas-em-cinco-estados',now(),'codex:official-source-review',now(),
  24,'Comunicado oficial da organizadora verificado em 14/10/2026: uma edição do programa 2027, 120 vagas em cinco estados, inscrições até 30/10/2026. As vagas não são duplicadas por município; site externo de candidatura não é monitorado.'
)
on conflict (id) do nothing;
