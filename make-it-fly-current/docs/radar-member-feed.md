# Radar: prioridade de experiências e apresentação financeira

Implementação iniciada em 15/10/2026, branch `feat/radar-extracurricular-feed-20261015`. A prioridade de membros foi publicada em 16/10; a extensão ao catálogo público está descrita abaixo. Os registros de produção ficam no runbook `docs/apogee-routine-vps-deploy.md` da raiz do repositório.

## Caminho dos dados

A API existente do Radar (`version: 3`) devolve o catálogo completo, sem LIMIT/OFFSET. Sua consulta `live-catalogue.ts` usa `publishedOpportunityPredicate`: fonte ativa/verificada, publicação válida, elegibilidade editorial e prazos vigentes. Esses controles não foram alterados.

A ponte `radar-client.ts`, que é `server-only`, conserva `amountText` em `benefit` e deriva campos de apresentação. Não altera o banco nem os coletores. `access.ts` mantém a autorização de membros/admin e computa a mesma ordem do catálogo completo para os feeds público e de membros. As duas páginas leem os filtros da URL no servidor; o mural filtra esse conjunto, agrupa processos e só então aplica o limite de 24 cards. São operações de comparação independentes da quantidade de resultados, portanto ordenar antes de filtrar mantém a mesma ordem relativa dos itens elegíveis. Não há ordenação apenas da página carregada.

## Regra de prioridade (refinada em 16/10/2026)

Sem categoria, modalidade ou busca explícita, inclusive ao selecionar formação, UF ou cidade:

1. Eventos e competições pelas categorias estruturadas; projetos extracurriculares, de extensão, voluntariado e iniciação científica/tecnológica explicitamente identificados no título ou requisitos, ou com bolsa de extensão estruturada.
2. Outras experiências confirmadas em pesquisa, carreira e intercâmbios. Bolsa genérica de pesquisa não basta para colocar o item no primeiro grupo.
3. Natureza ainda não classificada com segurança, inclusive financiamento de mestrado/doutorado sem prova de ingresso ou de projeto extracurricular.
4. Ingresso acadêmico formal: vínculo de vestibular auditado já existente, ou declarações compostas e explícitas de ingresso/seleção em mestrado, doutorado ou graduação. Uma exigência explícita de aprovação no vestibular prevalece sobre uma categoria de evento. As regras contextuais estão no servidor. Público de pós-graduação e nome de universidade não definem ingresso.

Em cada grupo: benefício financeiro confirmado primeiro; depois o prazo já utilizado; em empate, ID. Não se compara o valor de uma bolsa com o de um prêmio. As comparações não usam pesos de relevância. Não foi encontrado algoritmo comportamental no mural atual e nenhum foi criado.

Com categoria, modalidade ou busca explícita, a precedência editorial entre naturezas é desativada. Formação e localização restringem os itens elegíveis, mantendo a preferência por eventos e projetos. O conjunto solicitado continua acessível; benefícios confirmados e prazos ordenam os resultados dentro de cada grupo. A busca e as categorias existentes são mantidas. Nenhum item é excluído do banco.

Processos de vestibular continuam contando como um card e preservam as opções de curso filtradas. Nas páginas pública e de membros, integram a mesma sequência e o mesmo limite de 24 dos demais cards. O botão revela as próximas 24 entradas do mesmo conjunto, sem repetir processos. Mudanças na URL reiniciam o limite. Atualizações reais do catálogo podem mudar os resultados; não foi implementado snapshot persistente de paginação.

A rota `/oportunidades` usa a mesma prioridade editorial da área de membros. A apresentação administrativa mantém sua ordenação por prazo e seção de processos.

## Dinheiro e condições

`financialsFromRadar` separa `benefits`, `costs` e `notes`. Usa `benefitType` e declarações financeiras explícitas da fonte. `prize`, por si só, não prova premiação em dinheiro; estágio não prova remuneração; gratuidade não é receita. Bolsas de pesquisa/extensão/monitoria são tipos estruturados de benefício monetário; sem montante, mostram valor não divulgado. Bolsa acadêmica genérica sem prova de dinheiro pode ser apenas desconto e não ganha destaque automático.

Valores e condições de benefícios confirmados aparecem abaixo do título, com rótulo e somente as expressões monetárias em `<strong>`. Ingressos, taxas e inscrições ficam em definição própria, com peso normal. Reembolso, desconto, produtos e declarações mistas/ambíguas ficam em notas sem promoção financeira. A fonte completa continua em `benefit`; condições extraídas não são truncadas.

`money.ts` centraliza `Intl.NumberFormat`: BRL/R$ inequívoco recebe duas casas decimais e convenção brasileira. Intervalos que omitem a segunda ocorrência de R$ repetem a moeda da própria faixa. Tokens BRL com pontuação ambígua são preservados, sem adivinhar casas decimais. Moedas estrangeiras mantêm grafia, moeda e valor da fonte, sem conversão. Condições como até, por mês, por projeto, destinatário e distribuição são preservadas.

O card continua mostrando os requisitos completos, inclusive equipe, duração e dedicação quando a fonte os informa. Mostra a realização confirmada em campo próprio e mantém a janela de inscrição separada. `opportunity-countdown.tsx` e `countdown.ts` permanecem intactos, com seus alvos e comportamento existentes.

## Limitações do contrato e ajuste de origem necessário

O contrato não tem natureza de atividade nem tipo de admissão completos; `isCourse`, `categories` e `admissionProcess` cobrem apenas parte do catálogo. Para eliminar regras contextuais e classificar ofertas ambíguas, a origem precisa fornecer `activityType` e `admissionType` auditados (atividade extracurricular, ingresso em graduação, mestrado ou doutorado). Uma bolsa para aluno de doutorado não deve receber automaticamente a classificação de ingresso em doutorado.

`amountText` é uma única string e `benefitType` não distingue sempre prêmio monetário, produto, desconto ou taxa. Para cobertura completa sem interpretar prosa, a origem precisa separar benefícios financeiros de custos e fornecer tipo do benefício, moeda, valor/faixa, limite máximo, periodicidade, destinatário e indicação de premiação total/distribuição; custo deve informar taxa/ingresso/gratuidade separadamente. Nada disso foi inventado ou retropreenchido nesta entrega. Frases cuja separação não seja segura permanecem integralmente em texto normal. Eventos já cadastrados com preço e negativa de apoio continuam sendo custo, sem prioridade financeira.

Não há campos próprios para modalidade presencial/remota, equipe, duração ou dedicação; informações existentes continuam visíveis nos requisitos. Expor campos próprios depende de ajuste da origem.

## Verificação concluída em 15/10/2026

| Verificação | Resultado final |
| --- | --- |
| `npm test` | 278 testes passaram; 0 falhas, 0 ignorados |
| `npm run lint` | 0 erros; 1 aviso preexistente em `components/gallery/gallery-admin.tsx:81` (`no-img-element`) |
| `npm run typegen` | Passou |
| `npm run typecheck` | Passou |
| `npm run build` | Passou; compilação, TypeScript e geração das rotas concluídos |
| `git diff --check` | Passou |

A revisão final também cobriu bolsas de mestrado/doutorado sem prova de ingresso (natureza incerta, abaixo das atividades confirmadas) e seleções de pesquisadores que exigem doutorado (continuam pesquisa, sem confusão com ingresso no grau).

A primeira rodada identificou uma falha na faixa salarial: vírgula de pontuação após o segundo valor era confundida com parte de um número incompleto. O formatador foi corrigido, com regressões para vírgula de pontuação, segunda moeda omitida na faixa e decimal ambíguo. Toda a suíte e os checks acima foram repetidos após a correção.

As execuções foram sequenciais pela fila global. Com autorização explícita do usuário, a fila passou a isentar **somente** o comando permanente exato `npm exec desktop-commander remote` (também com caminho absoluto do npm). Doze casos de classificação confirmaram que npm/npx de projetos, build, testes, Next e TypeScript continuam bloqueadores. O conector PID 65792 permaneceu ativo. Nenhuma mudança de fila faz parte do commit do site; o backup anterior está em `/private/tmp/npm-queue-before-desktop-exemption-20261015.py`.

### Navegador e aparência

A aplicação construída rodou temporariamente em `127.0.0.1:4290`, ligada a um catálogo sintético local em `127.0.0.1:4291`. Nenhum dado foi buscado, inserido ou alterado no banco de produção.

- `/oportunidades`: 25 cards iniciais (1 processo agrupado + 24 avulsos), 34 após mostrar mais; 34 títulos únicos, sem mudar o prefixo já exibido.
- Categoria de eventos: 24 cards iniciais e 27 após mostrar mais. Categoria de competições: 2 cards.
- Busca por mestrado: retornou a seleção solicitada. Busca sem correspondência: exibiu o estado vazio. Limpar filtros: restaurou a primeira página.
- Relógio de evento: observado avançando de `26679d 15h 55min 34s` para `26679d 15h 55min 33s`, com inscrição e realização em campos distintos.
- Desktop em 1440 px e celulares em 390 e 320 px: sem overflow horizontal. A faixa mensal permaneceu completa com dois valores e periodicidade.
- Benefícios: peso computado 700 e valor com 19,2 px no desktop. Custos: peso 400, 12,48 px e sem `<strong>`.
- Prévia estática do mural de membros, produzida pelos componentes reais: 7 cenários, ingresso em mestrado por último mesmo oferecendo bolsa.
- Inspeção visual no Safari em desktop e no modo responsivo em 390×844 e 320×800: prêmio, limite máximo, destinatário e taxa permaneceram legíveis e distintos. A captura pelo Playwright sofreu timeout; a inspeção de pixels foi concluída pelo Safari.

Os fluxos do catálogo compartilhado foram exercitados na aplicação Next construída, com JavaScript ativo. A prioridade específica de membros foi validada nos testes de DAL, ordenação, agrupamento, renderização e na prévia estática, sem alterar autenticação. A rota de membros sem sessão redirecionou para login. **Não houve teste autenticado ponta a ponta da página de membros**: a configuração de autenticação e banco não está disponível no harness local; carregar o login nessa configuração sem `BETTER_AUTH_SECRET` produziu erro esperado de ambiente. O catálogo exibiu avisos de preload de CSS, sem erros de JavaScript nas interações verificadas.

Os servidores temporários foram encerrados após a conferência. A aba de teste do Safari foi fechada, preservando a aba anterior. Não houve push nem deploy.

## Arquivos desta entrega

Todos abaixo ficam em `make-it-fly-current/`:

- `app/membros/oportunidades/page.tsx`
- `lib/opportunities/access.ts`
- `lib/opportunities/member-feed.ts` (novo)
- `lib/opportunities/radar-client.ts`
- `lib/opportunities/types.ts`
- `lib/opportunities/admission-processes.ts`
- `lib/opportunities/money.ts` (novo)
- `components/opportunities/opportunities-board.tsx`
- `components/opportunities/admission-process-card.tsx`
- `components/opportunities/opportunity-financials.tsx` (novo)
- `components/opportunities/opportunities.module.css`
- `tests/admission-processes.test.mjs`
- `tests/radar-member-feed.test.mjs` (novo)
- `tests/helpers/load-opportunity-module.mjs` (novo)
- `docs/radar-member-feed.md` (novo)
- `docs/radar-member-feed-validation-20261015.json` (novo)

Resultados finais e logs completos estão em `/private/tmp/apogee-radar-feed-results-20261015.json` e `/private/tmp/apogee-radar-feed-{tests,lint,typegen,typecheck,build}-20261015.log`. A prévia estática está em `/private/tmp/apogee-radar-feed-preview-20261015.html`; não contém uma sessão autenticada nem interações ativas. Esses arquivos temporários não fazem parte da aplicação ou do deploy.

## Refinamento e verificação em 16/10/2026

A prioridade foi dividida para evitar que dezenas de bolsas genéricas de pesquisa remuneradas ocupem o lugar de eventos e projetos extracurriculares sem remuneração. `editorialFocus` é derivado exclusivamente no servidor, sem alteração da API de origem ou do banco. A precedência continua sendo calculada no catálogo completo antes da paginação. UF, cidade e formação agora mantêm essa preferência; categoria, modalidade e busca explícitas continuam prevalecendo.

As regressões novas cobrem 30 bolsas de pesquisa à frente de eventos na entrada, projeto de extensão/voluntariado/iniciação, ingresso em graduação e exigência de vestibular mesmo sob uma categoria incorreta de evento. Universidade e público de pós-graduação não rebaixam um evento. Negativas de exigência de vestibular e eventos de orientação/preparação continuam no grupo de eventos.

Checks finais executados sequencialmente pela fila global:

```sh
node --test --test-concurrency=1 tests/radar-member-feed.test.mjs tests/radar-deadline-mapping.test.mjs tests/opportunity-countdown.test.mjs tests/opportunity-location.test.mjs tests/opportunities-access.test.mjs tests/opportunities-content.test.mjs tests/members-radar-entry.test.mjs
npm run lint
npm run typegen
npm run typecheck
npm run build
git diff --check
```

Passaram os 53 testes selecionados, geração e checagem de tipos, build e diff check. Lint: zero erros e o aviso preexistente de `no-img-element` em `components/gallery/gallery-admin.tsx:81`. A suíte completa `npm test` não foi repetida nesta rodada: `tests/admission-processes.test.mjs` já tinha alteração local fora do escopo, preservada sem mudanças (hash Git `76d3ce84df623fd3b04791ed8d56d2f33a6b1572`). A ordenação, o agrupamento e a renderização de processos foram cobertos também por `radar-member-feed.test.mjs`.

Prévia estática dos componentes atuais gerada em `/private/tmp/apogee-radar-feed-preview-20261016.html`. A inspeção de pixels desta rodada ficou pendente: o Safari retornou timeout e o navegador integrado bloqueou o protocolo `file:`. Não houve teste autenticado ponta a ponta nem validação em produção. Manifesto e logs: `/private/tmp/apogee-radar-focus-results-20261016.json` e `/private/tmp/apogee-radar-focus-{tests,lint,typegen,typecheck,build,preview}-20261016.log`.

Nenhum processo foi encerrado. Sem push ou deploy; o site publicado não recebeu este refinamento.

## Extensão à página pública em 16/10/2026

Após a publicação do feed de membros, o usuário autorizou aplicar a mesma regra em `/oportunidades` e publicar o ajuste. `listPublicOpportunities(filters)` agora normaliza os filtros e usa `orderOpportunityFeed`, compartilhado com a DAL de membros. A página pública passa os parâmetros da URL para a DAL e reinicia o mural quando eles mudam. O prop compartilhado `editorialFeed` conserva a ordem do servidor e inclui os processos na paginação normal. A área administrativa continua com a apresentação anterior; as autorizações não mudaram.

A regressão da página pública executa a página, a DAL e o mural reais com catálogo sintético: um projeto de extensão e um evento vêm antes de 30 bolsas de pesquisa e de um processo de mestrado; só 24 entradas são exibidas inicialmente. UF, cidade e formação preservam a prioridade. Busca por mestrado, categoria de formação e modalidade Curso continuam retornando o processo solicitado. O teste falha caso o catálogo público passe a exigir sessão de membro ou admin.

Passaram os 54 testes selecionados de feed, página, filtros, acesso, conteúdo, localização e datas. `tests/admission-processes.test.mjs` mantém a alteração local preexistente; a suíte completa do commit será validada pelo CI oficial. Lint e tipos são executados sequencialmente pela fila; o build é validado no CI e no deploy da VPS. Evidências locais desta etapa: `/private/tmp/apogee-public-priority-tests-20261016.log` e `/private/tmp/apogee-public-priority-results-20261016.json`. Resultado de CI e validação pública pós-deploy serão registrados no runbook da raiz.

Publicação concluída no commit `a7357bdedb4b95b9a0ded0d7a65ea28ea570ce0a`: CI oficial `38982296494` verde, com 283 testes do site aprovados; container saudável e zero reinícios. Acesso público sem sessão e navegador real confirmaram sete eventos/hackathons no início, prioridade mantida com SC, busca acadêmica funcional e paginação de 24 para 48 sem trocar o prefixo. O registro de release completo está em `docs/apogee-routine-vps-deploy.md`, na raiz do repositório.
