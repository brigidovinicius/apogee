# Candidato local — arquitetura Apogee na VPS

Data da preparação: 2026-10-04.

## Escopo e proveniência

Este candidato parte de `origin/main` em `9c0c227` e mantém, sem reimplementar, a sequência já revisada do cartão `0a52b`:

1. `f5ff22c` — PgBouncer publicado somente em loopback;
2. `6d7266c` — aplicação Next.js preparada para self-hosting;
3. `648b23a` — host oficial `https://www.apogee.community`;
4. `42930be` — consumo privado dos resultados aprovados do Radar;
5. `61cb9df` — serviço Radar Acadêmico.

O checkpoint lateral `875ca8e` foi inspecionado, mas não integrado: ele contém recuperação de acesso, e-mail, `opensAt` e backup remoto, que pertencem a outros cartões. Não houve conflito de Git porque `fix/private-pgbouncer-binding` é descendente direto de `origin/main`. O diff completo do candidato deve ser revisado com:

```sh
git log --oneline --reverse 9c0c227..HEAD
git diff --stat 9c0c227..HEAD
git diff --check 9c0c227..HEAD
```

## Evidências locais

Todos os comandos abaixo foram executados no worktree do cartão `b62b5`, sem acesso à VPS e sem imprimir valores de ambiente:

| Validação | Comando | Resultado |
|---|---|---|
| Dependências do site | `npm ci` | concluído |
| Dependências do Radar | `npm ci` | concluído; aviso local de engine do `pdfjs-dist` sob Node 20, enquanto o Dockerfile usa Node 22 |
| Lint do site | `npm run lint` | 0 erros; 1 aviso preexistente de `<img>` na administração da galeria |
| Tipos do site | `npm run typecheck` | passou |
| Arquitetura privada | `node --test tests/members-isolation.test.mjs tests/vps-architecture.test.mjs` | 8/8 passaram |
| Canonical/origens | `node --test --test-name-pattern='the Make It Fly page is indexable' tests/deployment-isolation.test.mjs` | passou |
| Build do site | `npm run build` | passou em build frio; a primeira tentativa encontrou cache `.next` inconsistente e foi repetida após mover somente esse artefato regenerável |
| Lint do Radar | `npm run lint` | passou |
| Tipos do Radar | `npx tsc --noEmit --incremental false` | passou |
| Testes do Radar | `npm test` | 21/21 passaram |
| Build do Radar | `npm run build` | passou |
| Compose membros | `POSTGRES_PASSWORD=compose-validation-only APP_DB_PASSWORD=compose-validation-only docker compose --env-file .env.example config -q` | passou; valores descartáveis locais, nenhum valor real usado |
| Compose site | `APOGEE_RELEASE_SHA=validation-only APOGEE_SITE_ENV_FILE=.env.example docker compose --env-file .env.example config -q` | passou |
| Compose Radar | `APOGEE_RELEASE_SHA=validation-only RADAR_ENV_FILE=.env.example docker compose --env-file .env.example config -q` | passou |
| Checagem Dockerfile | `docker build --check --build-arg APOGEE_RELEASE_SHA=validation-only .` | não concluída: daemon Colima/Docker local indisponível; nenhum serviço local foi iniciado para contornar a limitação |
| Integridade do diff | `git diff --check` | passou |

A suíte histórica completa do site (`npm test`) continua em 145/162, com 17 falhas já registradas pela auditoria antes deste cartão (testes de UI/preservação desatualizados e expectativas de backends antigos). O conjunto focado deste candidato está verde; as 17 falhas não foram mascaradas nem ampliadas para este escopo e permanecem uma pendência explícita de qualidade antes da publicação.

## Decisão arquitetural

A consolidação significa executar a aplicação Apogee na mesma VPS dos serviços privados, preservando os projetos Compose separados já existentes:

```text
proxy público (gate separado)
          |
     apogee-site/web
       /          \
apogee_membros_edge   apogee_radar_bridge
       |                       |
   PgBouncer              Radar API
       |                       |
Postgres membros        Postgres Radar
```

- O site não publica porta do host; somente o proxy opcional no profile `public` possui 80/443.
- PgBouncer conserva `127.0.0.1:${PGBOUNCER_PORT:-6543}:5432` e também atende o site pelo DNS Docker privado `pgbouncer:5432`.
- Postgres de membros e Postgres do Radar não têm `ports`.
- A API do Radar tem apenas `expose: 3000`, sem porta do host, e é alcançada pelo site em `apogee_radar_bridge`.
- Redes, volumes e bancos mantêm nomes exclusivos `apogee_*` ou `radar_academico_*`.
- As imagens próprias recebem a tag e o label OCI `org.opencontainers.image.revision` com o SHA autorizado.
- Nenhum Compose, volume, rede, banco, porta ou caminho de `sistema-de-locacao` é reutilizado ou alvo dos comandos abaixo.
- `APPLICATION_ORIGIN`, `BETTER_AUTH_URL`, `metadataBase` e canonical usam `https://www.apogee.community`.

## Gate operacional obrigatório

Nada desta seção foi executado nesta preparação local. Antes de qualquer escrita na VPS, o usuário precisa confirmar explicitamente o commit aprovado e autorizar separadamente: acesso autenticado/preflight, atualização do checkout/Compose, migrações, rebuild dos serviços, Caddy, DNS e publicação.

Se não houver prompt autenticado na VPS, se o commit não corresponder, se algum recurso Apogee apontar para `sistema-de-locacao` ou se 80/443/3000/3001/3002/6543 divergirem do inventário esperado, pare sem alterar nada.

### 1. Preflight autenticado, somente leitura

Execute um comando por vez e aguarde o prompt retornar:

```sh
whoami
hostname
docker compose ls
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}'
docker network ls --format 'table {{.Name}}\t{{.Driver}}\t{{.Scope}}'
docker volume ls --format 'table {{.Name}}\t{{.Driver}}'
ss -tlnp
ufw status verbose
df -h /
```

Comandos específicos que não imprimem ambiente ou segredos:

```sh
docker network inspect apogee_membros_edge --format '{{.Name}} internal={{.Internal}} containers={{len .Containers}}'
docker network inspect apogee_radar_bridge --format '{{.Name}} internal={{.Internal}} containers={{len .Containers}}'
docker volume inspect apogee_membros_pgdata --format '{{.Name}} {{.Driver}} {{.Mountpoint}}'
docker volume inspect radar_academico_pgdata --format '{{.Name}} {{.Driver}} {{.Mountpoint}}'
docker inspect apogee-membros-pgbouncer-1 --format '{{json .HostConfig.PortBindings}}'
docker inspect apogee-membros-postgres-1 --format '{{json .HostConfig.PortBindings}}'
docker inspect apogee-site-web-1 --format '{{.Config.Image}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
docker inspect radar-academico-web-1 --format '{{.Config.Image}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
```

### 2. Verificar o candidato exato, ainda sem rebuild

Substitua o placeholder somente pelo SHA aprovado pelo usuário:

```sh
APOGEE_RELEASE_COMMIT='<commit-aprovado>'
APOGEE_REPO='/opt/apogee-site/repo'
cd "$APOGEE_REPO"
test "$(git rev-parse HEAD)" = "$APOGEE_RELEASE_COMMIT"
git diff --quiet
git diff --cached --quiet
git show --no-patch --format='%H %s' HEAD
```

Não use `git pull`, `git checkout`, `git reset`, `git clean` ou cópia de arquivos até o usuário aprovar a atualização do checkout.

### 3. Validar os três Compose sem revelar valores

Os arquivos `.env` devem existir com modo `0600`. Estes comandos validam a interpolação, mas não imprimem a configuração:

```sh
test "$(stat -c '%a' /opt/apogee-membros/.env)" = '600'
test "$(stat -c '%a' /opt/apogee-site/repo/make-it-fly-current/infra/site/.env)" = '600'
test "$(stat -c '%a' /opt/radar-academico/repo/infra/vps/.env)" = '600'

docker compose --env-file /opt/apogee-membros/.env \
  -f /opt/apogee-membros/docker-compose.yml config -q

APOGEE_SITE_ENV_FILE=/opt/apogee-site/repo/make-it-fly-current/infra/site/.env \
docker compose --env-file /opt/apogee-site/repo/make-it-fly-current/infra/site/.env \
  -f /opt/apogee-site/repo/make-it-fly-current/infra/site/docker-compose.yml config -q

RADAR_ENV_FILE=/opt/radar-academico/repo/infra/vps/.env \
docker compose --env-file /opt/radar-academico/repo/infra/vps/.env \
  -f /opt/radar-academico/repo/infra/vps/docker-compose.yml config -q
```

Se qualquer comando falhar, pare. Não use `docker compose config` sem `-q`, porque a saída pode conter valores interpolados.

### 4. Escritas posteriores, cada uma com confirmação própria

Após preflight, revisão de diff e confirmação explícita do usuário, a ordem prevista é:

1. atualizar somente os checkouts/arquivos Apogee para o commit aprovado;
2. preservar os `.env`, certificados, backups e volumes existentes;
3. executar a migração de membros e a migração do Radar somente com backup e autorização específicos;
4. reconstruir primeiro `radar-academico/web` e `apogee-site/web`, sem profile `public`;
5. comprovar healthchecks, redes privadas e binds;
6. manter 6543 bloqueada externamente;
7. solicitar nova confirmação antes de Caddy, DNS ou qualquer publicação.

Depois que o preflight confirmar caminhos, nomes e backups, estes são os comandos exatos previstos. Eles estão documentados, mas **não foram executados** e não devem ser executados sem confirmação específica.

Migração de membros, com imagem temporária identificável e certificado público montado somente para leitura:

```sh
APOGEE_RELEASE_COMMIT='<commit-aprovado>'
APOGEE_REPO='/opt/apogee-site/repo'
cd "$APOGEE_REPO/make-it-fly-current"
docker build --target builder \
  --tag "apogee-site-migrator:$APOGEE_RELEASE_COMMIT" \
  .
docker run --rm \
  --network apogee_membros_edge \
  --env-file infra/site/.env \
  --volume /opt/apogee-membros/certs/server.crt:/run/apogee/pgbouncer-ca.crt:ro \
  "apogee-site-migrator:$APOGEE_RELEASE_COMMIT" \
  npm run db:migrate
```

Migração do Radar:

```sh
APOGEE_RELEASE_SHA='<commit-aprovado>'
export APOGEE_RELEASE_SHA
RADAR_ENV_FILE='/opt/radar-academico/repo/infra/vps/.env'
export RADAR_ENV_FILE
docker compose --env-file "$RADAR_ENV_FILE" \
  -f /opt/radar-academico/repo/infra/vps/docker-compose.yml \
  --profile migrate run --rm migrate
```

Rebuild dos serviços privados do Radar, sem publicar porta:

```sh
docker compose --env-file "$RADAR_ENV_FILE" \
  -f /opt/radar-academico/repo/infra/vps/docker-compose.yml \
  up -d --build web scheduler
docker compose --env-file "$RADAR_ENV_FILE" \
  -f /opt/radar-academico/repo/infra/vps/docker-compose.yml \
  ps
```

Rebuild somente do site, sem ativar o profile `public`:

```sh
APOGEE_SITE_ENV_FILE='/opt/apogee-site/repo/make-it-fly-current/infra/site/.env'
export APOGEE_SITE_ENV_FILE
docker compose --env-file "$APOGEE_SITE_ENV_FILE" \
  -f /opt/apogee-site/repo/make-it-fly-current/infra/site/docker-compose.yml \
  up -d --build web
docker compose --env-file "$APOGEE_SITE_ENV_FILE" \
  -f /opt/apogee-site/repo/make-it-fly-current/infra/site/docker-compose.yml \
  ps web
```

Verificações pós-rebuild sem exibir ambiente:

```sh
docker inspect apogee-site-web-1 --format '{{.State.Health.Status}} {{.Config.Image}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
docker inspect radar-academico-web-1 --format '{{.State.Health.Status}} {{.Config.Image}} revision={{index .Config.Labels "org.opencontainers.image.revision"}}'
docker inspect apogee-membros-postgres-1 --format '{{.State.Health.Status}} {{json .HostConfig.PortBindings}}'
docker inspect apogee-membros-pgbouncer-1 --format '{{json .HostConfig.PortBindings}}'
ss -tlnp
```

Seed/admin, Caddy, firewall, DNS, Vercel e publicação continuam fora desta sequência. Cada um exige um gate próprio; não há comandos para esses passos neste candidato.

## Critérios de aceite antes da publicação

- SHA e diff aprovados e worktree remoto limpo.
- `config -q` passa nos três projetos.
- `apogee-site/web` resolve `pgbouncer` e `radar-academico` apenas pelas redes privadas.
- Postgres e Radar continuam sem portas do host.
- PgBouncer aparece somente em `127.0.0.1:6543`; teste externo continua bloqueado.
- Todos os contêineres Apogee ficam saudáveis sem alteração nos cinco contêineres de `sistema-de-locacao`.
- Migrations são comprovadas sem imprimir dados ou variáveis.
- Cadastro, login, sessão, rota protegida, logout, fórum e oportunidades aprovadas passam em teste real.
- Só então há um novo gate para Caddy/DNS/publicação de `https://www.apogee.community`.
