-- Exact-URL audit: references/source-audit-climat-pdse-20261014.json.
-- CLIMAT stays paused: mandatory ANID robots403; old secretariat content unrelated.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
 audience_scope,geographic_scope,categories,priority,active,verification_status,verification_method,verification_evidence_url,
 verified_at,verified_by,robots_checked_at,terms_checked_at,crawl_interval_hours,notes
) values (
 'capes-pdse-22-2026','CAPES — Doutorado-sanduíche PDSE (Edital 22/2026)','Coordenação de Aperfeiçoamento de Pessoal de Nível Superior','CAPES','government_foundation',
 'https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/bolsas-e-auxilios-internacionais/encontre-aqui/paises/multinacional/programa-de-doutorado-sanduiche-no-exterior-pdse',
 array['www.gov.br'],
 array['/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/bolsas-e-auxilios-internacionais/encontre-aqui/paises/multinacional/programa-de-doutorado-sanduiche-no-exterior-pdse','/capes/pt-br/assuntos/noticias-defeso-eleitoral/doutorado-sanduiche-no-exterior-tem-prazos-e-criterios-de-selecao-alterados'],
 array['https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/bolsas-e-auxilios-internacionais/encontre-aqui/paises/multinacional/programa-de-doutorado-sanduiche-no-exterior-pdse'],'html',
 array['postgraduate_student'],array[]::text[],array['bolsas','intercambios','pesquisa'],80,true,'verified',
 'operator_authorized_agent','https://www.gov.br/capes/pt-br/assuntos/noticias-defeso-eleitoral/doutorado-sanduiche-no-exterior-tem-prazos-e-criterios-de-selecao-alterados',
 '2026-10-15T00:37:43Z','codex:operator-authorized-agent','2026-10-15T00:37:43Z','2026-10-15T00:37:43Z',24,
 'Auditoria individual 14/10/2026 local: duas URLs CAPES HTTP200, sem redirect, robots permitido. Programa e retificação confirmam janela nacional20/10–18/11/2026, término17hBrasília; seleção interna pelasIES até16/10, prazo local pode ser anterior. Uma seleção para doutorandos de cursos reconhecidos pelaCAPES, após seleçãoPPG/IES, cota e homologação; regrasCAPES-Global.edu devem ser consultadas. Estado futuro antes da abertura nacional, sem declarar ingresso aberto em todaIES. Benefícios/duração4–9meses comprovados, sem valores monetários ou geografia inventados. Não consultar/submeter PDFs/formulários. Duas páginas por coleta/rechecagem24h; indisponibilidade preserva evidência; conflito/terminal/prazo vencido retira. Encerramento apenas da fase interna não encerra automaticamente etapa nacional. Referência source-audit-climat-pdse-20261014.json.'
) on conflict(id) do nothing;

update discovery_targets set official_verified_at='2026-10-15T00:37:43Z',
 official_verified_url='https://www.gov.br/capes/pt-br/acesso-a-informacao/acoes-e-programas/bolsas/bolsas-e-auxilios-internacionais/encontre-aqui/paises/multinacional/programa-de-doutorado-sanduiche-no-exterior-pdse',
 official_verified_by='codex:operator-authorized-agent',
 official_review_note='Auditoria individual14/10 local: PDAI23/2026 e PDSE22/2026 atendidos por coletores próprios; monitor amplo permanece pausado. PDSE nacional futuro20/10–18/11, seleção internaIES até16/10. CLIMAT continua pausado: ANIDrobots403 impede auditoria da plataforma obrigatória; domínio antigo da secretaria retornou conteúdo alheio; CNRS confirma15/10 apenasdata, CAPES29/10 não substitui etapa internacional. Não contornar bloqueios nem seguir links do domínio alheio. Evidência references/source-audit-climat-pdse-20261014.json.'
where id='xlsx-20261014-021-capes' and not enabled;
