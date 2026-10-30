-- Registration only. Activation and verification require a separate operator decision.
-- Never overwrite existing operator settings when this migration is replayed.
insert into official_sources (id,name,institution_name,institution_acronym,source_type,base_url,
 allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,
 categories,priority,active,verification_status,crawl_interval_hours,notes)
select id,name,institution,'','official_reference',url,array[host],array[path],array[url],
 'html',array['mixed'],array[]::text[],array[category],80,false,'pending',24,
 'Coletores de calendário por edição. Validação exclusivamente local; consultar docs/radar-calendar-collectors-local-20261029.md. Não ativar sem robots e coleta real aprovados.'
from (values
 ('obmep-calendar-2026','OBMEP 2026','Instituto de Matemática Pura e Aplicada','https://www.obmep.org.br/calendario.htm','www.obmep.org.br','/calendario.htm','competicoes'),
 ('obi-calendar-2026','Olimpíada Brasileira de Informática 2026','Instituto de Computação — Unicamp','https://olimpiada.ic.unicamp.br/calendario/datas_importantes','olimpiada.ic.unicamp.br','/calendario/datas_importantes','competicoes'),
 ('comvest-vestibular-2027','Vestibular Unicamp 2027','Comvest — Unicamp','https://www.comvest.unicamp.br/ingresso-2027/vestibular-2027/','www.comvest.unicamp.br','/ingresso-2027/vestibular-2027/','formacao'),
 ('fuvest-vestibular-2027','Vestibular FUVEST 2027','FUVEST — Universidade de São Paulo','https://www.fuvest.br/vestibular-da-usp/','www.fuvest.br','/vestibular-da-usp/','formacao')
) as candidates(id,name,institution,url,host,path,category)
on conflict(id) do nothing;
