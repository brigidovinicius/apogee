-- Additive configuration only. Publication requires the separate production audit
-- and activation; reapplication preserves existing operator settings.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,crawl_interval_hours,notes
)
select id,name,'Conselho Nacional de Desenvolvimento Científico e Tecnológico','CNPq','federal_government',url,
 array['www.gov.br'],array[path],array[url],'html',array[audience],array[]::text[],array['bolsas','pesquisa'],85,false,'pending',24,
 'Auditoria 27/10/2026: página oficial e PDF da edição. Referência source-audit-20261027.json. Pendente de revalidação e ativação autorizada na VPS. Uma ficha por chamada. Não inferir cidade, remuneração ou candidatura direta de estudante.'
from (values
 ('cnpq-maidai-30-2026','CNPq/CAPES MAI/DAI — propostas institucionais 30/2026','institution',
  'https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-30-2026/',
  'https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-30-2026/chamada-publica-cnpq-N-30-2026'),
 ('cnpq-anr-32-2026','CNPq/ANR — projetos conjuntos Brasil–França 32/2026','researcher',
  'https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-32-2026/',
  'https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-32-2026/chamada-publica-cnpq-N-32-2026'),
 ('cnpq-productivity-33-2026','Bolsas de Produtividade CNPq — chamada 33/2026','researcher',
  'https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-33-2026/',
  'https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-33-2026/chamada-publica-cnpq-N-33-2026')
) as calls(id,name,audience,path,url)
on conflict(id) do nothing;
