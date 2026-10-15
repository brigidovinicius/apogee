-- Only the organizer's exact 2027 programme announcement, audited 15/10/2026.
insert into official_sources (
 id,name,institution_name,institution_acronym,source_type,base_url,allowed_domains,allowed_path_prefixes,
 listing_urls,extraction_mode,audience_scope,geographic_scope,categories,priority,active,verification_status,
 verification_method,verification_evidence_url,verified_at,verified_by,robots_checked_at,crawl_interval_hours,notes
) values (
 'axia-internship-2027','AXIA Energia — Estágio 2027','AXIA Energia','AXIA','corporate_organizer',
 'https://axia.com.br/w/blog/programa-estagio-axia-2027',array['axia.com.br'],array['/w/blog/programa-estagio-axia-2027'],
 array['https://axia.com.br/w/blog/programa-estagio-axia-2027'],'html',array['mixed'],
 array['BR','SC','RJ','SP','MG','BA','PE','PA','RS','RO','AC','MA','DF'],array['carreira'],80,true,'verified',
 'operator_authorized_agent','https://axia.com.br/w/blog/programa-estagio-axia-2027',now(),
 'codex:operator-authorized-agent',now(),24,
 'Auditoria individual 15/10/2026: HTTP protegido e robots permitem a notícia oficial da organizadora. Programa 2027, inscrições até 15/10/2026, remunerado sem valor numérico divulgado, técnico/superior, presencial, vagas incluindo Santa Catarina. Uma ficha para todo o programa, sem multiplicar vagas/cursos/estados. Localização estruturada BR, sem UF/cidade exclusiva para programa multiestadual. Não consultar plataforma Across, formulários ou dados pessoais. Uma página por dia; deadline impede publicação vencida; erro técnico preserva evidência para retry. MPSC, SINOVA, Jaraguá e UWC continuam sem ativação neste lote; ver auditoria.'
) on conflict(id) do nothing;
