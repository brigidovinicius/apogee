-- Additive local candidate. No source activation and no external requests.
set local lock_timeout='5s';
set local statement_timeout='60s';
alter table opportunities drop constraint opportunities_benefit_type_check;
alter table opportunities add constraint opportunities_benefit_type_check check(benefit_type in
 ('academic_scholarship','research_scholarship','extension_scholarship','monitor_scholarship','internship',
  'financial_aid','housing_aid','mobility_aid','prize','project_funding','unpaid_opportunity','other','employment'));
alter table opportunities add column employment jsonb;
alter table opportunities add column job_missing_since timestamptz;
alter table opportunities add column job_missing_checked_at timestamptz;
alter table opportunities add constraint opportunities_employment_shape check(employment is null or
 (jsonb_typeof(employment)='object' and employment->>'version'='1' and
  employment->>'provider' in ('ashby','greenhouse') and
  employment->>'workplace' in ('remote','hybrid','onsite','unknown') and
  employment->>'brazilEligibility' in ('confirmed','excluded','unknown') and
  coalesce(employment->>'requisitionId','')<>''));
create index opportunities_job_identity on opportunities(official_source_id,(employment->>'requisitionId')) where employment is not null;

create function public.radar_job_current(job jsonb,checked timestamptz) returns boolean
language sql stable set search_path=pg_catalog,public,pg_temp as $$
 select coalesce(job->>'version'='1' and job->>'provider' in ('ashby','greenhouse')
   and job->>'workplace'='remote' and job->>'brazilEligibility'='confirmed'
   and checked<=now() and checked>now()-interval '48 hours',false)
$$;
revoke all on function public.radar_job_current(jsonb,timestamptz) from public;
grant execute on function public.radar_job_current(jsonb,timestamptz) to radar_reader,radar_editor;

-- Preserve all historical branches while adding a bounded, evidence-backed job branch.
do $policies$
declare old_qual text; job_qual text;
begin
 select pg_get_expr(polqual,polrelid) into old_qual from pg_policy where polrelid='opportunities'::regclass and polname='opportunities_public';
 job_qual := $predicate$benefit_type='employment' and review_status='approved' and verified_at is not null
  and verification_method in ('automatic','admin') and opportunity_status='open' and not source_conflict
  and deleted_at is null and publication_issue is null and published_at is not null
  and deadline_precision='not_informed' and deadline_at is null
  and public.radar_job_current(employment,coalesce(last_source_check_at,verified_at))
  and coalesce(evidence_json->'brazil_eligibility'->>'excerpt','')<>''
  and coalesce(evidence_json->'workplace'->>'excerpt','')<>''
  and exists(select 1 from official_sources s where s.id=opportunities.official_source_id and s.active and s.verification_status='verified')$predicate$;
 if old_qual is null then raise exception 'Missing publication policy'; end if;
 execute format('alter policy opportunities_public on opportunities using (((%s) and (benefit_type<>''employment'' or public.radar_job_current(employment,coalesce(last_source_check_at,verified_at)))) or (%s))',old_qual,job_qual);
 select pg_get_expr(polqual,polrelid) into old_qual from pg_policy where polrelid='opportunity_sources'::regclass and polname='opportunity_sources_public';
 execute format($sql$alter policy opportunity_sources_public on opportunity_sources using (
  ((%s) or (active and exists(select 1 from opportunities o where o.id=opportunity_sources.opportunity_id and o.benefit_type='employment')))
  and not exists(select 1 from opportunities o where o.id=opportunity_sources.opportunity_id and o.benefit_type='employment'
    and not public.radar_job_current(o.employment,coalesce(o.last_source_check_at,o.verified_at))))$sql$,old_qual);
end $policies$;

insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
 allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,audience_scope,geographic_scope,categories,
 priority,active,verification_status,crawl_interval_hours,notes,audit_evidence_url)
select 'jobs-'||board,company||' — empregos',company,'','corporate_organizer',feed,
 case when provider='ashby' then array['api.ashbyhq.com','jobs.ashbyhq.com'] else array['boards-api.greenhouse.io','job-boards.greenhouse.io'] end,
 case when provider='ashby' then array['/posting-api/job-board/'||board,'/'||board||'/'] else array['/v1/boards/'||board||'/jobs','/'||board||'/jobs/'] end,
 array[feed],'api',array['mixed'],'{}',array['carreira'],priority,false,'pending',6,
 'Candidata de empregos: homologar vínculo com empregador, robots e termos antes de ativar. Prioridade FDE remoto com Brasil comprovado.',
 case board when 'whippy' then 'https://www.whippy.ai/' when 'n8n' then 'https://n8n.io/careers/'
  when 'nortal' then 'https://nortal.com/recruitment-and-hiring-privacy-statement/' when 'gitlab' then 'https://about.gitlab.com/jobs/' end
from (values
 ('whippy','Whippy','ashby','https://api.ashbyhq.com/posting-api/job-board/whippy?includeCompensation=true',90),
 ('n8n','n8n','ashby','https://api.ashbyhq.com/posting-api/job-board/n8n?includeCompensation=true',70),
 ('nortal','Nortal','greenhouse','https://boards-api.greenhouse.io/v1/boards/nortal/jobs?content=true',80),
 ('gitlab','GitLab','greenhouse','https://boards-api.greenhouse.io/v1/boards/gitlab/jobs?content=true',70)
) as sources(board,company,provider,feed,priority) on conflict(id) do nothing;
