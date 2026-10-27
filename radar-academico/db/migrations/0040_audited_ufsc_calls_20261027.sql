-- Configuration only. Activate each source separately after a production audit.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,crawl_interval_hours,notes
)
select id,name,'Universidade Federal de Santa Catarina','UFSC','federal_university',url,
 domains,paths,array[url],'html',array[audience],array[]::text[],categories,85,false,'pending',24,
 'Auditoria 27/10/2026: chamada UFSC e segunda fonte oficial da edição. Referência source-audit-20261027.json. Pendente de revalidação e ativação na VPS. Preservar público e via de candidatura; sem cidade ou bolsa presumidas.'
from (values
 ('ufsc-proaa-2027','UFSC PROAA 2027 — propostas de extensão para ações afirmativas','mixed',
  'https://noticias.ufsc.br/2026/10/ufsc-abre-inscricoes-para-programa-de-bolsas-de-extensao-para-acoes-afirmativas/',
  array['noticias.ufsc.br','proex.paginas.ufsc.br']::text[],
  array['/2026/10/ufsc-abre-inscricoes-para-programa-de-bolsas-de-extensao-para-acoes-afirmativas/','/files/2026/10/Edital-11-2026-PROEX-PROAA-2027-Publicada.pdf']::text[],array['bolsas','pesquisa']::text[]),
 ('ufsc-ppgtg-masters-2027-1','Mestrado PPGTG/UFSC — seleção 2027.1','graduate_professional',
  'https://noticias.ufsc.br/2026/10/mestrado-em-engenharia-de-transportes-e-gestao-territorial-recebe-inscricoes-de-candidatos-ao-mestrado/',
  array['noticias.ufsc.br','ppgtg.ufsc.br']::text[],
  array['/2026/10/mestrado-em-engenharia-de-transportes-e-gestao-territorial-recebe-inscricoes-de-candidatos-ao-mestrado/','/processo-seletivo/processo-seletivo-2027-1/']::text[],array['formacao']::text[]),
 ('ufsc-transfers-2027-1','UFSC — transferências e retornos 2027.1','mixed',
  'https://dae.ufsc.br/admissao-por-transferencias-e-retornos-edital/',
  array['dae.ufsc.br','noticias.ufsc.br']::text[],
  array['/admissao-por-transferencias-e-retornos-edital/','/2026/10/ufsc-lanca-edital-de-transferencias-e-retornos-com-5-139-vagas/']::text[],array['formacao']::text[])
) as calls(id,name,audience,url,domains,paths,categories)
on conflict(id) do nothing;
