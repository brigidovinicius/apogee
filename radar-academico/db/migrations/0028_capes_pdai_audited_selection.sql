-- Two exact CAPES pages audited: references/source-audit-capes-pdai-20261014.json.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
 audience_scope,geographic_scope,categories,priority,active,verification_status,verification_method,verification_evidence_url,
 verified_at,verified_by,robots_checked_at,terms_checked_at,crawl_interval_hours,notes
) values (
 'capes-pdai-23-2026','CAPES — bolsas PDAI (Edital 23/2026)','Coordenação de Aperfeiçoamento de Pessoal de Nível Superior','CAPES','government_foundation',
 'https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/programas-estrategicos/desenvolvimento-regional/programa-de-desenvolvimento-academico-indigena-pdai',
 array['www.gov.br'],
 array['/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/programas-estrategicos/desenvolvimento-regional/programa-de-desenvolvimento-academico-indigena-pdai','/capes/pt-br/assuntos/noticias-defeso-eleitoral/prazo-de-inscricao-no-pdai-e-prorrogado-ate-26-de-outubro'],
 array['https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/programas-estrategicos/desenvolvimento-regional/programa-de-desenvolvimento-academico-indigena-pdai'],'html',
 array['mixed'],array[]::text[],array['bolsas','pesquisa'],80,true,'verified',
 'operator_authorized_agent','https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/programas-estrategicos/desenvolvimento-regional/programa-de-desenvolvimento-academico-indigena-pdai',
 '2026-10-14T23:49:15Z','codex:operator-authorized-agent','2026-10-14T23:49:15Z','2026-10-14T23:49:15Z',24,
 'Auditoria individual 14/10/2026: CAPES organizadora oficial, dois caminhos exatos HTTP200 sem redirect, robots permitido, acesso público. Uma seleção Edital23/2026 para indígenas em PPGs participantes; calendário do programa e prorrogação oficial devem coincidir, até26/10/2026 às23h59 de Brasília. Bolsa mensal de mestradoR$2100/até24meses e doutoradoR$3100/até48meses, após seleção. Não multiplicar bolsas/modalidades/rodadas. Não inventar URL de inscrição, nacionalidade, localização ou elegibilidade ampla. ManualSICAPES/edital/PPGs na fonte oficial; não consultar PDF/formulário. Duas páginas por ciclo/rechecagem24h; falha de transporte/identidade preserva evidência e tenta novamente; conflito/encerramento retira ficha. Referência: source-audit-capes-pdai-20261014.json. CLIMAT-AMSUD/PDSE não ativados nesta auditoria.'
) on conflict(id) do nothing;

update discovery_targets set official_verified_at='2026-10-14T23:49:15Z',
 official_verified_url='https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/programas-estrategicos/desenvolvimento-regional/programa-de-desenvolvimento-academico-indigena-pdai',
 official_verified_by='codex:operator-authorized-agent',
 official_review_note='Auditoria operator_authorized_agent14/10/2026: hub importado404; somente PDAI23/2026 ativo por coletor dedicado capes-pdai-23-2026, calendário e prorrogação oficiais auditados. Monitor amplo permanece pausado. CLIMAT depende de segundo calendário internacional; PDSE futuro/institucional exige adaptação própria; demais editais não auditados. Evidência references/source-audit-capes-pdai-20261014.json.'
where id='xlsx-20261014-021-capes' and official_url='https://www.gov.br/capes/pt-br/assuntos/editais-e-resultados' and not enabled;
