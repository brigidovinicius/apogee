-- Repair only the exact malformed scopes inserted by migration 0039.
-- Custom operator scopes and all activation/verification fields are preserved.
update official_sources s
set allowed_path_prefixes=array[regexp_replace(p.path, '^https://[^/]+', '')]
from (values
 ('cnpq-maidai-30-2026','https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-30-2026/','https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-30-2026/chamada-publica-cnpq-N-30-2026'),
 ('cnpq-anr-32-2026','https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-32-2026/','https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-32-2026/chamada-publica-cnpq-N-32-2026'),
 ('cnpq-productivity-33-2026','https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-33-2026/','https://www.gov.br/cnpq/pt-br/chamadas/todas-as-chamadas/chamadas-2026/chamada-no-33-2026/chamada-publica-cnpq-N-33-2026')
) p(id,path,url)
where s.id=p.id and s.base_url=p.url and s.allowed_domains=array['www.gov.br']
  and s.allowed_path_prefixes=array[p.path];
