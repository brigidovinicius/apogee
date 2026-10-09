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
git fetch --quiet origin "refs/heads/$RELEASE_BRANCH:refs/remotes/origin/$RELEASE_BRANCH"
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
  up -d --no-deps --build --force-recreate web
REMOTE
```

`--force-recreate` aplica mudanças de variáveis de execução já presentes no `.env` sem exibir seus valores. Ele não executa migrações.
O refspec explícito atualiza a referência de acompanhamento mesmo quando a VPS
tem `remote.origin.fetch` limitado a outra branch. `--no-deps` restringe a
recriação ao serviço web.

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

## Registro de release — modo administrativo (2026-10-08)

- PR: `#6` (`feat(admin): add secure mode switcher and shell`).
- SHA publicado: `b8a2f7658e70481e67c6743725e64f84807ff694`.
- Rollback de código e imagem: `695cb337550d010d9e8fd0a449cccd033eee96ca`.
- Preflight: `root@srv1439756`, checkout limpo, Compose válido, `.env` modo
  `600`, container anterior saudável e imagem/commit de rollback presentes.
- Troca: `git fetch` com refspec explícito de `main`, `git switch --detach`
  para o SHA aprovado e `docker compose up -d --build --force-recreate web`.
  A primeira tentativa de fetch parou antes da troca porque o ref remoto
  `origin/main` não foi criado pelo fetch simples; não houve build ou recreate
  nessa tentativa.
- Resultado: somente `apogee-site-web-1` foi recriado. O container terminou
  `healthy`, com label e imagem no SHA publicado; checkout remoto permaneceu
  limpo. Não houve migração, alteração de DNS, Caddy, Vercel, credenciais,
  volumes, redes ou stacks vizinhas.
- HTTP público: `/` e `/membros/entrar` responderam `200`; `/membros`,
  `/admin`, `/admin/usuarios`, `/admin/curadoria` e `/gerenciar-galeria`
  redirecionaram visitantes ao login; `/api/gallery/admin` respondeu `404`
  sem sessão.
- Seletor para conta administrativa: `https://www.apogee.community/admin`
  mostra **Modo Administrador** e permite abrir a pré-visualização; em
  `https://www.apogee.community/membros` aparece **Pré-visualização de
  Usuário** com retorno fácil ao modo Administrador.
- Limitação: não foi feito login como o usuário. A presença das rotas e do
  seletor foi verificada no manifesto/bundle publicado e a ausência para
  visitante foi verificada por HTTP. A conta alvo permaneceu com papel
  `admin`; como a sessão de banco lê o usuário atual e não guarda o papel como
  claim no cookie, não é necessário encerrar a sessão para renovar permissões.

## Registro de release — filtros de localização do Radar (2026-10-08)

- PR funcional: `#9` (`feat(radar): add canonical location filters`).
- Commit funcional: `51f096eeff04bdd38320c9eb5e6f02c368709af8`.
- SHA publicado no web Apogee: `230026b85b8672e620d951b2796e9c5278cca719`.
- SHA anterior e rollback de código/imagem:
  `49d4f114ca8bf9b47ce237dbe42aae14dc5cec35`.
- Preflight: `root@srv1439756`, checkout limpo, container anterior saudável,
  aproximadamente 62 GiB livres, `.env` modo `600` e imagem de rollback
  presente. `/opt/sistema-de-locacao` foi somente verificado, sem alterações.
- Troca: `git fetch` com refspec explícito de `main`, confirmação do commit,
  `git switch --detach` para o SHA aprovado, validação do Compose e
  `docker compose up -d --build --force-recreate web`. Somente
  `apogee-site-web-1` foi reconstruído e recriado.
- Validação: site `212/212` testes; Radar `25/25` testes; typecheck e lint dos
  dois projetos; builds standalone Next `16.3.8`; smokes standalone e HTTP.
  A primeira tentativa do build do site encontrou cache `.next` obsoleto; o
  artefato gerado foi isolado e typegen/build limpos passaram. O build do
  Radar passou com Webpack, sem instalar dependências.
- Resultado web: checkout, imagem e label OCI no SHA publicado; container
  `healthy`. `/` e `/oportunidades?uf=SP&cidade=Praia%20Grande` responderam
  `200`; a rota de membros preservou os parâmetros no redirecionamento `307`
  para login. HTML e RSC públicos não continham os campos privados auditados.
- Escopo preservado: não houve crawl real, autopublicação, migração, alteração
  de banco, DNS, Caddy, Vercel, credenciais, certificados, volumes, redes,
  backups ou serviços vizinhos.
- Gate pendente: a migração estrutural
  `radar-academico/db/migrations/0002_canonical_location.sql` não foi aplicada
  e o serviço externo do Radar não foi implantado. A tela de monitoramento e a
  ingestão canônica estão versionadas, mas sua ativação ponta a ponta requer
  autorização separada para migração e deploy desse serviço. Até lá, a release
  permanece em **Review**, sem alegação de ativação do monitor externo.

## Registro de release web — hardening APG-78 (2026-10-09, card 32ed1)

### Código integrado e evidência reaproveitada

- [PR funcional #11](https://github.com/brigidovinicius/apogee/pull/11), entregue
  pelo e5bad e integrado sem conflitos, force ou push direto para main.
- Head revisado: `1d794a94c5d818c9565cc8a1f5d20839bc4ffed8`.
- Merge e primeira publicação web desta etapa:
  `38b681b7d7634e0f31385b3d8ffe7d97d89c5371`.
- CI oficial [37876043244](https://github.com/brigidovinicius/apogee/actions/runs/37876043244):
  três jobs sequenciais em Node 22, 283 testes aprovados (67 Radar, 212 web,
  4 legado), typegen/typecheck, lint, audit runtime, três builds standalone e
  três smokes com configuração sintética. Um aviso preexistente de `img` no
  lint web; zero erros. Não foram repetidas suítes nem builds no Mac; Docker
  local não foi iniciado.
- O checkout efetivamente testado pelo CI foi o merge sintético
  `f52c4e221aaec3c593e134d3a1b1c49b0f210590`. Sua árvore, a do head e a do merge
  publicado são idênticas: `3318452a94ddc40b3376d7347794ada9b20d37f5`, comprovadas
  por `git show -s --format='%H %T %P'` e `git diff --exit-code`. Por isso não
  foi repetida a suíte para o primeiro deploy.
- Auditoria 3436e e histórico 89dcc relidos; o Done antigo de 89dcc não foi
  usado como evidência. Alterações funcionais vieram exclusivamente do PR #11.

### Preflight e publicação

- `ssh -o BatchMode=yes -o ConnectTimeout=10 apogee-vps`: identidade
  `root@srv1439756`, `/opt/apogee-site/repo` limpo, `.env` modo `600`, web
  saudável, aproximadamente 63 GiB livres e 5,7 GiB de memória disponível.
- SHA anterior e rollback:
  `ee6cbb4c1ebb7ff5f0bd7a52d0a91dad570b3a68`; imagem preservada
  `sha256:8c1be6b5ac488da13e77e254ef6663f9581cc4d6829ce06400da92c6786375ea`.
- O primeiro gate abortou antes de trocar HEAD: fetch simples atualizou
  `FETCH_HEAD`, mas `origin/main` continuou antigo devido ao refspec restrito.
  Nenhum build/recreate ocorreu nessa tentativa. O refspec explícito do
  procedimento acima resolveu a referência sem reescrever histórico/configuração.
- Comandos de publicação: `git fetch --quiet origin
  refs/heads/main:refs/remotes/origin/main`, conferência do SHA, `git switch
  --detach 38b681b7d7634e0f31385b3d8ffe7d97d89c5371`, `docker compose ... config
  -q` e `docker compose ... up -d --no-deps --build --force-recreate web`, com
  `APOGEE_RELEASE_SHA` e `APOGEE_SITE_ENV_FILE` apontando para os alvos do runbook.
- Build VPS Node 24 / Next 16.3.8 / Webpack aprovado; TypeScript e geração de
  páginas concluídos com um worker. Container executa `node server.js` standalone.
- Checkout local da release, `origin/main`, checkout/ref remoto, imagem e label
  do container confirmados no SHA publicado. Container `healthy`, zero restarts,
  aproximadamente 60 GiB livres após o build. Imagem resultante:
  `sha256:596f36b099bafc35b32d70de981c85952dcc7f36f74230b91b27371cd2ec1be8`.
- Comparação de IDs, imagens e horários de início antes/depois: somente
  `apogee-site-web-1` mudou; outros 11 containers permaneceram idênticos,
  incluindo Radar, bancos, Caddy e sistema de locação.

### Validação pública e limites

- GET `/`, `/oportunidades`, `/membros/entrar`, `/membros/cadastro` e asset JS:
  `200`. Headers nosniff, DENY, Referrer-Policy, CSP frame-ancestors e HSTS
  presentes; `X-Powered-By` ausente.
- HTTP apex redireciona `308` para HTTPS; HTTPS apex redireciona `301` para www.
- Sem cookie, `/membros`, `/membros/oportunidades?uf=SP&cidade=Praia%20Grande`,
  `/admin`, `/admin/usuarios` e `/admin/curadoria` respondem `307` para login,
  preservando `next` e os filtros. `/api/gallery/admin` responde `404`.
- Cookie exclusivamente sintético e inválido foi recusado server-side nas
  mesmas páginas. Neste caso Next emite `200` com meta refresh para login e
  digest `NEXT_REDIRECT;replace;...;307;`, sem campos privados. A primeira
  asserção, que esperava apenas status 3xx, foi corrigida conforme o guia
  instalado `next/dist/docs/01-app/03-api-reference/04-functions/redirect.md`;
  não houve alteração no controle de acesso da aplicação.
- HTML e RSC da prévia, inclusive com filtros: três objetos com exatamente
  `id`, `title`, `organization`, `kind`, `level`. Campos de resumo, requisitos,
  benefícios, prazos, URLs, verificação e localização ausentes. O request RSC
  sem `_rsc` é normalizado por `307`; com `RSC: 1` e `&_rsc` retorna
  `200 text/x-component`. Asserções HTTP/DTO executadas sequencialmente por
  `python3 /tmp/apogee-32ed1-public-smoke.py` e checagem específica de HTML/RSC.
- `npm ci` do builder relatou 17 alertas na árvore completa de desenvolvimento.
  Rechecagem atual `npm audit --omit=dev --package-lock-only --json` no app web:
  zero alertas de runtime. Isso não atesta ausência de vulnerabilidades de dev
  ou de vulnerabilidades desconhecidas; não foi aplicado `audit fix`.
- Autorização positiva de usuário real/OAuth não foi exercitada. Foram usadas
  evidências do CI sintético e rejeições públicas, sem sessão de terceiros.
- Não houve migração 0002, alteração de roles, credenciais, DNS, Caddy, Vercel,
  certificados, redes, volumes ou backups. Não houve deploy do serviço Radar,
  ingestão real nem decisão editorial/autopublicação. Esses gates continuam no
  card 2c812 e exigem autorização específica. O código Radar integrado no Git
  ainda não equivale a hardening implantado naquele serviço.
- Rollback disponível: reaplicar o procedimento somente para web com o SHA
  anterior acima; preservar banco e configuração. Não foi necessário executá-lo.

A consolidação deste registro altera somente documentação. Se seu merge for
publicado para alinhar os SHAs operacionais, a árvore dos aplicativos permanece
igual; registrar o SHA final exato, o PR de documentação e a nova conferência de
imagem/container no resultado do card 32ed1. Não confundir esse SHA documental
com alteração funcional adicional ou ativação do Radar.
