# Deploy rotineiro da Apogee na VPS

Este é o procedimento padrão para publicar uma revisão já aprovada da Apogee. O canal normal é **Git + SSH usando o alias `apogee-vps`**. O Web Console da Hostinger é apenas contingência para recuperar acesso SSH; ele não é parte do fluxo de deploy normal.

## Regras

- Só execute este runbook com autorização explícita para o SHA e o deploy.
- A hospedagem da Apogee é exclusivamente na VPS. O usuário reiterou em 09/10/2026: nunca usar Vercel, inclusive para previews.
- Não use `git pull`, `git reset --hard`, `git clean`, cópia manual de arquivos, nem comandos no checkout de `sistema-de-locacao`.
- O checkout remoto deve estar limpo antes da troca de revisão. Se não estiver, pare e investigue; não descarte arquivos remotos.
- Preserve `.env`, certificados, volumes, redes e backups. Nunca passe valores privados na linha de comando, no Git ou nos logs.
- Uma mudança de código não autoriza migração de banco, DNS, Caddy ou publicação de OAuth para todos os usuários. Cada um continua sendo um gate próprio; Vercel não integra o fluxo permitido.
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

## Registro de release web — home com Robonauta (2026-10-09)

### Revisão aprovada e validação

- Publicação na VPS autorizada pelo usuário; [PR #13](https://github.com/brigidovinicius/apogee/pull/13) integrado.
- Release publicada: `6c2eb17540a4c0cc7c10c75bb4dec18f7d4ca386`.
- O merge publicado e o head testado `878aacc` têm a mesma árvore:
  `19a507d41971de2fb3f2854cb2569dd6ab14b397`. A equivalência de árvore mantém
  a rastreabilidade da validação; não confundir head de revisão com SHA publicado.
- [CI 37936242780](https://github.com/brigidovinicius/apogee/actions/runs/37936242780)
  aprovado nos três jobs — Radar, site e legado — incluindo typegen/typecheck,
  lint, auditoria de runtime, build e smoke standalone.
- Validação local: 217/217 testes, typegen, typecheck, lint, build e smoke com
  configuração sintética aprovados. O lint manteve apenas o aviso anterior de
  `no-img-element` em `components/gallery/gallery-admin.tsx:81`.
- A home pública passa a usar a composição de corpo fotográfico e cabeça 3D,
  com acompanhamento contínuo do ponteiro. Não é um modelo 3D completo do corpo
  e não utiliza os vídeos das versões anteriores.

### Preflight, publicação e rollback preservado

- Preflight por SSH confirmou `root@srv1439756`, checkout limpo em
  `/opt/apogee-site/repo` e `.env` com modo `600`, sem expor seu conteúdo.
- Publicação pelo fluxo Git/SSH: fetch com refspec explícito de main
  (`refs/heads/main:refs/remotes/origin/main`), conferência da revisão e
  `git switch --detach 6c2eb17540a4c0cc7c10c75bb4dec18f7d4ca386`.
- Reconstrução restrita ao site: `docker compose ... up -d --no-deps --build
  --force-recreate web`. Apenas `apogee-site-web-1` mudou; os outros 11 containers
  mantiveram IDs, imagens e horários de início.
- Container `healthy`, zero reinícios; label OCI `org.opencontainers.image.revision`
  igual ao SHA completo da release. Imagem publicada:
  `sha256:d4df7d27cb1cbce161c81c13331542e7f36fdae9f9aff67d749956f0cba289d1`.
- Rollback preservado, sem necessidade de execução:
  `af523bfd98800e11ca3d6ba6c8931c159c0413f5`, imagem
  `sha256:236689554ff21e3efeedf71e986c73afe58e4411c1105a361b198577409412ae`.

### Evidência pública e limites

- HTTP `200`: `/`, `/galeria`, `/makeitfly`, `/oportunidades` e `/membros/entrar`.
- Sem autenticação, `/membros`, `/admin` e `/admin/usuarios` respondem `307`
  para login; `/api/gallery/admin` responde `404`.
- A raiz está com `index, follow` e canonical em `https://www.apogee.community/`.
  A rota de comparação `/home-robonauta` permanece com `noindex`.
- Os WebP públicos de poster e corpo têm bytes idênticos aos arquivos locais
  validados. Cabeçalhos de segurança foram conferidos nas respostas públicas.
- Navegador público em 1280×720: canvas pronto, zero elementos de vídeo,
  nenhuma transformação CSS da imagem/canvas e ausência de overflow horizontal.
  Movimento real de mouse confirmou yaw à esquerda de −0,25480 rad e à direita
  de +0,33056 rad; na posição à direita, pitch de +0,10401 rad. `tracking=true`
  e corpo fixo foram observados.
- Console sem erros, com **dois avisos Three.js**: `sigmaRadians=0,06` excede o
  limite de amostras do blur de iluminação. Observação não bloqueante desta
  publicação; a implementação aprovada não foi alterada por causa do aviso.
  Não descrever o console como inteiramente limpo.
- Captura pública: `apogee-home-publicada-vps.png`, na pasta de visualizações
  deste chat. É evidência visual da home publicada, não benchmark de desempenho.
- OAuth real, aparelho físico e benchmark de FPS não foram exercitados.
- Nenhuma alteração em Vercel, Caddy, DNS, banco, migrações ou infraestrutura de
  outros serviços. A hospedagem permanece exclusivamente na VPS; Vercel está
  excluído também para previews.

Este registro é documentação posterior à release, acrescentada localmente sem
nova publicação. O SHA implantado acima identifica a aplicação publicada.
Um commit documental posterior não altera esse estado nem implica que este
acréscimo já esteja presente no checkout da VPS; nenhuma outra publicação foi
feita por causa deste registro.

## Registro de release — blog editorial (2026-10-12)

- Autorização do usuário: corrigir, implementar e colocar o blog no ar.
  [PR #22](https://github.com/brigidovinicius/apogee/pull/22) integrado;
  [CI 38257384912](https://github.com/brigidovinicius/apogee/actions/runs/38257384912)
  aprovado nos três jobs gerais e no teste com PostgreSQL descartável.
  O head do PR `efd36b3e372b371e5bdef5e90d8b64a07124522f` e o merge
  `4d17ae6f74e5439d2ad23ca3c9ac4f67a2bdc7b9` têm a mesma árvore
  `fb611c1056cd5abbcc4b0d95cb287cad2acfaf84`.
- Preflight via `ssh apogee-vps`: `root@srv1439756`, checkout limpo em
  `7741a7199a0780f8850a1cbeb8c3b4b4f638e4c2`, web saudável, `.env`
  modo `600` e cerca de 73 GiB livres. Banco saudável com duas migrações,
  galeria presente e tabelas do blog ausentes.
- Backup antes da migração:
  `/opt/apogee-membros/backups/blog-20261012T134713Z/apogee_membros.dump`,
  `149852` bytes, arquivo modo `600` em diretório novo modo `700`.
  `pg_restore --list` leu o arquivo com sucesso. Nenhum backup anterior foi
  alterado.
- Checkout: `git fetch --quiet origin
  refs/heads/main:refs/remotes/origin/main`, confirmação exata do SHA,
  `git switch --detach 4d17ae6f74e5439d2ad23ca3c9ac4f67a2bdc7b9` e
  `docker compose ... config -q` aprovado sem exibir configuração.
- Migração: imagem temporária `apogee-site-migrator:<SHA>` construída com
  `docker build --target builder`; execução isolada na rede privada
  `apogee_membros_edge`, usando o `.env` existente e somente o certificado
  público montado para leitura: `npm run blog:migrate` devolveu
  `{"changed":true,"migration":"0002_rapid_queen_noir"}`. Depois,
  `drizzle.__drizzle_migrations` continha três entradas; `blog_post`,
  `blog_post_event` e `blog_media` existiam; `blog_post` tinha zero artigos.
- Deploy: `docker compose ... up -d --no-deps --build --force-recreate web`
  reconstruiu somente o serviço web. `apogee-site-web-1` ficou `healthy`,
  com zero reinícios, label de revisão igual a
  `4d17ae6f74e5439d2ad23ca3c9ac4f67a2bdc7b9` e imagem
  `sha256:832f24aa7801273cab697ff38ca5f17713d407ab1d9513227fffe1eb44866f09`.
  Checkout remoto permaneceu limpo.
- HTTP público via `curl`: `/`, `/blog`, `/galeria` e `/sitemap.xml`
  responderam `200`; o sitemap contém `/blog` e o HTML do blog contém o
  título esperado. `/admin/posts/novo` respondeu `307` para login sem sessão;
  uma imagem inexistente em `/blog/media/` respondeu `404`.
- Safari com sessão administrativa existente abriu `/admin/posts/novo` e exibiu
  título, resumo, artigo, mídia, vídeo, palavra-chave, prévia SEO e ações de
  salvar/publicar/agendar. Texto temporário não salvo atualizou a prévia e as
  verificações de palavra-chave; a aba foi fechada descartando esse texto.
- Limite da verificação: não foi criada publicação, rascunho ou mídia de teste
  no banco de produção. O fluxo autenticado de salvar/publicar no navegador
  de um administrador ainda não teve confirmação positiva; rotas, banco,
  migração, build, CI, health e respostas públicas foram confirmados.
- Rollback de código disponível no SHA anterior
  `7741a7199a0780f8850a1cbeb8c3b4b4f638e4c2`, imagem
  `sha256:d45e4e0d9f85c4f7429d4882d0884950ff6e02eb8b2adb28d28aa228713f6066`.
  A migração aditiva deve permanecer para preservar futuros dados editoriais;
  não executar `DROP` nem restauração ampla por rollback de código.
- Não houve alteração em DNS, Caddy, Vercel, segredos, certificados, volumes,
  redes ou serviços vizinhos. Este registro documental é posterior à release
  e não muda o SHA implantado.

## Registro de release — nome de usuário e foto de membros (2026-10-13)

- Autorização do usuário para executar as correções após a revisão local.
  [PR #24](https://github.com/brigidovinicius/apogee/pull/24) integrado. O
  head `8b6462b414b63b7bbaaa9445185daf6d5782771e` e o merge implantado
  `130019c7d4f385e328a8ccc88ca140bf5c73af1f` têm a mesma árvore
  `2d62cbc977fd47dba74582979713119d292497aa`.
- [CI do PR 38406180891](https://github.com/brigidovinicius/apogee/actions/runs/38406180891)
  e [CI de main 38407168247](https://github.com/brigidovinicius/apogee/actions/runs/38407168247):
  os quatro jobs passaram, incluindo testes, typecheck, lint, build, smoke e
  PostgreSQL descartável. O workflow de main foi acionado manualmente porque
  este repositório não o dispara em `push`.
- Preflight via `ssh apogee-vps`: `root@srv1439756`, checkout limpo no SHA
  anterior `4d17ae6f74e5439d2ad23ca3c9ac4f67a2bdc7b9`, web saudável,
  `.env` modo `600`, banco saudável e 71 GiB livres. A imagem anterior
  `sha256:832f24aa7801273cab697ff38ca5f17713d407ab1d9513227fffe1eb44866f09`
  permaneceu disponível para rollback. Os três hashes de migração existentes
  correspondiam aos SQL versionados, e a role `apogee_app` tinha as permissões
  necessárias.
- Backup novo antes da migração:
  `/opt/apogee-membros/backups/apogee_membros-20261013-133627-pre-avatar.sql.gz`,
  132651 bytes. `gzip -t` passou antes e depois da implantação.
- Checkout remoto atualizado com `git fetch` de `main` usando refspec explícito,
  confirmação do SHA, `git switch --detach` e `docker compose config -q`.
  `docker compose build web` construiu somente a imagem
  `apogee-site:130019c7d4f385e328a8ccc88ca140bf5c73af1f`.
- Migração executada em container temporário do Compose com `run --rm --no-deps
  web node scripts/members-avatar-migrate.mjs`, antes de recriar o web. O
  resultado foi `{"changed":true,"migration":"0003_bored_logan"}`. O banco
  passou a quatro migrações; `member_avatar` existe com chave estrangeira e
  restrição de tamanho. O comando temporário consumiu o restante do stdin do
  primeiro script remoto; confirmei que o web antigo continuava saudável e
  executei a troca em uma segunda chamada SSH. Não houve troca parcial do web.
- `docker compose up -d --no-deps --no-build --force-recreate web` recriou
  somente `apogee-site-web-1`. O container ficou `healthy`, com zero reinícios,
  label do SHA implantado e imagem
  `sha256:0ba9d71a9c4abd27f0dd907f749987814d0b38a22b5fbafada34a01a857e702d`.
  Checkout remoto limpo, Caddy em execução sem reinícios, Postgres saudável e
  PgBouncer em execução; 69 GiB livres após o build.
- HTTPS público: `/`, `/membros/cadastro` e `/membros/entrar` responderam
  `200`; `/membros/perfil/configurar` e `/membros` sem sessão responderam
  `307` para login. O formulário `/makeitfly/participar` não foi alterado nem
  usado no smoke desta release.
- Limite da verificação: não houve login OAuth real, cadastro de conta de
  teste nem envio de foto em produção. O fluxo autenticado foi validado por
  testes e build, e os controles sem sessão por HTTP. O `npm ci` da imagem
  mostrou 17 alertas na árvore completa; a auditoria de dependências de
  execução exigida pelo CI passou. Não foi aplicado `audit fix` nesta release.
- Rollback de código: imagem e SHA anterior acima, mantendo a migração
  aditiva e os backups. Não houve mudança em DNS, Caddy, Vercel, segredos,
  certificados, volumes, redes ou outros stacks. Este registro documental é
  posterior ao deploy e não altera o SHA que está em produção.

## Registro de release — prioridade extracurricular do Radar (2026-10-16)

- Deploy do commit explicitamente autorizado pelo usuário:
  `1cacd7dbfd0096cc403d4c89d6d89057706afee9`, branch
  `feat/radar-extracurricular-feed-20261015`. O SHA inclui os commits locais
  `add7bc8` e `c33c861` da mesma entrega. A branch foi publicada no GitHub;
  `main` não foi alterada. A base `1336776` tem árvore idêntica à `main`
  `bb82cafc` consultada nesta execução, e o SHA anterior de produção é ancestral
  do commit autorizado.
- [CI oficial 38979387646](https://github.com/brigidovinicius/apogee/actions/runs/38979387646),
  no SHA exato da release: todos os jobs concluíram com sucesso, incluindo os
  três projetos e a integração de galeria com PostgreSQL descartável. No site:
  **282/282 testes**, zero falhas e zero ignorados, tipos, lint, audit de
  execução, build e smoke standalone aprovados. Nenhum build ou Docker local
  foi iniciado nesta etapa.
- Preflight SSH: a primeira conexão expirou antes da autenticação; a segunda,
  pelo mesmo alias configurado `apogee-vps`, confirmou `root@srv1439756`, checkout
  limpo e web saudável. Compose válido, `.env` modo `600`, cerca de 50 GiB livres
  e 5,4 GiB de memória disponível. Nenhum segredo foi exibido ou alterado.
- SHA anterior e rollback de código:
  `60ce1024c8bde3a5345051dc36f8540c85afa869`. Imagem anterior preservada:
  `sha256:69c46b73715b773e0a0c9642231967ecf7a2db58a531c8751f7afd1ddcaa9928`.
- Publicação: fetch explícito da branch autorizada, verificação do SHA e da
  ancestralidade, `git switch --detach` para o SHA aprovado, Compose `config -q`,
  `docker compose build web` e `up -d --no-deps --no-build --force-recreate web`.
  Apenas `apogee-site-web-1` foi reconstruído e recriado; os IDs de todos os
  demais containers permaneceram iguais, incluindo Radar, banco, proxy e ALU.
- Em `2026-10-16T23:14:04Z`, checkout limpo, SHA e label OCI iguais ao SHA
  publicado, web **healthy**, zero reinícios. Imagem nova:
  `sha256:cfef26c64b97cc0e1e309fb00b4e8db9cddfd2362237405c44ddfa257c6a14e6`.
  HTTPS `/` e `/oportunidades`: `200`; `/membros/oportunidades` sem sessão:
  `307`, preservando a proteção de acesso.
- **Navegador autenticado real**, na sessão existente da aba dedicada do
  navegador integrado, em `/membros/oportunidades`: antes do deploy, IFSC e IFC
  apareciam primeiro. Depois, os sete primeiros cards foram, nesta ordem:
  Hackathon TRT-SC/UDESC, NASA Space Apps Challenge, StartTech NIAVI,
  Startup Weekend Imbituba, Decola ACATE Lages, Peopletech Summit e Decola ACATE
  Rio do Sul. Todos tinham categorias de eventos/competições; bolsas genéricas
  vieram depois. Não havia card de vestibular entre os 24 iniciais.
- Interações em produção: mostrar mais passou de 24 para 48 cards, preservando
  todo o prefixo inicial. Selecionar `uf=SC` manteve os seis eventos locais no
  início. A busca explícita `Instituto Federal` com SC encontrou os processos
  IFSC/IFC e as demais opções correspondentes. Ao terminar, a aba foi restaurada
  à URL de membros sem filtros e aos 24 cards iniciais. Não foram enviados
  formulários de cadastro, inscrição ou avisos por e-mail.
- A conferência acima prova a prioridade na **área de membros**. A rota pública
  `/oportunidades` preserva a seção de vestibulares prevista no escopo aprovado.
  Esta release não fez auditoria nova das fontes nem acrescentou oportunidades.
- Captura visual dos primeiros cards:
  `/Users/viniciusbrigido/.codex/visualizations/2026/10/15/01a14112-6387-7960-acc0-4087d53026c0/radar-deploy-20261016.png`.
  Logs locais: `/private/tmp/apogee-radar-deploy-1cacd7d-20261016.log` e
  `/private/tmp/apogee-radar-ci-site-20261016.log`.
- Sem migração, mudança de banco, DNS, Caddy, credenciais, certificados, volumes,
  redes ou serviços vizinhos. O arquivo local previamente modificado
  `make-it-fly-current/tests/admission-processes.test.mjs` foi preservado e não
  foi enviado no commit publicado. Este registro é posterior à release e não
  altera o SHA implantado.

## Registro de release — prioridade extracurricular na página pública (2026-10-16)

- Publicação autorizada pelo usuário do commit
  `a7357bdedb4b95b9a0ded0d7a65ea28ea570ce0a`, na branch
  `feat/radar-extracurricular-feed-20261015`. A página `/oportunidades` agora
  compartilha a prioridade editorial e a paginação do feed de membros. A
  apresentação administrativa e as autorizações foram preservadas.
- [CI 38982296494](https://github.com/brigidovinicius/apogee/actions/runs/38982296494)
  aprovado no SHA exato: todos os jobs dos três projetos e integração de galeria
  com PostgreSQL descartável passaram. Site: **283/283 testes**, zero falhas e
  ignorados; tipos, lint, auditoria de execução, build e smoke aprovados. Antes
  do CI, passaram 54 regressões locais, lint e tipos, em sequência pela fila.
- Preflight renovado após a retomada: `root@srv1439756`, checkout limpo,
  Compose válido, `.env` modo `600`, web anterior saudável e 50 GiB livres.
  SHA anterior/rollback: `1cacd7dbfd0096cc403d4c89d6d89057706afee9`.
  Imagem anterior preservada:
  `sha256:cfef26c64b97cc0e1e309fb00b4e8db9cddfd2362237405c44ddfa257c6a14e6`.
- Deploy: fetch da branch com refspec explícito, verificação do SHA e da
  ancestralidade, `git switch --detach`, Compose `config -q`, `build web` e
  `up -d --no-deps --no-build --force-recreate web`. Somente
  `apogee-site-web-1` mudou de ID; os demais containers, incluindo Radar, proxy,
  bancos e ALU, mantiveram seus IDs.
- Em `2026-10-16T23:44:32Z`: checkout limpo no SHA publicado, label OCI
  correspondente, web **healthy**, zero reinícios. Imagem nova:
  `sha256:4b529b72868a4ae4207dac1ee086480a077ad6c73f91128565d72c1016608593`.
  `/` retornou `200`; a rota de membros sem sessão continuou retornando `307`.
- Validação HTTPS **sem cookies ou login**, analisando o HTML servido:
  `/oportunidades`, `?uf=SC` e `?uf=SC&busca=Instituto+Federal` retornaram `200`
  com 24 cards iniciais cada. No padrão, os sete primeiros cards foram
  Hackathon TRT-SC/UDESC, NASA Space Apps, StartTech NIAVI, Startup Weekend
  Imbituba, Decola ACATE Lages, Peopletech Summit e Decola ACATE Rio do Sul.
  Com SC, os seis eventos locais vieram primeiro. Nenhum card de vestibular
  apareceu nos 24 iniciais desses dois cenários. Na busca explícita, IFSC e IFC
  continuaram aparecendo, com suas opções agrupadas.
- Navegador real em uma aba pública dedicada: mesma sequência inicial;
  mostrar mais passou de 24 para 48 cards e conservou o prefixo inteiro;
  selecionar SC reiniciou em 24 cards e manteve eventos primeiro; buscar
  Instituto Federal encontrou IFSC/IFC. Ao terminar, a aba foi restaurada à
  página pública sem filtros. A aba de membros já aberta pelo usuário foi
  preservada. Nenhum formulário de inscrição ou e-mail foi enviado.
- Captura visual:
  `/Users/viniciusbrigido/.codex/visualizations/2026/10/15/01a14112-6387-7960-acc0-4087d53026c0/radar-public-priority-20261016.png`.
  Evidências adicionais: `/private/tmp/apogee-public-priority-deploy-20261016.log`,
  `/private/tmp/apogee-public-priority-ci-site-20261016.log` e
  `/private/tmp/apogee-public-priority-anonymous-results-20261016.json`.
- Sem alteração de dados do catálogo, migração, DNS, Caddy, segredos,
  certificados, volumes, redes ou serviços vizinhos. A alteração local
  preexistente em `make-it-fly-current/tests/admission-processes.test.mjs` foi
  preservada e não integrou a revisão publicada. Este registro documental é
  posterior ao deploy e não altera o SHA implantado.

## Registro de release — convites verificados (20/10/2026)

PR [#71](https://github.com/brigidovinicius/apogee/pull/71), revisão publicada
`28747e8f74700f9ce5f33771ceca08bf645720f8`, com CI funcional aprovado. Migração
aditiva, envio de e-mail e permissão adicional da conta principal ativados após
autorização explícita. Backup restaurado em ambiente isolado antes da migração;
web saudável, zero reinícios e 12 containers vizinhos preservados.

Envio, recebimento e revogação foram confirmados em produção para ambos os
perfis de convite. Verificação de e-mail e recusa de acesso antes do aceite
também foram confirmadas. A aceitação administrativa positiva foi exercitada
localmente e no CI; a conta de validação permaneceu membro em produção, e os
convites de teste foram revogados. Administrador principal e remetente de e-mail
são configurações independentes.

Resultados e limites no [resumo público da release](member-invitations-rollout-20261020.md).
As capturas de produção e os snapshots de contas permanecem somente no
ambiente local autorizado.

## Registro de release — botões verdes e fonte Inter (20/10/2026)

PR [#78](https://github.com/brigidovinicius/apogee/pull/78), SHA publicado
`16fa18b1da8c944cf8babfa6b02ca8a06b5757e3`. CI completo aprovado, somente web
recriado, 12 containers vizinhos preservados, estado saudável e zero reinícios.
Fonte Inter, cor, responsividade, animação e navegação conferidas em produção.

Evidências, limites e rollback no [registro da release](apogee-green-arrow-buttons-release-20261020.md).


## Publicação da interface e compartilhamento em 20/10/2026

O usuário autorizou a publicação e exigiu ausência de emojis e travessões e consistência global. A PR [80](https://github.com/brigidovinicius/apogee/pull/80) foi integrada após o [CI completo](https://github.com/brigidovinicius/apogee/actions/runs/39510475442) passar em todos os seis jobs. O site passou nos 425 testes com instalação limpa, tipos, lint, auditoria de dependências, build e smoke standalone. As integrações com PostgreSQL confirmaram papéis do Radar, galeria, convites, sessões, quotas e cobrança. O aviso já existente de imagem em gallery-admin permaneceu sem erros de lint.

- Head validado: `bb201b33945d4ef48bbb45b0a8ac85145291e2a7`.
- SHA publicado: `0fc00e3e7deaf1eeee44bb1e3fd9403dd7d44129`.
- Head e merge têm a mesma árvore, verificada localmente e na VPS antes da troca.
- Rollback: `34eb8fc82422daa7e79c43efedcb4d4567d2cbf0`, imagem `sha256:0cf611b7e9c243b4f1479934d0dededb86ac7bbb925cc20af66b5656780a4eed`.
- Nova imagem: `sha256:426d7fcc533ff5ba0f6943ed28b04ec411b870e97cd9e7b7f68b6fe267c2f0cd`.

O preflight confirmou checkout limpo, web saudável, imagem de rollback, `.env` modo 600 e capacidade disponível. Foram verificados SHA256SUMS do backup de 20/10, gzip do backup diário de membros de 20/10 e os fingerprints registrados de restauração. A troca foi feita por fetch Git e SHA exato. Compose config, build e recriação foram limitados ao serviço `web`, com `--no-deps`. Nenhuma migração foi executada.

O web ficou `healthy`, com zero reinícios, em duas conferências. As oito rotas do smoke HTTP responderam 200: homepage, Radar, galeria, blog, loja, evento, entrada e cadastro. Os 12 containers vizinhos mantiveram IDs e imagens; o hash do `.env` permaneceu idêntico. DNS, Caddy, certificados, redes e volumes não foram alterados.

A revisão pública no navegador conferiu nove rotas em 390 e 1440 px, sem overflow, emojis ou travessões no texto e nos rótulos acessíveis verificados. Mais cinco rotas foram medidas em 320 px, sem overflow. Títulos Apogee usam Instrument Serif e corpo usa Inter; entrada e cadastro têm campos de 16 px, 50 px de altura e raio de 10 px. O Make It Fly continua fora do tema global, com seus estilos e cenas preservados e apenas rótulos/ícones normalizados.

O menu mobile fecha com Escape e devolve o foco. O compartilhamento do Radar copiou somente a URL pública canônica, mesmo com parâmetro de convite na URL de teste. O destino Stripe, verde `rgb(37, 211, 102)`, texto marinho e fonte Inter foram preservados. Nenhum formulário, compra, cadastro, upload ou e-mail foi submetido. Compartilhamento/clipboard foram simulados para evitar envio e alteração da área de transferência real.

Limites: não havia artigo publicado para validar uma página individual em produção; essa integração foi compilada e usa o componente testado. Não foi feito login OAuth real nem jornada administrativa com sessão real. No navegador, os POSTs foram bloqueados de propósito; há erros dessas requisições e de fontes internas do iframe externo Google Forms, além de um aviso de preload. A homepage final não apresentou erros de console, mas não se afirma console limpo para todos os conteúdos externos.

Evidências: [medições e interações](evidence/apple-hig/production-validation.json), [captura da homepage](evidence/apple-hig/home-production.png) e [auditoria de design](design/apple-hig-audit.md). Script e log locais: `/private/tmp/apogee-hig-deploy.sh` e `/private/tmp/apogee-hig-deploy.log`.

Este registro é posterior à publicação e não implica novo deploy por atualização documental.

## 20/10/2026 - Loja com produtos reais e novidades dos drops

Autorização nesta conversa: após o aviso de migração e publicação pendentes, o usuário respondeu "Ok, execute inclua também esse produto". PR #81 integrada e CI completo 39515923117 aprovado. Publicado SHA 1ab3b065211794923ec25548c543c7ef61abd141, de árvore idêntica ao head validado 13f55dfe8c096f791e9d3816e879dc14ac2bd541.

Backup /opt/apogee-backups/loja-drops-20261020/apogee_membros.dump com checksum e restauração isolada das 19 tabelas conferidos. Migração aditiva 0006_store_drop_signups aplicada como apogee_app (changed=true; repetição changed=false). Apenas web recriado, healthy, zero reinícios e 12 containers vizinhos com IDs e imagens preservados. Rollback de código e imagem e2d0899471c19e391d7d915b00e352d17a07a3a2 preservados; a tabela aditiva permanece caso haja rollback.

HTTP 200 da loja e das sete fotos; três produtos verificados no navegador público em desktop e mobile, sem overflow. Cadastro técnico pela página confirmado no banco e somente o contato sintético removido depois. Histórico com sete migrações. Nenhuma mensagem externa, compra ou alteração de dados de visitantes.

Em scripts enviados por stdin ao SSH, executar a migração com `docker compose ... run --rm --no-deps -T --interactive=false web node scripts/store-drops-migrate.mjs`. O run interativo padrão pode consumir as instruções seguintes do shell. A etapa de aplicação foi conferida e a troca concluída em uma continuação explícita antes de declarar a publicação.

Detalhes em [loja-drops-20261020.md](loja-drops-20261020.md) e no runbook remoto /opt/apogee-site/releases/20261020-loja-drops.md. Registros documentais posteriores não implicam novo deploy.

## 20/10/2026 - Administração dos drops e cadastro após Comprar

Publicação autorizada por “Sim” após revisão local. [PR #84](https://github.com/brigidovinicius/apogee/pull/84) integrada com os seis jobs do [CI 39521790590](https://github.com/brigidovinicius/apogee/actions/runs/39521790590) aprovados; 448 testes locais, tipos, lint e build aprovados. SHA publicado `63fb1ae088f88a84bc8d14d447921722516a89a9`, árvore idêntica ao head validado `db7a0a00c6b73d2f24015980ade78437be911541`.

Somente web compilado e recriado, sem migração: saudável, zero reinícios, 12 containers vizinhos e `.env` preservados. Rollback `132597f27799bbd9d694e69f02cd74e3912c4489`, imagem `sha256:74961c741fe88f81394ef146993a9e0ae22e2e5d5f1fd84d7532d2960b487423`. Nenhuma modificação em Make It Fly, fotos ou dados.

Loja pública conferida no navegador: três botões Comprar, formulário ausente inicialmente, mensagem/cadastro após clique, Escape com foco restaurado e mobile de 390 px sem overflow. Página administrativa anônima redireciona ao login; CSV anônimo retorna 401. Com sessão administrativa preexistente, lista real, busca, limpeza e download CSV foram conferidos. Arquivo com BOM, quatro colunas, telefone como texto e quantidade correta de linhas; contatos não foram incluídos nos registros de release.

Detalhes em [loja-drops-admin-20261020.md](loja-drops-admin-20261020.md); runbook remoto `/opt/apogee-site/releases/20261020-loja-admin-drops.md`. Registro documental posterior, sem novo deploy.

## 21/10/2026 — Retornos após login e histórico de navegação

Publicação autorizada após o reteste do preview compilado. PR #87 integrado, CI 39702130219 com seis jobs aprovados e 478 testes do site passando. SHA publicado `41af1db8c6a5e0b88cd0803f4cede326e9049b3a`, mantendo as alterações de produção APG-84 e APG-85. Somente web reconstruído e recriado, healthy e zero reinícios; ambiente e 12 containers vizinhos preservados. Sem migrações.

Quatorze verificações HTTPS e 23 verificações no navegador com sessão real existente passaram. Novo login em produção não foi executado. Rollback `7429096ddadc33bd5d3c7496960f5a8a9234a153` preservado. Detalhes e limites em [navigation-deploy-20261021.md](navigation-deploy-20261021.md). Registro documental posterior, sem novo deploy.


## Retorno após Google OAuth — 22/10/2026

PR [#88](https://github.com/brigidovinicius/apogee/pull/88), CI completo [39855751916](https://github.com/brigidovinicius/apogee/actions/runs/39855751916) aprovado nos seis jobs. Revisão publicada autorizada `a4cc461a447260ae335a893765ba8c3ba15fcded`, contendo a correção `512044e` e Next 16.4.2. Merge `069e1dbfd52db3194c4fcedbabf8d480ecde1a19` com árvore idêntica. Somente web recriado, .env e 24 containers vizinhos inventariados preservados. Sem migração ou configuração externa.

15 verificações HTTPS e 27 cenários no Chrome passaram, incluindo dois novos logins Google reais, Voltar/Avançar do Radar e Blog administrativo, Galeria pública e retornos do Make It Fly. Saúde final healthy, zero reinícios/OOM na janela observada. Rollback 41af1db preservado. Resultados, limites e evidências em [google-oauth-deploy-20261022.md](google-oauth-deploy-20261022.md).
