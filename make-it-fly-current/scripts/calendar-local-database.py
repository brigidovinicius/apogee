#!/usr/bin/env python3
"""Isolated local PostgreSQL for Radar calendar acceptance testing; no remote URLs."""
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
import sys

root = Path(__file__).resolve().parents[2]
state = root / '.local' / 'radar-calendar'
data = state / 'pgdata'
config_file = state / 'config.json'
port = '48763'
mode = sys.argv[1] if len(sys.argv) > 1 else 'start'
if mode not in ('start', 'status', 'stop'):
    raise SystemExit('Use start, status or stop')
pg_ctl = shutil.which('pg_ctl')
initdb = shutil.which('initdb')
psql = shutil.which('psql')
if not all((pg_ctl, initdb, psql)):
    raise SystemExit('PostgreSQL local não encontrado; nenhuma instalação ou conexão remota executada.')
env = {k: os.environ[k] for k in ('PATH', 'HOME', 'TMPDIR', 'LANG') if k in os.environ}
if mode != 'start':
    if not (data / 'PG_VERSION').exists():
        raise SystemExit('Banco local ainda não inicializado')
    subprocess.run([pg_ctl, '-D', str(data), mode, *(['-m', 'fast', '-w'] if mode == 'stop' else [])], env=env, check=True)
    raise SystemExit()
state.mkdir(parents=True, exist_ok=True, mode=0o700)
if not config_file.exists():
    if data.exists():
        raise SystemExit('Diretório já existe sem configuração: preservar e inspecionar manualmente.')
    config = {'DATABASE_URL': 'postgresql://radar_calendar_local:' + secrets.token_hex(24) + '@127.0.0.1:' + port + '/apogee_radar_calendar_local',
              'BETTER_AUTH_SECRET': secrets.token_hex(32), 'LOCAL_TEST_PASSWORD': 'RadarLocal!2026',
              'RADAR_ACADEMICO_API_TOKEN': secrets.token_hex(24), 'ADMIN_PASSWORD': secrets.token_hex(24)}
    config_file.write_text(json.dumps(config, indent=2) + '\n')
    config_file.chmod(0o600)
else:
    config = json.loads(config_file.read_text())
if not (data / 'PG_VERSION').exists():
    password_file = state / 'initdb-password'
    password_file.write_text(config['ADMIN_PASSWORD']); password_file.chmod(0o600)
    subprocess.run([initdb, '-D', str(data), '--username=radar_local_admin', '--encoding=UTF8', '--no-locale',
                    '--auth-local=scram-sha-256', '--auth-host=scram-sha-256', '--pwfile=' + str(password_file)], env=env, check=True, stdout=subprocess.DEVNULL)
    password_file.unlink()
    with (data / 'postgresql.conf').open('a') as handle:
        handle.write("\nlisten_addresses='127.0.0.1'\nport=48763\nunix_socket_directories=''\nmax_connections=20\nshared_buffers='32MB'\nwork_mem='1MB'\nmaintenance_work_mem='16MB'\nmax_wal_size='128MB'\nmin_wal_size='32MB'\n")
running = subprocess.run([pg_ctl, '-D', str(data), 'status'], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode == 0
if not running:
    subprocess.run([pg_ctl, '-D', str(data), '-l', str(state / 'postgres.log'), '-w', 'start'], env=env, check=True)
from urllib.parse import urlparse
url = urlparse(config['DATABASE_URL'])
assert url.hostname == '127.0.0.1' and str(url.port) == port and url.path == '/apogee_radar_calendar_local' and url.username == 'radar_calendar_local'
args = [psql, '-X', '-h', '127.0.0.1', '-p', port, '-U', 'radar_local_admin', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-At']
admin_env = {**env, 'PGPASSWORD': config['ADMIN_PASSWORD']}
exists = subprocess.check_output(args + ['-c', "select 1 from pg_database where datname='apogee_radar_calendar_local'"], env=admin_env, text=True).strip()
if not exists:
    # Password is generated hex, never supplied SQL or a production credential.
    assert url.password.isalnum()
    sql = "CREATE ROLE radar_calendar_local LOGIN PASSWORD '" + url.password + "';\nCREATE DATABASE apogee_radar_calendar_local OWNER radar_calendar_local;\n"
    subprocess.run(args, input=sql, text=True, env=admin_env, check=True, stdout=subprocess.DEVNULL)
print('PostgreSQL isolado pronto: 127.0.0.1:48763 / apogee_radar_calendar_local')
