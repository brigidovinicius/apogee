-- The announcement's original URL redirects to this same-organizer canonical URL.
-- Exact destination passed robots and fetchOfficialResource on the VPS on 15/10/2026
-- using the final three-path allowlist, before this correction was implemented.
update official_sources set
 allowed_path_prefixes=array_append(allowed_path_prefixes,'/intercambio-cultural-cps-2026/'),
 robots_checked_at=now(),updated_at=now(),
 notes=coalesce(notes,'') || ' URL canônica adicional auditada na VPS: https://arinter.cps.sp.gov.br/intercambio-cultural-cps-2026/; mesmo conteúdo/hash da notícia de origem. Não permitir outros caminhos ou domínios.'
where id='cps-cultural-15-2026'
 and base_url='https://arinter.cps.sp.gov.br/editais-abertos/'
 and allowed_domains=array['arinter.cps.sp.gov.br']::text[]
 and not ('/intercambio-cultural-cps-2026/'=any(allowed_path_prefixes));
