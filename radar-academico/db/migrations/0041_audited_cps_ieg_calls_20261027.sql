-- Individually audited editions. No activation or opportunity insertion here.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,crawl_interval_hours,notes
)
select id,name,institution,acronym,source_type,url,domains,paths,array[url],'html',array[audience],
 array[]::text[],categories,85,false,'pending',24,
 'Auditoria 27/10/2026: references/source-audit-20261027.json. Pendente de revalidação e ativação na VPS. Uma ficha por edição; preservar prazo de envio, público e custos comprovados.'
from (values
 ('cps-icif-gastronomy-8-2026','8º Concurso de Gastronomia CPS/ICIF — docentes Etec e Fatec 2026','Centro Paula Souza e ICIF','CPS','state_government','professor',
  'https://arinter.cps.sp.gov.br/8-concurso-cif-2026/',
  array['arinter.cps.sp.gov.br','bkpsitecpsnew.blob.core.windows.net']::text[],
  array['/8-concurso-cif-2026/','/uploadsitecps/sites/8/2026/10/E-Edital-ARI-44-2026-8-Concurso-de-Gastronomia-ICIF-2026-1.pdf']::text[],array['competicoes','intercambios']::text[]),
 ('ufsc-ieg-research-submissions-2026','Submissão de trabalhos — Encontro de Pesquisas em Raça, Gênero e Violências UFSC 2026','Universidade Federal de Santa Catarina','UFSC','federal_university','mixed',
  'https://noticias.ufsc.br/event/evento-encontro-de-pesquisas-em-raca-genero-e-enfrentamento-as-violencias/',
  array['noticias.ufsc.br']::text[],
  array['/event/evento-encontro-de-pesquisas-em-raca-genero-e-enfrentamento-as-violencias/']::text[],array['pesquisa','eventos']::text[])
) as calls(id,name,institution,acronym,source_type,audience,url,domains,paths,categories)
on conflict(id) do nothing;
