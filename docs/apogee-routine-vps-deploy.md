# Deploy rotineiro da Apogee na VPS

Este é o procedimento padrão para publicar uma revisão já aprovada da Apogee. O canal normal é **Git + SSH usando o alias `apogee-vps`**. O Web Console da Hostinger é apenas contingência para recuperar acesso SSH; ele não é parte do fluxo de deploy normal.

## Regras

- Só execute este runbook com autorização explícita para o SHA e o deploy.
- Não use `git pull`, `git reset --hard`, `git clean`, cópia manual de arquivos, nem comandos no checkout de `sistema-de-locacao`.
- O checkout remoto deve estar limpo antes da troca de revisão. Se não estiver, pare e investigue; não descarte arquivos remotos.
- Preserve `.env`, certificados, volumes, redes e backups. Nunca passe valores privados na linha de comando, no Git ou nos logs.
- Uma mudança de código não autoriza migração de banco, DNS, Caddy, Vercel ou publicação de OAuth para todos os usuários. Cada um continua sendo um gate próprio.
- Para a atualização ordinária do site, reconstrua somente `web` no Compose da Apogee. Não use o profile `public` e não toque nos outros stacks.

## 1. Publicar a revisão local no Git

No worktree aprovado, confirme o diff e envie somente a branch autorizada:

```sh
git status --short
git diff --check
git push origin HEAD:feat/members-google-oauth-reviewed
git rev-parse HEAD
```

O SHA retornado é o único valor que deve ser implantado no próximo passo.

## 2. Preflight remoto via SSH

O alias evita depender de hostname interno ou do Web Console e usa a chave já configurada na máquina autorizada:

```sh
ssh -o BatchMode=yes -o ConnectTimeout=10 apogee-vps \
  'whoami && hostname && cd /opt/apogee-site/repo && git status --short && git rev-parse HEAD'
```

O comando precisa retornar `root`, o hostname esperado, checkout limpo e um SHA. Se falhar por conectividade ou autenticação, pare o deploy; use o Web Console apenas para diagnosticar e restaurar o acesso SSH, nunca para substituir a rotina.

## 3. Trocar para o SHA aprovado e reconstruir apenas o site

Substitua o placeholder pelo SHA completo aprovado. O comando busca a branch remota, confirma que o commit existe e troca o checkout somente quando ele está limpo. Ele não lê nem imprime o conteúdo do `.env`.

```sh
ssh -o BatchMode=yes apogee-vps 'bash -se' <<'REMOTE'
set -euo pipefail

RELEASE_SHA='<sha-aprovado>'
RELEASE_BRANCH='feat/members-google-oauth-reviewed'
REPO='/opt/apogee-site/repo'
SITE_DIR="$REPO/make-it-fly-current/infra/site"
SITE_ENV="$SITE_DIR/.env"

cd "$REPO"
test -z "$(git status --porcelain)"
git fetch --quiet origin "$RELEASE_BRANCH"
git cat-file -e "$RELEASE_SHA^{commit}"
git switch --detach "$RELEASE_SHA"
test "$(git rev-parse HEAD)" = "$RELEASE_SHA"

test "$(stat -c '%a' "$SITE_ENV")" = '600'
APOGEE_RELEASE_SHA="$RELEASE_SHA" \
APOGEE_SITE_ENV_FILE="$SITE_ENV" \
  docker compose --env-file "$SITE_ENV" -f "$SITE_DIR/docker-compose.yml" config -q

APOGEE_RELEASE_SHA="$RELEASE_SHA" \
APOGEE_SITE_ENV_FILE="$SITE_ENV" \
  docker compose --env-file "$SITE_ENV" -f "$SITE_DIR/docker-compose.yml" \
  up -d --build --force-recreate web
REMOTE
```

`--force-recreate` aplica mudanças de variáveis de execução já presentes no `.env` sem exibir seus valores. Ele não executa migrações.

## 4. Verificar saúde e revisão implantada

```sh
ssh -o BatchMode=yes apogee-vps \
  'docker inspect apogee-site-web-1 --format "{{.State.Health.Status}} revision={{index .Config.Labels \"org.opencontainers.image.revision\"}}"'

curl --fail --silent --show-error --location \
  'https://www.apogee.community/membros/entrar?next=%2Fmembros' \
  -o /dev/null
```

Espere o healthcheck retornar `healthy`. A validação HTTP confirma somente a disponibilidade pública da rota; ela não substitui um login OAuth real.

## 5. Rollback de código

Se o novo container não ficar saudável, use a mesma sequência do passo 3 com o SHA anterior conhecido e validado, reconstruindo apenas `web`. Não altere banco, rede, DNS ou variáveis durante o rollback. Registre o SHA que falhou e o SHA restaurado.

## OAuth Google em modo de teste

O Google OAuth do ambiente atual possui criação explícita de conta em `/membros/cadastro` e login em `/membros/entrar`. Enquanto o consentimento OAuth estiver como **Testando**, somente usuários adicionados à audiência de teste no Console Google conseguem concluir a autorização. A inclusão de usuários de teste e a publicação do consentimento são ações administrativas separadas do deploy e exigem confirmação própria.
