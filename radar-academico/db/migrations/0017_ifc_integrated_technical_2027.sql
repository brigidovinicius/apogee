-- The organizer's official 2027 selection lists independently selectable courses
-- by campus. Each campus/course is one programme, regardless of its seat count.
insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,
  crawl_interval_hours,notes
) values (
  'ifc-integrated-technical-2027','IFC — cursos técnicos integrados 2027',
  'Instituto Federal Catarinense','IFC','federal_institute',
  'https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/',
  array['ingresso.ifc.edu.br'],array['/seletivos/processo-seletivo-2027/integrados/'],
  array['https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/cursos/'],'html',
  array['high_school_student'],array['Santa Catarina'],array['formacao'],85,true,'verified',
  'operator_authorized_agent',
  'https://ingresso.ifc.edu.br/seletivos/processo-seletivo-2027/integrados/inscricoes/',
  now(),'codex:official-source-review',now(),24,
  'Portal de ingresso do organizador e robots.txt verificados em 14/10/2026. Inscrições até 26/10/2026 e taxa de R$ 50. Uma ficha por curso/campus com vagas próprias; não contar vagas ou turmas como fichas. A preferência por SC até 18/10/2026 é operacional e não altera o ranqueamento permanente.'
)
on conflict (id) do nothing;
