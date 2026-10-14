-- SED's current edital, published on the official Santa Catarina government host.
insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,
  crawl_interval_hours,notes
) values (
  'sed-novos-valores-2026','SED — estágio Novos Valores 2026',
  'Secretaria de Estado da Educação de Santa Catarina','SED-SC','state_government',
  'https://www.sea.sc.gov.br/',array['www.sea.sc.gov.br'],
  array['/wp-content/uploads/2026/02/'],
  array['https://www.sea.sc.gov.br/wp-content/uploads/2026/02/Edital-388.2026-DOE-n.-22698.pdf'],
  'html',array['mixed'],array['Santa Catarina'],array['carreira'],85,true,'verified',
  'operator_authorized_agent',
  'https://www.sea.sc.gov.br/wp-content/uploads/2026/02/Edital-388.2026-DOE-n.-22698.pdf',
  now(),'codex:official-source-review',now(),24,
  'Edital SED 388/2026 verificado em 14/10/2026, em PDF oficial hospedado pela SEA. Inscrições via instituição de ensino conveniada até 30/11/2026; estágio para estudantes de 16 anos ou mais, com bolsas de R$ 380 a R$ 500 e auxílio-transporte. Uma edição, uma ficha; vagas individuais não são multiplicadas.'
)
on conflict (id) do nothing;
