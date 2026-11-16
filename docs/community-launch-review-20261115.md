# Comunidade Apogee — versão concreta para revisão

## Parecer

O candidato local `40dbfc46fd2594f3829bf82442f3b1beacd1032b` implementa e testa as lacunas comprovadas. **Não está liberado para abrir vendas.** Faltam conteúdo/acordos, operação e configuração/aceite live. Este chat não publicou, migrou produção, enviou mensagens a pessoas ou ativou cobranças.

A base foi `73b90ff`, preservando o design aprovado e os módulos já implementados. Trabalho em clone isolado `community-launch-validation-20261115`, sem editar a árvore do chat de release. Sem nova dependência, schema ou migração; hashes de 0019/0020 preservados.

## Mudanças e reaproveitamento

Já existiam cota transacional, direitos legados, autenticação/proteção, captura real, checkout/ledger/portal anuais e catálogos. Não foram reimplementados. Correções deste chat:

- `0379c4f`: pausa de vendas preserva webhook, portal, cancelamento e conciliação.
- `ca2d3f3`: revisão opaca da linha e trava para os quatro tipos de curadoria; conflito preserva campos; corrige datas após Drizzle.
- `c186a7b`: suporte sem login, ajuda nos formulários e retorno que recusa loops de autenticação.
- `8cc5784`: relatório operacional agregado em transação READ ONLY, sem nova telemetria ou exportação de identidade; métricas não suportadas retornam null com motivo.
- `ee26d5f`: orientação da primeira/segunda semana com recursos existentes e instância/porta separadas para revisão.
- `40dbfc4`: incorpora o candidato coordenado `cd6a2e5`, inclusive curadoria privada e apresentação administrativa durante pausa. O único conflito foi a união dos scripts de package.json, preservando ambos os lotes.

Os três primeiros patches foram revisados/incorporados pelo executor autorizado da release como `ebba7f1`, `adc7d00`, `513d057`; apresentação administrativa em `cd6a2e5`. Indicadores/orientação/documentos deste chat permanecem lote separado. Nenhuma autorização de publicação é transferida por esta coordenação.

## Resultados e limites por revisão

| Evidência | Revisão/ambiente | Resultado |
| --- | --- | --- |
| Tipos, lint e build | `40dbfc4`, local, fila 2134, dependências existentes | Typegen/typecheck/build aprovados. Lint: zero erros; aviso anterior em `gallery-admin.tsx:87`. |
| Suíte geral | `40dbfc4`, fila 2134 | **796/796**, zero ignorados/falhas. |
| Ciclo anual/cota e pausa | `0379c4f`, PostgreSQL sintético nativo, fila 2123 | **15/15**; pagamento assinado, replay, reembolso, cancelamento/portal durante pausa, falha após recibo com rollback/retry, configuração parcial recusada. Provedor explicitamente simulado. |
| Entregas, concorrência e datas | `ca2d3f3`, PostgreSQL sintético, fila 2130 | **12/12**; quatro disputas de edição, uma vencedora/entrada de auditoria, versão ausente/antiga recusada; vigência renderizada após Drizzle. |
| Login/retorno e suporte | `c186a7b`, fila 2130 | **8/8** retornos/login + **1/1** suporte/proxy público. Não altera audiência Google nem prova email externo. |
| Métricas | `8cc5784`, PostgreSQL sintético próprio, fila 2132 | **1/1**, transação comprovadamente somente leitura, modo/separações/base/cálculos e ausência de PII/escrita. |
| Integração/CI da release coordenada | `cd6a2e5`, PR #180, conferência separada | [CI 43792273367](https://github.com/brigidovinicius/apogee/actions/runs/43792273367) conferido: sucesso; [PR #180](https://github.com/brigidovinicius/apogee/pull/180) integrado em `695ec3d125ee5ec8fd6545715f6f320c99c3eb78`, head `cd6a2e5`. Executor registrou 796 gerais e 49 integrações. É CI do núcleo incorporado; não declarar os arquivos adicionais de métricas/orientação como cobertos por esse CI. |
| Stripe externo | Relatório de 15/11, candidato anterior; apenas test | 20 recibos aceitos, compra/recusa/repetição, portal, cancelamento, renovação paga/falha e reembolso. Não repetido aqui; mudanças novas de pausa têm regressão PostgreSQL com provedor simulado. |
| Navegador interno | Código `40dbfc4`, porta 3473, banco novo com marcador próprio, email/Stripe bloqueados | Suporte anônimo; login com retorno a Benefícios; criação/publicação sintética, vigência, duas abas com conflito e campos preservados, descrição vencedora após reload; arquivamento da fixture. |
| Móvel/teclado | Mesma prévia, 390 × 844 | Caixa/Trilha com scrollWidth 390. Space concluiu atividade; foco voltou ao botão em y406–454; progresso 1/3 persistiu após reload em outra aba. Link oficial com noopener/noreferrer/no-referrer e indicação de nova aba. |
| Observações de UI | Desenvolvimento | Automação de date.fill não preencheu o controle nativo; teclado preencheu e persistiu. Um aviso de hidratação de `<details open>` foi observado após reabrir uma ficha; não tratado como console universalmente limpo. A tentativa final de mídia reduzida não foi concluída após expirar a janela; não contar como novo check aprovado. |
| Produção — snapshot direto inicial | SSH somente leitura | Checkout `b6810ce`, imagem/label `4dfef55`, healthy/0 reinícios, 19 migrações, sem schemas 0019/0020, cinco legados/zero compras/zero anuais; modo live, vendas false e produto/preço/portal anuais ausentes. |

Logs locais: `/private/tmp/apogee-launch-{typegen,types,lint,unit,build}.log`. Capturas em `/Users/viniciusbrigido/.codex/visualizations/2026/11/16/01a1e216-3a67-7400-843e-8e962c2ca1b8/`: `suporte-publico-desktop.jpg`, `conflito-curadoria.jpg`, `exercicio-inicial-desktop.jpg`, `trilha-mobile-progresso.jpg`. Somente fixtures; não contêm dados reais.

## Produção atual conferida separadamente

Após o aviso do executor do outro chat, nova consulta SSH somente leitura confirmou checkout e label **`cd6a2e595ce6ba02cd3a4354136d3f0647c2315f`**, imagem `sha256:49a284283f0743112a770fcc4ea61021948b584867931b15cc1d2dd3742dc2cf`, healthy e zero reinícios. Banco: **21 migrações, 26 ferramentas/8 categorias, zero benefícios, zero atividades da Trilha, cinco legados, zero compras registradas e zero assinaturas anuais**. Vendas false; produto/preço/portal anuais ausentes. Isso confirma código/schema/curadoria publicados pelo executor autorizado, **não prontidão comercial**. Os acréscimos de indicadores/orientação/PRDs deste clone não foram publicados.

O executor informou backup/restauração/ensaio real isolado, repetição sem alterações e preservação dos serviços vizinhos; esses procedimentos não foram repetidos neste chat. Sua evidência operacional permanece no registro privado daquele release.

## Prévia e conteúdo editorial

Rota: `http://127.0.0.1:3473/membros/trilha`; guia de contas em `/previa/validacao`. Conta anual sintética `revisaoanual@example.test`, senha exclusivamente local `RevisaoLocal2026!`. Não são contas de produção. A janela temporária encerra normalmente e conserva o PostgreSQL; reiniciar pelo comando abaixo retoma só banco com marcador deste worktree.

```sh
cd '/Users/viniciusbrigido/.cline/worktrees/04981/Apogee - Site Interativo/community-launch-validation-20261115/make-it-fly-current'
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py status
APOGEE_REVIEW_INSTANCE=launch-validation-20261115 APOGEE_REVIEW_PORT=3473 APOGEE_REVIEW_DURATION_SECONDS=900 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/local-offer-review.mjs
```

O [texto completo do exercício](review/starter-exercise-20261115.md) “Um primeiro resultado com IA” propõe escolher tarefa, preparar pedido com dados permitidos e conferir resultado. Entregável: roteiro com tarefa/critérios/avaliação. **Não aprovado para venda/publicação.** Não há formação completa, certificação ou mentor implícitos. O benefício usado na UI era explicitamente fictício e foi arquivado; não comprova parceiro ou entrega comercial.

## Gates: pronto / falta / responsável / evidência / bloqueia vendas

| Gate/item | Pronto | Falta | Responsável | Evidência | Bloqueia vendas |
| --- | --- | --- | --- | --- | --- |
| 1 — candidato integrado | Sim, local | Revisão concreta | Proprietário | `40dbfc4`, diff/commits, rotas/direitos | Sim, até aceite. |
| 1 — checks locais | Sim | CI exato dos acréscimos separados (núcleo já tem CI próprio) | Executor técnico, após autorização de envio da branch | 796 testes/tipos/lint/build; integrações acima | Sim, para release desse lote. |
| 1 — D/U/R/F | Conferidos, cobertura explícita | R08/R09 conteúdo/operação e R11 indicadores ainda limitados | Produto/operação | Rastreabilidade e relatório de métricas | Sim, não omitir os limites. |
| 2 — oferta/condições | Anual integral de referência coerente no núcleo | Aceite final dos textos de renovação, cancelamento, atendimento/reembolso sem inventar política | Proprietário | PRDs v0.8/v0.4 e oferta aprovada | Sim. |
| 2 — Trilha | Estrutura/progresso e candidato editorial | Aprovar conteúdo real parcial e manutenção | Proprietário/conteúdo a designar | Prévia e texto completo em content/member-starter.mjs | Sim. |
| 2 — Caixa | Código/gestão testados; curadoria coordenada separada | Operador e rotina mensal/relatos | Curadoria a designar | T/C, manifesto privado e registro próprio da release | Sim, até entrega/rotina confirmadas. |
| 2 — Benefícios | Catálogo e validação implementados | Acordos/condições/resgate reais; nenhum fornecido | Proprietário/parcerias | Estado vazio honesto; fixture arquivada | **Sim.** Não remover a promessa silenciosamente. |
| 2 — canal/moderação/suporte/evento | Rotas e modelos preparados | Destino aprovado, atendimento real, operadores e orientações efetivas | Proprietário/operação | Runbook operacional; perguntas pendentes | **Sim.** Lead gravado sozinho não completa jornada. |
| 2 — email/OAuth | Testes locais interceptados | Domínio/entrega/audiência/callback no provedor proprietário | Operador proprietário | H; flags não provam entrega | Sim. |
| 2 — indicadores | Base agregada verificável | Resultado/consentimento/cobertura para taxas por coorte e rotina de acompanhamento | Produto/operação | READ ONLY, campos não medidos explícitos | Definições/operação pendentes; metas 60%/40% não são gates técnicos. |
| 3 — banco/deploy | Procedimento preparado; release própria do outro chat confirmada em leitura | Sem reaplicar 0019/0020 já presentes; conferir backup/restore privado antes de mudança futura | Executor autorizado desse release | Snapshot/registro próprio, backup/restore/journal | Sim, para mudança futura ainda não aprovada. |
| 3 — Stripe live | Vendas permanecem false | Conta/produto/preço/portal/webhook live, smoke, operação e autorização específica | Proprietário/executor autorizado | Nenhuma configuração live feita aqui | **Sim.** |
| 3 — ativação/rollback | Semântica da pausa corrigida e runbook | Aceite dos Gates 1/2 e autorização da versão concreta para cobrar | Proprietário | Pausa não bloqueia contratos/gestão | **Sim.** |

Referências: [mapa de rotas/direitos](community-launch-routes-rights-20261115.md), [D/U/R/F](community-launch-traceability-20261115.md), [indicadores](community-launch-metrics-20261115.md), [operação/ativação/rollback](community-launch-operation-20261115.md), [runbook técnico existente](offer-completion-runbook-20261115.md). Nenhum indicador nulo é resultado zero e nenhuma captura sintética comprova operação live.
