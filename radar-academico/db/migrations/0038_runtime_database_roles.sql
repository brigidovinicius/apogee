-- SEC-05. Executar somente com o migrador/DBA, após backup e autorização.
-- Sem senhas no Git. LOGINs novos só autenticam por SCRAM após provisionamento externo.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $roles$
declare role_name text;
begin
  foreach role_name in array array['radar_owner','radar_reader','radar_editor'] loop
    if not exists (select 1 from pg_roles where rolname=role_name) then
      execute format('create role %I nosuperuser nobypassrls nocreatedb nocreaterole noinherit noreplication',role_name);
    end if;
    -- Não reaproveitar silenciosamente um role preexistente com privilégios/membership.
    if exists (select 1 from pg_roles r where r.rolname=role_name and
      (r.rolsuper or r.rolbypassrls or r.rolcreatedb or r.rolcreaterole or r.rolreplication or
       exists (select 1 from pg_auth_members where member=r.oid))) then
      raise exception 'Role % precisa revisão de privilégios antes da migração',role_name;
    end if;
    execute format('alter role %I noinherit',role_name);
  end loop;
end $roles$;
alter role radar_owner nologin;
alter role radar_reader login;
alter role radar_editor login;

-- Roles não recebem membership de owner/editor; SET ROLE não promove o leitor.
revoke all on schema public from public, radar_reader, radar_editor;
alter schema public owner to radar_owner;
grant usage on schema public to radar_reader, radar_editor;

do $database$
begin
  execute format('revoke all on database %I from public, radar_reader, radar_editor',current_database());
  execute format('grant connect on database %I to radar_reader, radar_editor',current_database());
end $database$;

-- Inventário explícito: não conceder acesso automaticamente a futuras tabelas privadas.
do $tables$
declare table_name text;
begin
  foreach table_name in array array[
    'official_sources','opportunities','opportunity_sources','opportunity_revisions',
    'ingestion_runs','opportunity_management_events','discovery_targets','discovery_leads',
    'annual_event_editions','opportunity_alert_subscriptions','opportunity_alert_outbox','opportunity_alert_limits'
  ] loop
    execute format('alter table public.%I owner to radar_owner',table_name);
    execute format('alter table public.%I enable row level security',table_name);
    execute format('alter table public.%I force row level security',table_name);
    execute format('revoke all on table public.%I from public, radar_reader, radar_editor',table_name);
    execute format('grant select, insert, update on table public.%I to radar_editor',table_name);
  end loop;
end $tables$;
-- Retenção de alertas é a única operação de DELETE implementada no runtime.
grant delete on opportunity_alert_subscriptions, opportunity_alert_limits to radar_editor;
grant select on official_sources, opportunities, opportunity_sources to radar_reader;

-- GUC é contexto de transação, não credencial. Cada política passa a exigir role.
alter policy official_sources_admin on official_sources to radar_editor;
alter policy opportunities_admin on opportunities to radar_editor;
alter policy opportunity_sources_admin on opportunity_sources to radar_editor;
alter policy opportunity_revisions_admin on opportunity_revisions to radar_editor;
alter policy ingestion_runs_admin on ingestion_runs to radar_editor;
alter policy management_events_admin on opportunity_management_events to radar_editor;
alter policy discovery_targets_admin on discovery_targets to radar_editor;
alter policy discovery_leads_admin on discovery_leads to radar_editor;
alter policy annual_event_editions_admin on annual_event_editions to radar_editor;
alter policy alert_subscriptions_admin on opportunity_alert_subscriptions to radar_editor;
alter policy alert_outbox_admin on opportunity_alert_outbox to radar_editor;
alter policy alert_limits_admin on opportunity_alert_limits to radar_editor;
alter policy official_sources_public on official_sources to radar_reader;
alter policy opportunities_public on opportunities to radar_reader;
alter policy opportunity_sources_public on opportunity_sources to radar_reader;

-- Todas as PKs atuais são UUID/texto, sem sequences que o runtime precise usar.
revoke all on all sequences in schema public from public, radar_reader, radar_editor;
alter default privileges for role radar_owner in schema public revoke all on tables from public;
alter default privileges for role radar_owner in schema public revoke all on sequences from public;
