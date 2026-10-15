-- Exact pages fetched with the production fetcher from the existing VPS on 15/10/2026.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,
 verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,crawl_interval_hours,notes
) values (
 'cps-cultural-15-2026','CPS — 15º Intercâmbio Cultural','Centro Paula Souza','CPS','official_reference',
 'https://arinter.cps.sp.gov.br/editais-abertos/',array['arinter.cps.sp.gov.br'],
 array['/editais-abertos/','/intercambio-cultural-do-centro-paula-souza-abre-inscricoes-para-mais-de-500-bolsas-internacionais-em-2027/'],
 array['https://arinter.cps.sp.gov.br/editais-abertos/'],'html',array['mixed'],array['SP'],array['intercambios','bolsas'],60,true,'verified',
 'operator_authorized_agent','https://arinter.cps.sp.gov.br/editais-abertos/',now(),'codex:operator-authorized-agent',now(),24,
 'VPS: robots e duas páginas HTML passaram no fetcher de produção antes da implementação. Uma edição: ARI 033 a 038/2026 agrupados, sem multiplicar modalidades/destinos/vagas. Inscrições 23/09 a 17/10/2026; embarques 2027. Bolsa e critérios gerais conferidos na notícia própria, requisitos específicos nos editais. Geografia de destino não inferida da sede SP. Falha parcial preserva para retry; encerramento confirmado e prazo retiram da vitrine. Nenhum formulário/plataforma de inscrição é consultado.'
) on conflict(id) do nothing;

-- Discovery records links privately; a lead cannot self-activate a source or publish a card.
insert into discovery_targets (
 id,name,organizer,kind,official_url,topics,priority,enabled,check_interval_hours,evidence_url,
 official_verified_at,official_verified_url,official_verified_by,official_review_note,notes
)
select id,name,organizer,'site',url,topics,50,true,24,url,now(),url,'codex:operator-authorized-agent',
 'URL exata e domínio do organizador auditados; robots e acesso confirmados na VPS antes da ativação. Limite de uma página/dia, até 30 links; destinos não são consultados e ficam privados para auditoria.',
 'Monitor diário sem serviços pagos ou GitHub Actions agendado. Não confundir link descoberto com oportunidade publicada, nem sede com elegibilidade.'
from (values
 ('cps-arinter-open-calls','CPS ARInter — novas chamadas','Centro Paula Souza','https://arinter.cps.sp.gov.br/editais-abertos/',array['intercambios','bolsas']),
 ('embraer-careers-internships','Embraer — novas chamadas de estágio','Embraer','https://www.embraer.com/corporate-careers/estagio/pt/',array['carreira']),
 ('ufsc-sinter-open-calls','UFSC SINTER — novas chamadas','Universidade Federal de Santa Catarina','https://sinter.ufsc.br/editais-abertos/?lang=pt',array['intercambios','carreira','bolsas'])
) as audited(id,name,organizer,url,topics)
where not exists (select 1 from discovery_targets target where target.official_url=audited.url)
on conflict(id) do nothing;
