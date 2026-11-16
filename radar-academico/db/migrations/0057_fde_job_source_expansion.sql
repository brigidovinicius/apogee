-- Audited job-board candidates. Verification/activation remain explicit operations.
-- No change to AI, financial controls, existing sources or publication rules.
set local lock_timeout='5s';
set local statement_timeout='30s';
insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
 allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,
 priority,active,verification_status,crawl_interval_hours,notes,audit_evidence_url)
select 'jobs-'||slug,company||' — empregos',company,'','corporate_organizer',feed,
 case when provider='ashby' then array['api.ashbyhq.com','jobs.ashbyhq.com'] else array['boards-api.greenhouse.io','job-boards.greenhouse.io'] end,
 case when provider='ashby' then array['/posting-api/job-board/'||board,'/'||board||'/'] else array['/v1/boards/'||board||'/jobs','/'||board||'/jobs/'] end,
 array[feed],'api',array['mixed'],'{}',array['carreira'],priority,false,'pending',6,
 'Quadro oficial auditado em 16/11/2026. Publicar somente vagas remotas com Brasil comprovado individualmente. LATAM e histórico da empresa não confirmam elegibilidade.',evidence
from (select *,case when provider='ashby' then 'https://api.ashbyhq.com/posting-api/job-board/'||board||'?includeCompensation=true'
 else 'https://boards-api.greenhouse.io/v1/boards/'||board||'/jobs?content=true' end feed from (values
 ('latamcent','LatamCent','latamcent','ashby','https://latamcent.com/careers/',80),
 ('truelogic','Truelogic','truelogic','ashby','https://www.truelogic.io/careers',85),
 ('oscilar','Oscilar','oscilar','ashby','https://oscilar.com/careers',75),
 ('elevenlabs','ElevenLabs','ElevenLabs','ashby','https://elevenlabs.io/careers/positions',75),
 ('telnyx','Telnyx','telnyx54','greenhouse','https://telnyx.com/careers',75)
) as candidates(slug,company,board,provider,evidence,priority)) sources
on conflict(id) do nothing;
