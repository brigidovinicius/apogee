#!/bin/sh
# Roda só na primeira inicialização do volume. Cria o banco da área de membros
# e um role de aplicação sem privilégios de superusuário.
set -eu

psql -v ON_ERROR_STOP=1 -v app_password="$APP_DB_PASSWORD" --username "$POSTGRES_USER" --dbname postgres <<'SQL'
CREATE ROLE apogee_app LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION PASSWORD :'app_password';
CREATE DATABASE apogee_membros OWNER apogee_app;
REVOKE ALL ON DATABASE postgres FROM PUBLIC;
REVOKE ALL ON DATABASE apogee_membros FROM PUBLIC;
GRANT CONNECT ON DATABASE apogee_membros TO apogee_app;
SQL

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname apogee_membros <<'SQL'
REVOKE ALL ON SCHEMA public FROM PUBLIC;
ALTER SCHEMA public OWNER TO apogee_app;
SQL
