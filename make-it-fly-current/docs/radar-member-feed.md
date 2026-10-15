# Radar: prioridade de experiências e apresentação financeira

Implementação local em 15/10/2026, branch `feat/radar-extracurricular-feed-20261015`. Sem migração, dependência nova, push ou deploy.

## Caminho dos dados

A API existente do Radar (`version: 3`) devolve o catálogo completo, sem LIMIT/OFFSET. Sua consulta `live-catalogue.ts` usa `publishedOpportunityPredicate`: fonte ativa/verificada, publicação válida, elegibilidade editorial e prazos vigentes. Esses controles não foram alterados.

A ponte `radar-client.ts`, que é `server-only`, conserva `amountText` em `benefit` e deriva campos de apresentação. Não altera o banco nem os coletores. `access.ts` mantém a autorização e computa a ordem do catálogo completo apenas para membros. A página lê os filtros da URL no servidor; o mural filtra esse conjunto, agrupa processos e só então aplica o limite de 24 cards. São operações de comparação independentes da quantidade de resultados, portanto ordenar antes de filtrar mantém a mesma ordem relativa dos itens elegíveis. Não há ordenação apenas da página carregada.

## Regra de prioridade

Sem filtros ativos:

1. Experiências extracurriculares confirmadas pelas categorias estruturadas `eventos`, `competicoes`, `pesquisa`, `carreira` e `intercambios`, quando não são ingresso em curso.
2. Natureza ainda não classificada com segurança, inclusive financiamento de mestrado/doutorado sem prova de ingresso ou de projeto extracurricular.
3. Ingresso acadêmico formal: vínculo de vestibular auditado já existente, ou declarações compostas e explícitas de ingresso/seleção em mestrado, doutorado ou graduação. As regras contextuais estão no servidor. Público de pós-graduação e nome de universidade não definem ingresso.

Em cada grupo: benefício financeiro confirmado primeiro; depois o prazo já utilizado; em empate, ID. Não se compara o valor de uma bolsa com o de um prêmio. As comparações não usam pesos de relevância. Não foi encontrado algoritmo comportamental no mural atual e nenhum foi criado.

Com categoria, modalidade, formação, localização ou busca explícita, a precedência editorial entre naturezas é desativada. O conjunto solicitado continua acessível; benefícios confirmados e prazos ordenam os resultados. A busca e as categorias existentes são mantidas. Nenhum item é excluído do banco.

Processos de vestibular continuam contando como um card e preservam as opções de curso filtradas. Na área de membros, integram a mesma sequência e o mesmo limite de 24 dos demais cards. O botão revela as próximas 24 entradas do mesmo conjunto, sem repetir processos. Mudanças na URL reiniciam o limite. Atualizações reais do catálogo podem mudar os resultados; não foi implementado snapshot persistente de paginação.

A rota `/oportunidades` conserva a ordenação anterior e a seção inicial de vestibulares. Compartilha as melhorias dos valores, requisitos e datas dos cards.

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
