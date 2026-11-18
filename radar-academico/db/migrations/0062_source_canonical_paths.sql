-- Official CAPES news moved out of the electoral-period path. Keep legacy
-- evidence URLs and operator decisions; add only the two audited articles.
set local lock_timeout='5s';
set local statement_timeout='30s';

update official_sources s set
 allowed_path_prefixes=array(select distinct p from unnest(s.allowed_path_prefixes || array[c.current_path]) p order by p),
 verification_evidence_url=case when s.verification_evidence_url='https://www.gov.br'||c.legacy_path
   then 'https://www.gov.br'||c.current_path else s.verification_evidence_url end,
 next_crawl_at=case when s.active and s.verification_status='verified' then now() else s.next_crawl_at end,
 updated_at=now()
from (values
 ('capes-pdse-22-2026',
  '/capes/pt-br/assuntos/noticias-defeso-eleitoral/doutorado-sanduiche-no-exterior-tem-prazos-e-criterios-de-selecao-alterados',
  '/capes/pt-br/assuntos/noticias/doutorado-sanduiche-no-exterior-tem-prazos-e-criterios-de-selecao-alterados'),
 ('capes-pdai-23-2026',
  '/capes/pt-br/assuntos/noticias-defeso-eleitoral/prazo-de-inscricao-no-pdai-e-prorrogado-ate-26-de-outubro',
  '/capes/pt-br/assuntos/noticias/prazo-de-inscricao-no-pdai-e-prorrogado-ate-26-de-outubro')
) c(id,legacy_path,current_path)
where s.id=c.id and c.legacy_path=any(s.allowed_path_prefixes)
 and 'www.gov.br'=any(s.allowed_domains);

-- The old portal redirects to its dedicated official subdomain. Code restricts
-- both hosts to their listing and numeric posting URLs; '/' does not allow
-- unrelated resources on the legacy host. No new source is activated.
update official_sources s set
 base_url='https://oportunidades.fapesp.br/',
 listing_urls=array['https://oportunidades.fapesp.br/'],
 allowed_domains=array(select distinct h from unnest(s.allowed_domains || array['oportunidades.fapesp.br']) h order by h),
 allowed_path_prefixes=array(select distinct p from unnest(s.allowed_path_prefixes || array['/']) p order by p),
 crawl_listing_index=0,crawl_link_offset=0,
 next_crawl_at=case when s.active and s.verification_status='verified' then now() else s.next_crawl_at end,
 updated_at=now()
where s.id='fapesp-open-fellowships'
 and s.base_url in ('https://fapesp.br/oportunidades/','https://www.fapesp.br/oportunidades/')
 and s.listing_urls=array[s.base_url];
