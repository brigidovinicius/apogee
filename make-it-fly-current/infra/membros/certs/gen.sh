#!/bin/sh
# Gera um certificado TLS self-signed para o PgBouncer.
# Uso: ./gen.sh <IP-ou-host-da-VPS> [outro-host ...]
# O server.crt gerado também é a "CA" que o Next usa em DATABASE_CA_CERT
# para validar a conexão. Troque por Let's Encrypt quando houver domínio.
set -eu

if [ "$#" -lt 1 ]; then
  echo "uso: $0 <IP-ou-host-da-VPS> [outro-host ...]" >&2
  exit 1
fi

cd "$(dirname "$0")"

san=""
for host in "$@"; do
  case "$host" in
    *[!0-9.]*) entry="DNS:$host" ;;
    *) entry="IP:$host" ;;
  esac
  san="${san:+$san,}$entry"
done

openssl req -x509 -newkey rsa:3072 -sha256 -days 825 -nodes \
  -keyout server.key -out server.crt \
  -subj "/CN=$1" -addext "subjectAltName=$san"

# PgBouncer roda como uid 70 dentro do container.
chmod 600 server.key
chmod 644 server.crt
if [ "$(id -u)" = "0" ]; then
  chown 70:70 server.key server.crt
else
  echo "Aviso: rode 'sudo chown 70:70 server.key server.crt' para o PgBouncer ler a chave." >&2
fi

echo "Certificado gerado para: $san"
