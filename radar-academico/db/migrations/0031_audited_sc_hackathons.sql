-- Two official organizer editions, not an unrestricted event calendar.
-- Evidence: references/source-audit-sc-hackathons-20261015.json.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,
 verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,crawl_interval_hours,notes
)
select id,name,institution,acronym,'corporate_organizer',url,array[host],array[path],array[url],'html',
 array['mixed'],array['SC'],array['competicoes','eventos'],80,true,'verified','operator_authorized_agent',url,
 now(),'codex:operator-authorized-agent',now(),24,note
from (values
 ('niavi-starttech-2026','NIAVI/ACIRS — StartTech 2026','NIAVI — Núcleo de Tecnologia da Informação da ACIRS','NIAVI',
  'https://www.niavistart.tech/','www.niavistart.tech','/',
  'Auditoria individual 15/10/2026: site da edição e política/regulamento identificam NIAVI/ACIRS como organizadora. Inscrições abertas, contador agregado de vagas e formulário próprio. Hackathon gratuito para ensino médio em Rio do Sul/SC, 24/10/2026. Preferência 15–18 anos, escola pública prioritária; particulares em espera, menores exigem responsável. Kit e alimentação, sem transporte. Banco de talentos não é estágio. Uma ficha por edição; consultar somente página pública, sem formulário, API ou dados pessoais. Rechecagem diária, retirada ao iniciar, lotação ou encerramento; não inventar deadline ou valor de prêmio.'),
 ('orion-hackathon-october-2026','Orion Parque — HackathOrion outubro 2026','Orion Parque Tecnológico','ORION',
  'https://www.orionparque.com/2026/09/15/inscricoes-abertas-para-o-hackathorion-maratona-de-inovacao-retorna-em-outubro-para-conectar-talentos-e-desafios-reais/',
  'www.orionparque.com','/2026/09/15/inscricoes-abertas-para-o-hackathorion-maratona-de-inovacao-retorna-em-outubro-para-conectar-talentos-e-desafios-reais/',
  'Auditoria individual 15/10/2026: notícia própria identifica Orion na realização, vagas limitadas, inscrição aberta gratuita e CTA da edição. Lages/SC, 16–17/10/2026, programação não obrigatória; idade mínima e valor de prêmio não comprovados. Uma edição, não equipes/vagas. Só consultar notícia oficial; não acessar destino Sympla. Sem prazo final, retirada no início do dia confirmado em Brasília. Rechecagem diária e falha técnica preserva para retry.')
) v(id,name,institution,acronym,url,host,path,note)
on conflict(id) do nothing;
