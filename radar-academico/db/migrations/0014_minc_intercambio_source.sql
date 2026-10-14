-- Official MinC listing and one edition-specific detail page. No human audit is implied.
insert into official_sources (
  id,name,institution_name,institution_acronym,source_type,base_url,
  allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
  audience_scope,geographic_scope,categories,priority,active,verification_status,
  verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,terms_checked_at,
  crawl_interval_hours,notes
) values (
  'minc-intercambio-audiovisual-2026','MinC — Intercâmbio Audiovisual 2026','Ministério da Cultura','MinC',
  'federal_government','https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento',
  array['www.gov.br'],
  array['/cultura/pt-br/assuntos/editais/inscricoes-em-andamento'],
  array['https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento'],'html',
  array['mixed'],array['Brasil'],array['intercambios','bolsas'],80,true,'verified',
  'operator_authorized_agent','https://www.gov.br/cultura/pt-br/assuntos/editais/inscricoes-em-andamento/edital-de-intercambio-cultural-circulacao-e-participacao-audiovisual-no-exterior',now(),'codex:official-source-review',now(),now(),
  24,'Edital oficial e PDF verificados em 14/10/2026. O prazo é 06/11/2026 às 18h de Brasília, sujeito a suspensão antecipada por esgotamento. O PDF exige pessoa física brasileira maior de 18 anos, um ano de atuação em audiovisual e participação elegível no exterior.'
)
on conflict (id) do nothing;
