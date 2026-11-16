# Rastreabilidade D/U/R/F

“Implementado” identifica código no candidato. “Validado” exige resultado da revisão indicada; teste histórico não aprova automaticamente o SHA final. “Publicado” exige registro da imagem efetivamente servida e do banco. Operação/conteúdo não se tornam prontos por existência da rota. Resultados finais em `community-launch-review-20261115.md`.

Abreviações de evidência: **A** = `tests/community-access.integration.mjs`; **T** = `tests/member-toolbox.integration.mjs`; **E** = `tests/member-deliverables.integration.mjs`; **H** = `tests/member-auth-journey.integration.mjs`; **N** = `tests/login-return.test.mjs`, `tests/community-navigation.test.mjs`; **S** = `tests/member-support.test.mjs`; **M** = `tests/community-launch-metrics.integration.mjs`; **C** = `tests/member-toolbox-curation.integration.mjs`. Todos são caminhos em `make-it-fly-current/`. Stripe externo: `docs/stripe-annual-offer-validation-20261115.md`, histórico externo, não repetido com compra live.

| ID | Implementação/decisão preservada | Teste/evidência | Pendência |
| --- | --- | --- | --- |
| D01 | Oferta e cadastro gratuitos, sem cartão | A, H, página `/comunidade` | Destino do canal externo e operação da convivência. |
| D02 | Origens antigas em `lib/billing/store.ts` antes da cota | A, E; inventário real separado | Nenhuma revogação por migração; ensaio final cabe ao executor autorizado. |
| D03 | Endpoint de nova venda avulsa encerrado | A; `api/radar/checkout` | Preservar conciliação histórica. |
| D04 | Comunidade como destino; retorno permitido | N, A | Live e conteúdo anunciados dependem do Gate 2/3. |
| D05 | `radar_free_event`, dez posições por conta | A, E | Nenhuma ampliação para outras categorias. |
| D06 | IDs estáveis, unicidade e trava da conta | A, E | Reabertura não repõe/consome cota. |
| D07 | Candidato local e documentação revisável | Este pacote; prévia interna | Revisão concreta do proprietário. |
| D08 | 143880 BRL, anual, quantidade 1; sem mensal/parcelamento | A; sandbox externo histórico | Configuração live e ativação separadas. |
| D09 | `/membros/ferramentas`, gestão e migração 0019 | T, C | Manifesto editorial privado do lote coordenado; não expor no repo público. |
| D10 | Direito anual no servidor; Radar legado independente | A, T, E | Configuração e catálogo revisados antes de cobrar. |
| D11 | Quatro acessos reais; Trilha parcial, Benefícios conferidos | E, navegação | Benefícios e conteúdo pagos ainda não aprovados. |
| U01 | Oferta → cadastro gratuito → recurso permitido | N, H, formulários reais | Canal e orientação operacional. |
| U02 | Liberação explícita e saldo por titular | A, E | Conferência visual do SHA da prévia. |
| U03 | 11º evento → oferta com contexto; sem checkout automático | A, N | Não criar cobranças por excedente. |
| U04 | Legado preservado sem recompra | A, E | Inventário real antes/depois do futuro release. |
| U05 | Próxima atividade e entregável; guia de sete dias/segunda semana | E, N, `/membros/trilha` | Exercício original apenas candidato editorial; nenhuma aprovação inferida da resposta do usuário. |
| U06 | Assinatura/período/fatura, portal, cancelamento, suporte | A, S, sandbox histórico | Atendimento real, política comercial e configuração live. |
| U07 | Curadorias com autorização, auditoria e conflito de revisão | T, E, C | Responsáveis operacionais a confirmar. |
| U08 | Ferramentas por categoria, link oficial e condições | T, C, navegador interno | Não transformar links em licenças/créditos. |
| R01 | Mesma entrada gratuita e proposta anual; visual preservado | Testes da página de vendas, N | Alterações adicionais na página aprovada só após revisão; não remover promessas silenciosamente. |
| R02 | Dez liberações, repetição e múltiplos dispositivos | A, E | Sem renovação automática da cota. |
| R03 | Duas requisições no nono evento liberam só uma | A, E, PostgreSQL real sintético | Nenhuma conta real usada. |
| R04 | GET/RSC/prefetch/busca/listagem sem escrita de liberação | A, histórico HTTP/RSC 123 checks | Nova regressão visual proporcional; não atribuir histórico ao novo SHA. |
| R05 | Legado/compra/concessão separados da origem anual | A, T, E | Preservar fingerprints e não forçar journal. |
| R06 | Nova venda Radar 410/encaminhamento; histórico conciliável | A e testes legados do CI | Nunca apagar compras para adequar oferta. |
| R07 | Ledger canônico, eventos assinados/idempotentes; pausa só de novas vendas | A (15 checks), sandbox histórico | Repetição Stripe test da mudança operacional e configuração live conforme Gate 3; nenhum pagamento live. |
| R08 | Estrutura de conteúdo, próximo passo, fórum preservado | E, N, página Trilha | Conteúdo real revisado, operador, convivência e agenda confirmada. Bloqueio comercial. |
| R09 | Benefício exige acordo, condições, vigência e resgate | E; datas normalizadas após Drizzle | Nenhum acordo real fornecido; catálogo vazio não satisfaz entrega paga. |
| R10 | Admin protegido, saldo/fatura/progresso por titular, suporte público | A, T, E, S; CI de segurança | Operadores e caixa de atendimento a confirmar; reconciliação não cria pagamento. |
| R11 | Relatório agregado READ ONLY e contadores existentes com consentimento | M; `community-launch-metrics-20261115.md` | Conversão/ativação/retorno/churn exatos não medidos; definir cobertura antes de prometer indicadores. |
| R12 | Foco, teclado, móvel, estados e versão concreta | Histórico UI; checks proporcionais da prévia atual | Aceite do proprietário e CI exato do pacote. |
| F01 | Atalhos no início e MemberBar | T; render/navegador | Conferência visual integrada. |
| F02 | Categorias publicadas com ferramenta, filtro e ordem | T, C | Manifesto e operação editorial. |
| F03 | Ficha objetiva e condições verificadas | T, C | Sem gratuidade/licença/crédito presumidos. |
| F04 | HTTPS seguro, nova aba, noopener/noreferrer/no-referrer | T; inspeção de link | Revisão periódica do destino oficial. |
| F05 | Autorização antes da consulta, sem catálogo no HTML/RSC de inelegível | T, A; histórico HTTP/RSC | CI/navegador do candidato correspondente. |
| F06 | Cancelamento até fim pago; expiração/refund/risco independentes do legado | A, T, E | Gestão permanece durante pausa de vendas. |
| F07 | Mutações autorizadas, rascunho/publicação/arquivo e versões | T, C | Responsável editorial. |
| F08 | Catálogo/progresso não alteram saldo Radar | T, E, sandbox histórico | Sem nova ação de consumo em conectores. |
| F09 | Vazio/erro/foco/teclado/temas, links seguros | Histórico UI; prévia atual | Não tratar screenshot como prova de persistência. |
| F10 | Implementação/validação/preview antes da publicação | Commits locais e registro da prévia | Este chat não publica nem ativa cobrança. Release de outro chat exige evidência própria. |

Q01 e Q02 estão **resolvidas**: a escolha anterior não evento continua única e separada; se comprovadamente evento conta como primeira consulta, sempre preservando o acesso. Nenhuma delas é pergunta aberta nesta revisão.
