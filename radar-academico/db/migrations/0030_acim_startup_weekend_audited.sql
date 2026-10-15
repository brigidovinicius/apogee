-- Individually audited edition. Broad Techstars/Sebrae targets remain paused.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,
 audience_scope,geographic_scope,categories,priority,active,verification_status,verification_method,verification_evidence_url,
 verified_at,verified_by,robots_checked_at,terms_checked_at,crawl_interval_hours,notes
) values (
 'acim-startup-weekend-imbituba-2026','ACIM — Startup Weekend Imbituba, 2ª edição 2026','Associação Empresarial de Imbituba (ACIM)','ACIM','corporate_organizer',
 'https://www.acimimbituba.org/event-details/startup-weekend-imbituba-1',array['www.acimimbituba.org'],array['/event-details/startup-weekend-imbituba-1'],
 array['https://www.acimimbituba.org/event-details/startup-weekend-imbituba-1'],'html',array['mixed'],array['SC'],array['eventos'],85,true,'verified',
 'operator_authorized_agent','https://www.acimimbituba.org/event-details/startup-weekend-imbituba-1',
 '2026-10-15T01:29:11+00:00','codex:operator-authorized-agent','2026-10-15T01:29:11+00:00','2026-10-15T01:29:11+00:00',24,
 'Auditoria individual 14/10/2026 local: página própria ACIM HTTP200 sem redirect, robots permitido. Homepage da associação lista a edição; CNPJ e política de privacidade confirmam titularidade. JSON-LD EventScheduled/InStock concorda com data/local e ingressos visíveis: 06/11/2026 às 18h -03:00 até 08/11 às 20h, SCPAR Porto de Imbituba, SC. Prazo final não informado; retirar ao iniciar. Ingresso R$80 + taxa R$2, total R$82; sem compra ou gratuidade presumida. Uma ficha por edição, sem multiplicar dias, lotes, equipes ou ingressos. Idade/escolaridade/auxílio não comprovados. Coleta/rechecagem limitada a uma página diária; shell/indisponibilidade preserva para retry, conflitos e encerramento retiram. Não consultar checkout, API ou demais eventos. Evidência references/source-audit-startup-weekend-20261014.json.'
) on conflict(id) do nothing;

update discovery_targets set official_verified_at='2026-10-15T01:29:11+00:00',
 official_verified_url='https://www.acimimbituba.org/event-details/startup-weekend-imbituba-1',official_verified_by='codex:operator-authorized-agent',
 official_review_note='Auditoria 14/10 local: portal Techstars e calendário de eventos HTTP200, robots permitido; HTML recebido não comprova edições/inscrições individuais. Portal amplo permanece pausado. Edição própria ACIM Startup Weekend Imbituba 2ª edição 2026 validada e atendida por coletor específico de uma página, ingresso pago R$82 e início 06/11 às18h BRT; não ativa calendário global. Referência source-audit-startup-weekend-20261014.json.'
where id='xlsx-20261014-064-startup-weekend-techstars' and not enabled;

update discovery_targets set official_review_note='Auditoria 14/10 local: URL candidata redireciona via lowercase para conteúdo genérico. Calendário SC HTTP200, renderizado no cliente; texto de apoio/fomento não comprova organização individual. Fonte ampla permanece pausada; não usar listagem como prova de vagas, nem executar APIs privadas ou serviços pagos. Edição ACIM auditada separadamente. Referência source-audit-startup-weekend-20261014.json.'
where id='xlsx-20261014-063-sebrae-startups' and not enabled;
