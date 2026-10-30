-- Official alternative evidence, audited with the existing robots/SSRF protections.
-- Do not activate sources or replace operator-reviewed/customized descriptors.
update official_sources set base_url='https://www.unicamp.br/noticias/2026/08/31/unicamp-prorroga-inscricoes-para-o-vestibular-2027-ate-8-de-setembro/',listing_urls=array['https://www.unicamp.br/noticias/2026/08/31/unicamp-prorroga-inscricoes-para-o-vestibular-2027-ate-8-de-setembro/'],
 allowed_domains=array['www.unicamp.br'],allowed_path_prefixes=array['/noticias/2026/08/31/unicamp-prorroga-inscricoes-para-o-vestibular-2027-ate-8-de-setembro/'],
 notes='Publicação oficial alternativa auditada; permanece pendente e inativa. docs/radar-calendar-alternatives-local-20261030.md'
where id='comvest-vestibular-2027' and not active and verification_status='pending'
 and base_url='https://www.comvest.unicamp.br/ingresso-2027/vestibular-2027/' and listing_urls=array['https://www.comvest.unicamp.br/ingresso-2027/vestibular-2027/']
 and allowed_domains=array['www.comvest.unicamp.br'] and allowed_path_prefixes=array['/ingresso-2027/vestibular-2027/'];
update official_sources set base_url='https://jornal.usp.br/universidade/guia-de-jornada-orienta-candidatos-sobre-etapas-do-vestibular-para-ingresso-na-usp/',listing_urls=array['https://jornal.usp.br/universidade/guia-de-jornada-orienta-candidatos-sobre-etapas-do-vestibular-para-ingresso-na-usp/'],
 allowed_domains=array['jornal.usp.br'],allowed_path_prefixes=array['/universidade/guia-de-jornada-orienta-candidatos-sobre-etapas-do-vestibular-para-ingresso-na-usp/'],
 notes='Publicação oficial alternativa auditada; permanece pendente e inativa. docs/radar-calendar-alternatives-local-20261030.md'
where id='fuvest-vestibular-2027' and not active and verification_status='pending'
 and base_url='https://www.fuvest.br/vestibular-da-usp/' and listing_urls=array['https://www.fuvest.br/vestibular-da-usp/']
 and allowed_domains=array['www.fuvest.br'] and allowed_path_prefixes=array['/vestibular-da-usp/'];
