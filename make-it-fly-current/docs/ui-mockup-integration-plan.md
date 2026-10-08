# Integração do mockup de UI Apogee

## Decisão e limites da Etapa 1

Este documento é o resultado de diagnóstico da Etapa 1. Ele **não implementa
nenhuma tela**, não move arquivos e não altera o material de origem.

O alvo canônico da integração é `make-it-fly-current/`. Embora a raiz do
repositório também contenha um projeto Next, é esse app que já concentra as
rotas públicas e de membros, autenticação, o Radar e os testes de isolamento.
As referências a caminhos abaixo são relativas a `make-it-fly-current/`, salvo
indicação contrária.

O material foi localizado somente para leitura em
`/Users/viniciusbrigido/Downloads/UI MOCKUO APOGEE`. Não há README, PRD ou
brief adicional no pacote. Os arquivos `.dc.html` são handoffs de interface
com estados demonstrativos, não uma implementação que possa ser copiada como
aplicação.

### Limitações verificadas

- Este checkout não possui `node_modules/` em sua raiz, no app alvo ou no
  `radar-academico/`. Portanto não existe
  `node_modules/next/dist/docs/` instalado para leitura nesta Etapa 1, nem foi
  instalada dependência somente para produzir este plano.
- Antes de qualquer código das Etapas 2-4, instalar dependências a partir do
  lockfile no app alvo e ler as guias da versão efetivamente resolvida em
  `node_modules/next/dist/docs/` para App Router (layouts/pages), composição
  Server/Client Component, `next/font`, `next/image`, metadata e as APIs
  dinâmicas usadas pelo app. Registrar as rotas dos arquivos lidos no PR/commit
  daquela etapa e respeitar avisos de depreciação.
- O pacote de design declara interações visuais, mas não especifica contratos
  de dados, regras de pagamento, CMS, analítica, persistência de salvos ou
  permissão Premium. Nenhuma dessas ações deve ser simulada como concluída.

## Inventário do mockup

### Telas

| Handoff | Tela/estado representado | Situação no app alvo |
| --- | --- | --- |
| `Home.dc.html` | Home institucional e navegação global | Existe `/`, mas é uma home provisória menor. |
| `Radar.dc.html` | Radar público, gratuito e Premium; filtros | Existem `/oportunidades` e `/membros/oportunidades`; não há nível Premium. |
| `Detalhe.dc.html` | Detalhe de oportunidade e candidatura | Não existe rota de detalhe nem contrato correspondente. |
| `Onboarding.dc.html` | Perfil em cinco passos | Existe edição de perfil, apenas nome e bio; não existe fluxo/persistência dos cinco passos. |
| `Dashboard.dc.html` | Visão do membro, prazos, alertas e biblioteca | `/membros` é hoje a entrada do fórum. |
| `Planos.dc.html` | Comparação de planos e FAQ | Não existe rota ou modelo de planos; `/api/checkout` responde 410. |
| `UpgradeModal.dc.html` | Modal de upgrade por estado de acesso | Não há entitlement, preço configurado ou pagamento ativo. |
| `Blog.dc.html` | Listagem e categoria | Não existe rota, fonte editorial ou modelo de posts. |
| `Post.dc.html` | Artigo e oportunidades relacionadas | Não existe rota, fonte editorial ou modelo de posts. |
| `MakeItFly.dc.html` | Evento, agenda, pessoas, inscrição e FAQ | Existem `/makeitfly` e `/makeitfly/participar`, com implementação própria. |
| `Apogee Telas.dc.html` | Prancha de 13 telas: capa, Home, estados Radar, detalhe, onboarding, dashboard, planos, upgrade, Blog, categoria, post e Make It Fly | É índice de cobertura, não uma rota adicional. |

### Componentes e fundamentos declarados

- `Header.dc.html`: contexto `site` ou `radar`, visitante/gratuito/pago e menu
  móvel.
- `Footer.dc.html`: grupos de navegação e assinatura da marca.
- `TabBar.dc.html`: navegação móvel de membro para Início, Radar, Salvos,
  Biblioteca e Conta.
- `OpCard.dc.html`: variantes membro, prévia, bloqueado e encerrado; marcador
  de salvo e estados por nível.
- `UpgradeModal.dc.html`: CTA e comunicação de upgrade.
- `Apogee Design System.dc.html`: tokens, header, cards, filtros, sheet móvel,
  modal, tabela de planos, cards de Blog e estados vazio/carregando/confirmação.

O manual visual traz Instrument Serif (normal/itálico) para display e Inter
para interface. A paleta é Navy `#07182D`, preto `#0A0A0A`, branco `#FFFFFF` e
Sky `#B9D3EE`. Esses mesmos quatro valores e as duas famílias já estão
representados pelos tokens e fontes locais do app alvo.

### Assets e tipografia

O pacote contém seis PNGs RGBA: wordmark e tagline em navy/branco, e estrela
em navy/branco. Também contém o PDF `Manual de Marca.pdf` (8 páginas) e oito
PNGs de páginas do manual. Os PNGs do manual são material de referência, não
assets de produção.

O app alvo já possui fontes locais Inter e Instrument Serif em `app/fonts/`, e
assets de marca em `public/brand/` (`apogee-logo-*.svg`, `apogee-star.svg` e
`make-it-fly-wordmark.png`). A etapa que importar UI deve primeiro comparar
geometria, cor e licença das assinaturas; não deve substituir nem duplicar
arquivos atuais por nome presumido.

### Interações vistas, mas ainda não contratadas

Os handoffs demonstram: menu móvel expansível; filtros/ordenação; abertura de
sheet móvel; salvar/remover oportunidade; modal de upgrade; onboarding de cinco
passos; FAQ expansível; seleção de plano; inscrição/newsletter; e feedback
toast. Os `onClick` e atributos ARIA são placeholders do handoff, não provas
de persistência ou navegação funcional.

## Mapa para o estado atual

| Mockup | Rota/componente de destino | Reuso obrigatório | Lacuna ou conflito a resolver antes de implementar |
| --- | --- | --- | --- |
| Home e Header/Footer | `/`, `components/site/` | `app/globals.css`, fontes locais e `public/brand/` | O header/footer internos atuais são específicos de Make It Fly; não substituí-los globalmente antes de haver uma shell institucional própria. |
| Radar prévia pública | `/oportunidades`, `components/opportunities/opportunities-preview.tsx` | `listPublicOpportunityPreviews()` e sua DTO servidor-only | Nunca ampliar a DTO pública nem serializar prazo, URL, requisitos, benefícios ou resumo. |
| Radar de membro | `/membros/oportunidades`, `opportunities-board.tsx` | `requireMember()`, `listMemberOpportunities()` e filtros existentes | “Free/Premium”, salvos, alertas e ordenação Premium ainda não possuem modelo/serviço. |
| Detalhe | nova rota a decidir, sob `/membros/oportunidades/…` | DAL do membro e fonte de oportunidades | Exige identificador público seguro, lookup autorizado e critérios de escopo para candidatura/salvo. Não criar detalhe público com campos privados. |
| Onboarding/Dashboard/TabBar | `/membros`, perfil e novos componentes de membro | Better Auth, `MemberBar`, formulário de perfil e ações servidoras | A home de membros é Fórum; os dados de curso, interesses, alertas, biblioteca e salvos não existem no schema atual. |
| Planos/Upgrade | rota e componentes novos, somente depois de contrato | controles e acessibilidade já adotados | Pagamento desativado; plano, entitlement, preço, cancelamento e webhook requerem decisão de produto/segurança separada. |
| Blog/Post | rotas e fonte editorial novas | shell institucional, metadata e `next/image` conforme guia instalada | Não há CMS, conteúdo aprovado, slugs, imagens nem política de compartilhamento. |
| Make It Fly | `/makeitfly`, `/makeitfly/participar` | conteúdo existente, CTA e testes do evento | Adaptar visual sem trocar fatos aprovados, fluxo de inscrição ou os assets protegidos pelos testes de isolamento. |

## Estratégia de assets e design system

1. Preservar o pacote em Downloads como fonte imutável. Em cada Etapa, copiar
   somente o asset aprovado para um caminho novo e explícito em `public/brand/`
   ou `public/<domínio>/`; não incluir o PDF, screenshots do manual, `.DS_Store`
   ou `support.js` de handoff no build.
2. Priorizar os assets de marca já versionados quando forem equivalentes. Para
   cada candidato novo, registrar origem, finalidade, dimensões, licença/uso
   autorizado e hash antes de referenciá-lo.
3. Estender tokens semânticos existentes em `app/globals.css`; não introduzir
   valores hex repetidos por tela. Manter Instrument Serif/Inter locais com
   `next/font/local`; não carregar fontes do Google a partir do handoff.
4. Construir componentes por domínio (`components/site`, `components/opportunities`,
   `components/members`) em vez de converter HTML inline. Estados de loading,
   vazio, erro, foco, teclado e movimento reduzido fazem parte de cada
   componente.

## Plano incremental executável

### Etapa 2 — fundação visual e shell institucional

**Escopo.** Após ler a documentação Next instalada, consolidar tokens que ainda
faltarem, implementar uma shell institucional própria e componentes
reutilizáveis de Header, Footer, botão, card, chips/filtros e navegação móvel.
Aplicar somente às rotas já existentes e explicitamente selecionadas: `/`,
`/oportunidades`, `/membros`, `/membros/oportunidades`, `/makeitfly` e
`/makeitfly/participar`. Não criar Blog, Planos, checkout, Premium ou um
backend novo nesta etapa.

**Sequência.**

1. Instalar dependências pelo lockfile dentro de `make-it-fly-current/`, ler as
   guias Next indicadas acima e anotar a versão resolvida.
2. Comparar assets por hash/dimensão e adicionar somente arquivos aprovados.
3. Extrair tokens/componentes, migrando uma rota de cada vez e mantendo os
   contratos existentes de dados, links e metadata.
4. Atualizar ou criar testes estruturais para tokens, navegação, foco e
   responsividade sem enfraquecer testes de isolamento.

**Aceite verificável.**

- As seis rotas listadas renderizam com header/rodapé apropriados em viewport
  desktop e móvel, sem menu visualmente inacessível.
- Todo controle é alcançável por teclado, tem nome acessível e foco visível;
  a preferência de movimento reduzido não deixa conteúdo oculto.
- A prévia pública continua limitada à DTO controlada, e os testes de acesso do
  Radar continuam verdes.
- Não há carregamento externo de fontes nem mudança não autorizada em conteúdo
  factual do Make It Fly.

### Etapa 3 — Radar e experiência de membro

**Escopo.** Aplicar os componentes do mockup aos estados já suportados de
Radar: prévia pública, lista autenticada, filtros e vazios. Evoluir a área de
membros de forma compatível com Fórum e perfil. Implementar detalhe,
onboarding, salvos ou alertas somente depois de contratos de produto, schema,
migração, autorização e testes serem aprovados separadamente.

**Rotas afetadas inicialmente.** `/oportunidades`, `/membros`,
`/membros/oportunidades`, `/membros/perfil/[username]` e
`/membros/perfil/editar`. Rotas condicionais, fora do escopo até contrato:
`/membros/oportunidades/[id-ou-slug]`, `/membros/salvos` e qualquer rota de
onboarding.

**Aceite verificável.**

- Visitante enxerga no máximo os campos da DTO pública; inspeções de HTML, RSC
  e chamadas de rede não expõem campos privados.
- Cada rota de membro verifica a sessão no servidor; controles cliente não são
  a única proteção.
- Filtros preservam semântica, `aria-pressed`, contagem anunciada e um estado
  vazio recuperável; o layout é de uma coluna no breakpoint móvel adotado.
- Se um recurso de salvo/alerta/detalhe for autorizado, seus testes cobrem
  proprietário, não autorizado, falha e atualização visual sem vazar dados.

### Etapa 4 — superfícies novas condicionais

**Escopo.** Só após decisão de produto, implementar em incrementos distintos:
Blog/Posts, Planos/Upgrade e qualquer extensão do Make It Fly. Cada domínio
tem seu próprio contrato de conteúdo/dados e revisão; não compartilhar um
commit que introduza simultaneamente CMS, cobrança e redesign amplo.

**Decisões bloqueadoras.**

- Blog: origem editorial, autores, imagens, slugs, publicação, SEO e conteúdo
  aprovado.
- Planos/Upgrade: níveis de acesso, preço/moeda, provedor, termos,
  cancelamento, entitlement, webhook idempotente e estados de falha. O endpoint
  de checkout atual não é um ponto de integração ativo.
- Detalhe/candidatura: fonte de verdade, modelagem do progresso e confirmação
  de que nenhum dado da oportunidade deve se tornar público.

**Aceite verificável.**

- Novas rotas têm metadata, loading/error/empty states, teclado, foco e testes
  de viewport.
- Conteúdo não publicado não é indexável nem exposto por rota/API/estado
  serializado.
- Qualquer cobrança ou alteração de acesso é validada no servidor, auditável e
  testada com sucesso, cancelamento, duplicidade e falha antes de qualquer
  ativação pública.

## Validação local por etapa

Antes de código: `git status --short --branch`, leitura das guias Next
instaladas e revisão do diff. Depois de uma alteração de UI, a base mínima no
diretório do app alvo é `npm run lint`, `npm run typecheck`, `npm test` e
`npm run build`, mais os testes focados do domínio e inspeção manual desktop,
móvel, teclado e movimento reduzido. Para a fronteira do Radar, incluir os
testes de acesso e inspeção dos canais público/RSC/API aplicáveis. Só declarar
um resultado como verde quando o comando correspondente tiver realmente
concluído com sucesso.

## Registro da Etapa 1

- Worktree analisado: raiz deste repositório; `HEAD` em `f446815` no início da
  etapa, sem alterações locais.
- Material de origem: somente leitura; nenhum arquivo foi movido, apagado ou
  modificado.
- Evidências consultadas: inventário dos handoffs, PDF/PNGs do manual, rotas,
  componentes, tokens, testes e fronteiras de acesso do app alvo.
- Validações executadas nesta etapa documental: inventário de arquivos e
  metadados dos assets; extração e renderização visual da capa do manual;
  verificação de ausência de README/PRD no pacote; verificação de ausência de
  `node_modules/next/dist/docs/` neste worktree.

## Registro da Etapa 3

- Escopo integrado: filtros client-side para a DTO pública já limitada, estados
  vazio e de recuperação de filtros, e navegação de membro responsiva para
  Fórum, Radar e perfil existentes.
- Limites preservados: o cliente recebe somente `id`, título, instituição, tipo
  e nível da prévia; os detalhes continuam atrás de `requireMember()` na rota e
  na DAL. Não foram criadas rotas de detalhe, salvos, alertas, onboarding,
  planos ou Premium.
- Compatibilidade Next: as guias instaladas da versão resolvida foram lidas;
  o novo uso da shell substitui o `priority` depreciado de `next/image` por
  `preload`.
- Validações desta fatia: testes focados de Etapa 3, isolamento do Radar e
  shell passaram; lint sem erros (um aviso existente de `<img>` em
  `gallery-admin.tsx`) e typecheck passaram. Em localhost, `/oportunidades`
  respondeu 200 com a DTO limitada e o visitante em
  `/membros/oportunidades` recebeu redirecionamento 307 para entrar.
- Limitações atuais: a suíte completa ficou em 169/187 por 18 falhas fora do
  diff (Make It Fly, energia e backend de jornada). O build compilou e passou
  pelo TypeScript, mas falhou no prerender de rotas existentes com
  `Response cache requires a source route`; nenhuma destas falhas foi alterada
  nesta etapa. Não havia integração/autorização Linear disponível nesta sessão.

## Registro da Etapa 4 — consolidação e readiness local

### Escopo consolidado

- A cadeia aprovada foi integrada a partir de `f446815` com os commits
  `e47de63` (plano), `d5f2955` (shell institucional) e `9c4e81c` (estados
  seguros do Radar). Os checkpoints de Kanban adjacentes não foram incluídos.
- A comparação foi feita somente para leitura contra
  `/Users/viniciusbrigido/Downloads/UI MOCKUO APOGEE`. A implementação reutiliza
  a identidade, a shell, os filtros e os estados já contratados; nenhum arquivo
  de origem foi modificado ou copiado.
- Permanecem fora de escopo — e sem representação funcional — Blog, Planos,
  Premium, checkout, detalhe/candidatura, salvos, alertas e onboarding. Cada um
  continua dependente dos contratos e autorizações listados na Etapa 4 do plano.

### Validação local

- Dependências instaladas com `npm ci` em `make-it-fly-current/`; Next efetivo:
  `16.3.8`. Foram lidos os guias instalados de layouts/páginas, componentes
  servidor/cliente, `next/image` e atualização para a versão 16 antes da revisão
  final. A prévia pública interativa ficou isolada em Client Component; a busca
  e a DTO continuam no servidor.
- `npm run typegen`: passou.
- `npm run lint`: passou sem erros; persiste um aviso legado de `<img>` em
  `components/gallery/gallery-admin.tsx`, fora deste diff.
- `npm run typecheck`: passou.
- Testes focados serializados de shell, mockup, Radar, isolamento, login e
  resiliência: 25/25 passaram.
- Suíte completa serializada: 169/187 passaram; 18 falhas existentes fora desta
  cadeia permanecem em superfícies Make It Fly, aplicação, energia e backend de
  jornada. Elas impedem chamar a CI completa de verde.
- `NEXT_TELEMETRY_DISABLED=1 npm run build`: a compilação e o TypeScript
  passaram, mas o prerender falhou com `Invariant: Response cache requires a
  source route` em rotas preexistentes, incluindo `/_global-error`,
  `/_not-found`, `/favicon.ico`, `/galeria`, `/gerenciar-galeria`, `/login`,
  `/loja` e `/makeitfly`.
- Smoke local do servidor de desenvolvimento: `/` e `/oportunidades` retornaram
  `200`; `/membros/entrar?next=%2Fmembros%2Foportunidades` retornou `200`; e
  `/login?next=%2Fmembros%2Foportunidades` e `/membros/oportunidades`
  redirecionaram com `307` para a entrada segura. A revisão visual desktop
  confirmou shell, navegação nomeada, foco, prévia limitada e filtros. A
  responsividade móvel foi coberta pelos breakpoints e testes estruturais; não
  houve captura visual móvel separada nesta sessão.

### Checklist para release e rollback

Antes de pedir autorização de deploy, executar e registrar:

1. Confirmar commit aprovado, árvore limpa, CI completa verde e build sem erro
   de prerender.
2. Repetir o smoke das rotas acima em um ambiente de revisão autorizado,
   incluindo teclado, foco e viewport móvel.
3. Registrar a decisão, SHA aprovado, janela de mudança e responsável no
   runbook/Linear; push e deploy continuam gates separados.
4. No host autorizado, confirmar checkout limpo, SHA exato, saúde atual e
   rollback disponível antes de trocar a revisão. Não usar `git pull`,
   `git reset --hard` nem `git clean`.
5. Reconstruir somente o serviço web Apogee necessário e validar saúde e rotas
   públicas; não alterar banco, DNS, proxy, certificados, Vercel ou credenciais
   como parte desta etapa.

Em caso de rollback autorizado:

1. Registrar o motivo e manter a evidência do SHA que falhou.
2. Retornar ao SHA previamente aprovado com checkout limpo e procedimento de
   revisão explícita, preservando `.env`, volumes, redes, certificados e
   backups.
3. Reconstruir somente o web necessário, verificar a saúde e repetir as rotas
   públicas requeridas; registrar o resultado e qualquer limitação.

### Decisão

**Não pronto para solicitar autorização de deploy.** O artefato está
consolidado e os gates focados/local smoke passaram, mas a suíte completa tem
18 falhas e o build ainda falha no prerender de rotas preexistentes. Nenhum
push, deploy, VPS, DNS, Vercel, credencial ou alteração pública foi realizado.

## Correção dos bloqueios técnicos de integração — 2026-10-08

O consolidado original `5f71a6d` tinha `f446815` como primeiro pai e não era
ancestral de `origin/main` (`8a3ba213`). A integração foi refeita em uma branch
nova a partir de `origin/main`, por cherry-pick sem reescrever histórico. O
único conflito em `app/page.tsx` preservou a home HIG já integrada e aplicou
somente a shell institucional desta cadeia.

Antes da correção foram lidos, na versão Next `16.3.8` resolvida pelo lockfile,
os guias locais de `layout`, `page`, Server/Client Components, `next/image` e
upgrade para a versão 16. A shell mantém a prévia filtrável no Client Component
e a DTO no servidor; imagens de destaque usam `preload`, a API atual da versão
16. A fonte `next/font/google` remota que contrariava a regra de fontes locais
foi removida; a família Instrument Serif já versionada continua sendo usada.

Os cinco subtestes inicialmente falhos de `deployment-isolation.test.mjs`
tinham contratos de integridade defasados por rotas, tokens e recursos já
presentes no artefato aprovado, além do asset protegido
`public/rosa/retrato-nasa.webp` ausente do checkout. O asset foi restaurado
pelo blob Git cujo SHA-1 já era exigido pelo teste. As proteções foram mantidas
estritas: a allow-list de rotas agora enumera explicitamente `/login`,
`/oportunidades` e `/membros/oportunidades`; os recursos protegidos continuam
com hashes exatos; e as rotas de membro/Radar continuam testadas no servidor.

Validações desta correção: os cinco testes de isolamento/deploy e os testes
focados de UI, login, membros, Radar e arquitetura passaram (32/32); lint não
teve erros e mantém somente o aviso legado de `<img>` em
`gallery-admin.tsx`; typecheck passou. A suíte completa fechou em 174/187, com
13 falhas fora deste escopo em Make It Fly, aplicação/jornada, loja e energia.
O smoke isolado respondeu `200` em `/`, `/oportunidades` e na entrada de
membros; a rota protegida `/membros/oportunidades` respondeu `307` para a
entrada segura. A tentativa de build isolada não produziu artefato verde por
`ENOSPC` no cache Webpack. Portanto esta branch não está pronta para push ou
deploy de release até que esses gates independentes e a capacidade de disco
sejam resolvidos e validados.

Na continuação da auditoria, as 13 falhas restantes foram classificadas como
contratos de teste anteriores ao estado já publicado em `origin/main`, e não
como permissões de isolamento. Os adaptadores de render agora conhecem os
componentes reais compostos; os fixtures de webhook incluem e verificam o
segredo obrigatório; e a cobertura de Energy Support valida sua cena local,
ordem, acessibilidade e hashes atuais sem deixar de proibir interferência na
cena global. Nenhum controle de acesso, allow-list, hash de recurso protegido
ou restrição de webhook foi relaxado.

O build Webpack de produção passou a usar cache em memória. A documentação
local do Next 16 prevê esta configuração para ambientes que não preservam
`.next/cache`; a imagem da VPS é construída de uma camada limpa. O cache de
desenvolvimento não foi alterado.

Validação final local desta cadeia: a suíte completa passou em `187/187`; lint
e typecheck passaram sem erros (permanece somente o aviso legado de `<img>` em
`gallery-admin.tsx`). Com a saída isolada do outro worktree, `npm run build`
passou e gerou manifesto de prerender. O smoke do artefato de produção em
localhost devolveu `200` para `/`, `/oportunidades` e a entrada de membros;
`/membros/oportunidades` devolveu `307` para a entrada protegida e `/login`
devolveu `307` para `/membros/entrar`. A saída temporária do build foi removida
e o link `.next` compartilhado foi restaurado após o smoke.
