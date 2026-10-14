insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,
  crawl_interval_hours,notes
) values (
  'ifsc-technical-courses-2027','IFSC — cursos técnicos 2027.1',
  'Instituto Federal de Santa Catarina','IFSC','federal_institute',
  'https://www.ifsc.edu.br/tecnicos',array['www.ifsc.edu.br','ifsc.edu.br'],
  array['/tecnicos'],array['https://www.ifsc.edu.br/tecnicos'],'html',
  array['mixed','high_school_student'],array['Santa Catarina'],array['formacao'],85,true,'verified',
  'operator_authorized_agent','https://www.ifsc.edu.br/tecnicos',
  now(),'codex:official-source-review',now(),24,
  'Página e robots.txt oficiais verificados em 14/10/2026. Seleção 2027.1 com inscrições até 22/10/2026 por prova e até 06/11/2026 por sorteio ou ordem de inscrição. Uma ficha por curso, modalidade e campus com vagas confirmadas; turnos e vagas não são fichas adicionais. Cursos EaD e campus com nome geográfico ambíguo não recebem cidade por inferência. Candidatura no sistema indicado pelo organizador, sem monitorar sites de terceiros.'
)
on conflict (id) do nothing;
