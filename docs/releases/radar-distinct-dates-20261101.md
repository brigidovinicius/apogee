# Inscrições e realização do evento — candidato local de 01/11/2026

## Comportamento

A home e os cards públicos e detalhados do Radar apresentam campos distintos:

- **Inscrições até**: prazo de encerramento confirmado em `deadlineAt` ou `deadline`.
- **Data do evento**: início confirmado em `eventStartsAt`.
- Datas ausentes permanecem como **Prazo não informado** ou **Data não informada**. Uma data nunca preenche o campo da outra.
- Datas incluem o ano. Horários confirmados usam Brasília; datas sem horário preservam o dia informado, sem inventar meia-noite. Nos detalhes, a ausência de horário é indicada.
- Cursos em fluxo contínuo conservam essa informação e não recebem uma realização fictícia.

O componente compartilhado não altera dados, ingestão, classificação, filtros, calendário ou contagem regressiva. O serviço Radar e os arquivos de expansão de fontes, tratados pelo outro chat, permanecem fora deste commit.

## Validação

Todos os comandos de projeto passaram sequencialmente pela fila FIFO local.

```sh
node --test --test-concurrency=1 tests/opportunity-dates.test.mjs tests/earth-home.test.mjs tests/radar-member-feed.test.mjs tests/radar-catalogue.test.mjs tests/radar-deadline-mapping.test.mjs tests/opportunity-countdown.test.mjs
npm run lint -- lib/opportunities/date-summary.ts components/opportunities/opportunity-dates.tsx components/opportunities/opportunities-board.tsx components/home/earth-radar/earth-radar-list.tsx components/home/home-radar-list.tsx tests/opportunity-dates.test.mjs tests/earth-home.test.mjs tests/radar-member-feed.test.mjs
npm run typecheck
git diff --check
```

Resultados: **66 testes aprovados**, lint e TypeScript sem erros. Cobertura inclui datas distintas, dados ausentes, datas inválidas, fuso, virada de ano, fluxo contínuo e renderização da home e dos cards públicos/detalhados.

Validação ampliada após autorização: **599/599 testes do site aprovados** com `npm test`; lint do teste de processos seletivos aprovado. O carregador explícito desse teste foi atualizado para importar o componente real de datas. A primeira execução do CI identificou essa dependência ausente; o comportamento do produto permaneceu igual à prévia revisada.

Preview exclusivamente local, com três oportunidades sintéticas identificadas como teste: inscrições em 09/11 e evento em 25/11; evento sem prazo divulgado; competição sem realização informada. Home verificada em 1440, 900, 390 e 320 px; Radar público em 900 e 320 px; detalhe público em 900 px. Sem rolagem horizontal ou erros/avisos no console. O card detalhado de membros foi verificado por renderização automatizada, sem autenticar uma conta real. O servidor temporário foi encerrado após as verificações.

Evidências locais em `/Users/viniciusbrigido/.codex/visualizations/2026/11/01/01a1972e-f3bb-7002-87da-050e3bfc5b5a/`:

- `home-datas-desktop-20261101.jpg`
- `home-datas-mobile-20261101.jpg`
- `radar-datas-mobile-20261101.jpg`

## Publicação

O usuário autorizou envio e publicação após revisar a prévia. Branch `fix/radar-distinct-dates-20261101`, baseado em `2b2c0b9a4c6849dce5fa813c6503e6c10b991f1d`, enviado no [PR #108](https://github.com/brigidovinicius/apogee/pull/108). A publicação permanece condicionada ao CI completo aprovado. Até este registro, não houve deploy, preview hospedado ou gravação de dados reais desta alteração.
