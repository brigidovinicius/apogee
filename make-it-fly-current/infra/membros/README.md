# Banco da área de membros (VPS)

Stack Docker **isolado**, que só guarda os dados da área de membros (login e fórum). Ele não compartilha nada com o outro sistema da VPS:

| Recurso | Nome |
|---|---|
| Projeto compose | `apogee-membros` |
| Containers | `apogee-membros-postgres-1`, `-pgbouncer-1`, `-backup-1` |
| Redes | `apogee_membros_internal` (interna, sem internet) e `apogee_membros_edge` |
| Volume | `apogee_membros_pgdata` |
| Banco / role | `apogee_membros` / `apogee_app` (sem superuser) |
| Porta do host | PgBouncer em `127.0.0.1:PGBOUNCER_PORT` (padrão 6543), com TLS obrigatório |

O Postgres não publica porta e o PgBouncer fica limitado ao loopback da VPS. A aplicação na Vercel não deve usar diretamente o IP da VPS: antes de publicar a área de membros, escolha um banco gerenciado ou habilite uma conectividade remota explicitamente aprovada, com TLS e allowlist de IPs estáticos.

## 1. Subir na VPS

```sh
sudo mkdir -p /opt/apogee-membros && sudo chown "$USER" /opt/apogee-membros
# copie o conteúdo desta pasta (infra/membros) para /opt/apogee-membros
cd /opt/apogee-membros

# Confira se a porta está livre e não pertence ao outro sistema
ss -tlnp | grep 6543 || echo "6543 livre"
docker ps --format '{{.Names}}\t{{.Ports}}'

cp .env.example .env
# preencha POSTGRES_PASSWORD e APP_DB_PASSWORD com:
openssl rand -hex 32

sudo ./certs/gen.sh <IP_PUBLICO_DA_VPS>
docker compose up -d
docker compose ps
```

Firewall: não abra `6543/tcp`. O bind em loopback protege o PgBouncer mesmo em hosts onde portas publicadas pelo Docker não respeitam a cadeia padrão da UFW.

## 2. Variáveis na Vercel e no `.env.local`

Todas são server-only. **Nunca** use o prefixo `NEXT_PUBLIC_`.

```
# Use somente o endpoint aprovado para o ambiente em questão; nunca o IP público da VPS.
DATABASE_URL=postgres://apogee_app:<APP_DB_PASSWORD>@<ENDPOINT_APROVADO>:5432/apogee_membros
DATABASE_CA_CERT=<conteúdo de certs/server.crt, com \n no lugar das quebras de linha>
BETTER_AUTH_SECRET=<openssl rand -hex 32>
BETTER_AUTH_URL=https://makeitfly.vercel.app
```

Com `DATABASE_CA_CERT`, o app valida o certificado do servidor e fica protegido contra MITM. Sem ele a conexão continua cifrada, mas sem validação. Para gerar o valor em uma linha: `awk '{printf "%s\\n", $0}' certs/server.crt`.

Dica: na Vercel, escolha para as Functions a região mais próxima da VPS (Project → Settings → Functions → Region). Isso reduz a latência de cada consulta.

## 3. Criar as tabelas e as categorias

Rode a partir de uma sessão autorizada que alcance o endpoint aprovado. Para uma manutenção local da VPS, use um túnel SSH autorizado e o loopback:

```sh
export DATABASE_URL='postgres://apogee_app:...@127.0.0.1:6543/apogee_membros'
export DATABASE_CA_CERT_FILE=./infra/membros/certs/server.crt   # cópia do cert da VPS
npm run db:migrate
npm run db:seed
# Para promover alguém a admin depois do cadastro:
MEMBERS_ADMIN_EMAIL=voce@exemplo.com npm run db:seed
```

Quando o schema (`lib/members/schema.ts`) mudar, rode `npm run db:generate`, revise o SQL em `drizzle/` e rode `npm run db:migrate`.

## 4. Backups

O container `backup` faz `pg_dump` diário em `./backups`, com retenção de `BACKUP_RETENTION_DAYS` dias. Para restaurar:

```sh
gunzip -c backups/apogee_membros-AAAAMMDD-HHMMSS.sql.gz | \
  docker compose exec -T postgres psql -U postgres -d apogee_membros
```

Copie os backups para fora da VPS de vez em quando.

## 5. Rotação de senha do app

```sh
NEW=$(openssl rand -hex 32)
docker compose exec postgres psql -U postgres -c "ALTER ROLE apogee_app PASSWORD '$NEW'"
# atualize APP_DB_PASSWORD no .env e recrie o pgbouncer (o userlist é gerado no start):
docker compose up -d --force-recreate pgbouncer
# atualize DATABASE_URL somente no ambiente que tenha conectividade aprovada e faça redeploy
```

## Quando houver domínio próprio

- Somente se for aprovada uma conectividade remota: troque o cert self-signed por Let's Encrypt, por exemplo `db.seudominio.com.br`, e atualize `DATABASE_CA_CERT` (ou remova-o, se usar uma CA pública).
- Configure o Resend e ative a verificação de e-mail e a recuperação de senha no Better Auth (`lib/members/auth.ts`).
- Atualize `BETTER_AUTH_URL`.
