#!/usr/bin/env python3
"""Prepare the real Radar service against the already identified local cluster."""
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
from urllib.parse import urlsplit, unquote

root = Path(__file__).resolve().parents[2]
state = root / '.local' / 'radar-calendar'
config = json.loads((state / 'config.json').read_text())
app_url = urlsplit(config['DATABASE_URL'])
assert (app_url.hostname, app_url.port, app_url.path, app_url.username) == ('127.0.0.1', 48763, '/apogee_radar_calendar_local', 'radar_calendar_local')
database = 'radar_calendar_editorial_local'
marker = 'apogee-radar-editorial-local-v1'
env = {**os.environ, 'PGPASSWORD': config['ADMIN_PASSWORD']}
args = ['/opt/homebrew/bin/psql', '-X', '-At', '-h', '127.0.0.1', '-p', '48763', '-U', 'radar_local_admin', '-v', 'ON_ERROR_STOP=1']

def query(sql, db='postgres', identity='radar_local_admin', password=None):
    command = args.copy()
    command[command.index('-U') + 1] = identity
    return subprocess.check_output(command + ['-d', db, '-c', sql], env={**env, **({'PGPASSWORD': password} if password else {})}, text=True).strip()

assert query('show data_directory') == str(state / 'pgdata')
assert query('select marker from radar_local_environment', 'apogee_radar_calendar_local') == 'apogee-radar-calendar-local-v1'
if not query("select 1 from pg_database where datname='" + database + "'"):
    query('create database ' + database + ' owner radar_local_admin')
if not query("select to_regclass('public.radar_local_environment')", database):
    assert query("select count(*) from pg_tables where schemaname='public'", database) == '0'
    query("create table radar_local_environment(marker text primary key); insert into radar_local_environment values ('" + marker + "'); create table radar_local_migrations(tag text primary key, checksum text not null)", database)
assert query('select marker from radar_local_environment', database) == marker
for path in sorted((root / 'radar-academico/db/migrations').glob('*.sql')):
    body = path.read_text()
    checksum = hashlib.sha256(body.encode()).hexdigest()
    previous = query("select checksum from radar_local_migrations where tag='" + path.name + "'", database)
    if previous:
        assert previous == checksum, 'Applied local migration changed'
        continue
    query("begin; " + body + "\ninsert into radar_local_migrations values ('" + path.name + "','" + checksum + "'); commit;", database)

editorial_path = state / 'editorial-config.json'
if not editorial_path.exists():
    # Migrations create passwordless roles on a fresh, identified local cluster.
    # Reuse the dedicated cluster's existing synthetic test password otherwise.
    password = 'synthetic-role-password-only'
    for role in ['radar_reader', 'radar_editor']:
        if query("select rolpassword is null from pg_authid where rolname='" + role + "'") == 't':
            query("alter role " + role + " password '" + password + "'")
        assert query('select current_user', database, role, password) == role
    editorial = {
        'marker': marker,
        'DATABASE_READER_URL': f'postgresql://radar_reader:{password}@127.0.0.1:48763/{database}',
        'DATABASE_EDITOR_URL': f'postgresql://radar_editor:{password}@127.0.0.1:48763/{database}',
        'ADMIN_API_TOKEN': secrets.token_hex(32),
        'PUBLIC_API_TOKEN': secrets.token_hex(32),
    }
    editorial_path.write_text(json.dumps(editorial, indent=2) + '\n')
    editorial_path.chmod(0o600)
else:
    assert json.loads(editorial_path.read_text())['marker'] == marker

# Seed only once; later runs preserve editorial changes made during acceptance.
if not query("select 1 from official_sources where id='radar-local-calendar-source'", database):
    query("""begin;
      update official_sources set active=false;
      update discovery_targets set enabled=false;
      insert into official_sources(id,name,institution_name,institution_acronym,source_type,base_url,
        allowed_domains,allowed_path_prefixes,listing_urls,extraction_mode,active,verification_status,
        audit_evidence_url,audited_at,audited_by,geographic_scope)
      values ('radar-local-calendar-source','TESTE LOCAL - fonte fictícia','Instituição fictícia de homologação','QA',
        'official_reference','https://example.edu.br/apogee-local/',
        '{example.edu.br}','{/apogee-local/}','{}','manual_assisted',true,'verified',
        'https://example.edu.br/apogee-local/',now(),'local-fixture','{Brasil}');
      commit;""", database)

for key, role in [('admin', 'admin'), ('assinatura', 'member')]:
    identifier = 'radar-local-' + key
    existing = query("select role || ':' || email from \"user\" where id='" + identifier + "'", 'apogee_radar_calendar_local')
    assert not existing or existing == role + ':' + key + '@radar.test', 'Refusing an unrelated account'
    query("""begin;
      insert into "user"(id,name,email,email_verified,username,role)
      values ('%s','Teste local %s','%s@radar.test',true,'local_%s','%s') on conflict(id) do nothing;
      insert into account(id,account_id,provider_id,user_id,password)
      select '%s-credential','%s','credential','%s',password from account
      where user_id='radar-local-vitalicio' and provider_id='credential'
      on conflict(id) do nothing;
      insert into radar_legacy_access(user_id) values ('%s') on conflict do nothing;
      commit;""" % (identifier, key, key, key, role, identifier, identifier, identifier, identifier),
      'apogee_radar_calendar_local', app_url.username, unquote(app_url.password))
    assert query("select role from \"user\" where id='" + identifier + "' and email='" + key + "@radar.test'", 'apogee_radar_calendar_local') == role
print('Serviço editorial preparado em banco LOCAL separado; fontes reais desativadas nesta cópia. Contas admin@radar.test e assinatura@radar.test prontas.')
