-- Exact-URL audit: references/source-audit-scholarships-20261014.json.
-- One programme/selection, regardless of grants or semester choices.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
 audience_scope,geographic_scope,categories,priority,active,verification_status,verification_method,verification_evidence_url,
 verified_at,verified_by,robots_checked_at,terms_checked_at,crawl_interval_hours,notes
) values (
 'fulbright-ruth-cardoso-selection-2026','Fulbright — Cátedra Ruth Cardoso (seleção 2026)',
 'Comissão Fulbright Brasil / Georgetown University','Fulbright','official_reference',
 'https://fulbright.org.br/bolsas-para-brasileiros/catedra-dra-ruth-cardoso-georgetown/',
 array['fulbright.org.br'],array['/bolsas-para-brasileiros/catedra-dra-ruth-cardoso-georgetown/'],
 array['https://fulbright.org.br/bolsas-para-brasileiros/catedra-dra-ruth-cardoso-georgetown/'],'html',
 array['researcher'],array[]::text[],array['bolsas','intercambios','pesquisa'],75,true,'verified',
 'operator_authorized_agent','https://fulbright.org.br/quem-somos/',
 '2026-10-14T23:29:14Z','codex:operator-authorized-agent','2026-10-14T23:29:14Z','2026-10-14T23:29:14Z',24,
 'Auditoria individual 14/10/2026: organizador/coorganizador oficial, URLs exatas HTTP200 sem redirect, robots permitido. URL importada /bolsas/ retornou404; catálogo correto /bolsas-para-brasileiros/. Uma seleção própria Ruth Cardoso/Georgetown aberta até15/11/2026, candidatura IIEfvsp2027 indicada oficialmente. Exige doutorado até30/07/2016, nacionalidade brasileira sem norte-americana e inglês; benefícios conforme fonte, sem valor mensal inferido. Fonte limitada à página exata; não seguir formulário externo/PDF. Rechecagem24h pelo mesmo adaptador; avisos terminais/CTA ausente/último edital/ano diferente retiram ficha. Falha de rede/identidade preserva evidência e tenta novamente. País EUA comprovado, UF/cidade nulas. Outras chamadas previstas para2027 não são vagas abertas. Evidência: references/source-audit-scholarships-20261014.json.'
) on conflict(id) do nothing;

-- This imported monitor stays paused because the selection has a dedicated collector.
update discovery_targets set official_verified_at='2026-10-14T23:29:14Z',
 official_verified_url='https://fulbright.org.br/bolsas-para-brasileiros/',
 official_verified_by='codex:operator-authorized-agent',
 official_review_note='Auditoria operator_authorized_agent14/10/2026: URL importada /bolsas/404; catálogo oficial correto auditado /bolsas-para-brasileiros/200, robots permitido. Uma seleção própria ativa pelo coletor fulbright-ruth-cardoso-selection-2026; monitor genérico permanece pausado para evitar duplicação e programas2027 apenas previstos. Evidência references/source-audit-scholarships-20261014.json.'
where id='xlsx-20261014-053-fulbright-brasil' and official_url='https://fulbright.org.br/bolsas/' and not enabled;

update discovery_targets set official_review_note='Auditoria individual operator_authorized_agent14/10/2026: homepage200 com desafio de navegador; editais.ifc.edu.br e extensao.ifc.edu.br indisponíveis para transporte seguro existente. Mantido pausado sem contornar desafio; cursos técnicos ingresso.ifc.edu.br preservados. Evidência references/source-audit-scholarships-20261014.json.'
where id='xlsx-20261014-020-ifc' and official_url='https://ifc.edu.br' and not enabled;
