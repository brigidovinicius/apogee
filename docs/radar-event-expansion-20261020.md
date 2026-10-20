# Expansão de eventos, comunidades e competições — 20/10/2026

## Escopo e plano

Ampliar o perfil extracurricular do Radar usando o pipeline existente, uma ficha por edição, sem multiplicar vagas, equipes, trilhas ou dias. A leitura de produção de 20/10/2026 às 11:09 de Brasília confirmou 1.168 IDs publicados, oito com categoria `eventos` e cinco com `competicoes`; três fichas pertencem às duas categorias. Esses totais não devem ser somados como IDs distintos.

Preparar dez edições: WorkInTech/UniCesumar, Hackathon Connect 7.0, OBVC, SouJava novembro, Global Hack Week Builders e Open Source, DevOpsDays Florianópolis e Recife, Semana de Inovação Enap e REC’n’Play. Expectativa local: nove fichas de eventos e três de competições, com duas interseções, totalizando dez IDs novos. Não é resultado publicado.

Arquivos: normalizador limitado às edições em `normalize-community-editions-20261020.ts`; integração de contagem, suplemento e normalização em `programme-catalogue.ts`; migração aditiva `0037_audited_community_editions.sql`, cadastrando fontes inativas e ainda sem verificação de produção; testes de regressão, fixtures mínimas e auditoria JSON em `references/`.

Reutilizar `fetchOfficialResource`, `confirmedTerminalStatus`, `eventHasNotStarted` e `publicationIssue`. Conferir título, datas, público, condições e chamada de inscrição na página oficial. Ausência de prazo não vira fluxo contínuo: preservar `not_informed` e retirar no início do evento. OBVC tem prazo de inscrição explícito em 31/10, distinto da entrega de projeto em 01/11; prêmios variáveis não são valores garantidos. Mudança de fatos exige nova auditoria; encerramento ou perda de inscrição impede publicação.

Validação: normalização dos HTML reais capturados pelo coletor protegido, testes de abertura/encerramento/expiração/mudança de evidência/duplicação, integração no pipeline, migração reaplicável em banco descartável, tipos, lint e suíte Radar, sequencialmente pela fila global. Preservar alterações alheias.

## Gates

Este pedido autoriza pesquisa e preparação local. Push, migração, deploy, ativação de fontes e publicação continuam sujeitos a autorização específica conforme `AGENTS.md`. Antes da ativação: revalidar cada URL a partir da VPS, revisar sobreposição com catálogo, backup restaurável, CI completo, SHA aprovado e implantação somente do Radar. Depois: ingestão limitada por fonte, repetição sem duplicatas, comparação de IDs e campos públicos/admin e filtros no site. Fontes rejeitadas ou pendentes não entram na migração.

## Lote preparado

| Edição oficial | Categoria | Realização | Inscrição | Condições principais |
|---|---|---|---|---|
| [WorkInTech / UniCesumar](https://www.workintech.com.br/) | Eventos e competições | 26–30/10/2026 | Prazo não informado | Maringá/PR; equipes de 4–6 no hackathon; confirmar vínculo e custos |
| [Connect 7.0](https://connectinovacao.com.br/hackathon/) | Eventos e competições | 14/11/2026 | Prazo não informado | Online/hubs no Brasil; gratuito; equipes de 3–5; autorização para menores |
| [OBVC](https://obvc.com.br/) | Competições | Entrega em 01/11/2026 | Até 31/10/2026 | Online; inscrição R$60/R$120; prêmios variáveis conforme inscritos |
| [SouJava novembro](https://encontros.soujava.org.br/talks/novembro-2026/) | Eventos | 13/11/2026 | Prazo não informado | Oracle São Paulo; confirmar horário convertido do calendário |
| [MLH Builders](https://events.mlh.com/events/14729-global-hack-week-builders-week) | Eventos | 06–12/11/2026 | Prazo não informado | Online/global; gratuito; menores com autorização |
| [MLH Open Source](https://events.mlh.com/events/15199-global-hack-week-open-source-week) | Eventos | 04–10/12/2026 | Prazo não informado | Online/global; gratuito; edição distinta de Builders |
| [DevOpsDays Florianópolis](https://devopsdays.org/events/2026-florianopolis/welcome/) | Eventos | 24/10/2026 | Prazo não informado | UNICESUSC, Florianópolis/SC; custo não informado |
| [DevOpsDays Recife](https://devopsdays.org/events/2026-recife/welcome/) | Eventos | 12/12/2026 | Prazo não informado | UNINASSAU Graças, Recife/PE; custo não informado |
| [Semana de Inovação Enap](https://semanadeinovacao.enap.gov.br/faq/) | Eventos | 10–12/11/2026 | Prazo não informado | Híbrido/Brasília; gratuito; atividades com reserva e lotação própria |
| [REC’n’Play](https://recnplay.pe/) | Eventos | 11–14/11/2026 | Prazo não informado | Recife/PE; gratuito; participante e voluntário são inscrições distintas |

A leitura complementar [Global Hack Week](https://ghw.mlh.com/) confirma gratuidade e alcance global das duas edições MLH. O coletor exige essa evidência em cada ciclo. Elas permanecem na categoria de eventos: desafios, pontos e brindes não foram convertidos em prêmio monetário ou competição para aumentar artificialmente o total.

## Seleção e rejeições

Foram auditadas sequencialmente 24 URLs pelo coletor protegido, contando páginas complementares. Datas, hashes, bytes e decisões estão em `radar-academico/references/source-audit-community-20261020.json`.

- UniSoma: mantém cronograma antigo até 25/10, mas anuncia encerramento em 15/10 por lotação. Lista de espera não é inscrição aberta.
- MIT Hacking Medicine: inscrição encerrou em 17/10. A data futura do evento não reabre inscrições.
- Hackapel: inscrição da equipe anuncia “Em breve”; edital de patrocínio não comprova inscrição do participante.
- DevOpsDays Belém, Brasília e Salvador: falta confirmar rota de inscrição do participante. CFP e patrocínio não substituem ingresso.
- DevFest Campinas e SECOMP: conteúdo necessário ausente do HTML estático obtido pelo coletor. Conteúdo de busca não substitui evidência coletável.
- DevFest João Pessoa: pendente de conciliar preços e localização entre os canais de inscrição.
- Aveiro: pendente de revisar integralmente elegibilidade e condições da etapa presencial em Portugal.
- IceHacks, LaunchPad e Bridge The Gap: falha de obtenção das páginas Devpost pelo coletor protegido. Fora do lote, sem contornar proteções.

## Validação local concluída

- Os dez HTML reais normalizados produziram uma ficha por edição, `open` e `publicationIssue=null` na data da auditoria.
- Suíte Radar: **47 arquivos / 314 testes aprovados**, incluindo 53 novos testes de encerramento, cancelamento, lotação, perda de inscrição, expiração, identidade, evidências, suplemento MLH e migração inativa reaplicável em PGlite.
- `npm run typecheck` e `npm run lint`: aprovados, executados sequencialmente pela fila global.
- Consulta `BEGIN READ ONLY` na VPS: **zero fontes e zero fichas existentes nas dez URLs canônicas**. É ausência de sobreposição exata, sem inserção ou publicação.
- Logs: `/private/tmp/radar-expansion-{tests,types,lint,dedup}-20261020.log`; normalização real: `/private/tmp/radar-expansion-normalized-20261020.json`.

No snapshot de referência, a adição integral do lote levaria eventos de **8 para 17** e competições de **5 para 8**. É uma projeção: datas e vagas podem encerrar antes da publicação. O lote ainda está local; nenhuma fonte ativada ou ficha publicada por este trabalho.

## Checagem de acesso na VPS

Em 20/10/2026, entre 11:23 e 11:24 de Brasília, as dez URLs e o suplemento MLH foram obtidos a partir da VPS com `fetchOfficialResource`, respeitando robots, TLS, allowlist, tamanho e intervalo. O diagnóstico transitório executou somente GET público em memória, sem instalação, arquivos no servidor, banco ou alteração de serviços. Os hashes, bytes e horários estão no JSON de auditoria; log completo em `/private/tmp/radar-expansion-vps-audit-20261020.jsonl`.

Isso comprova acesso às fontes a partir do ambiente de produção, mas ainda não comprova ingestão, publicação ou filtros ao vivo. As validações locais passaram; push/CI, backup restaurável, SHA de release, migração, deploy, ativação, ingestão repetida e conferência público/admin continuam pendentes de autorização e execução.

## Publicação autorizada

Em 20/10/2026, o usuário respondeu “ACEITO” à autorização específica de push/CI, migração, deploy somente do Radar e ativação das dez fontes, após CI e backup validado. A branch de release parte da main atual e contém apenas este lote. Fixtures de regressão compactadas para fatos e links de inscrição; o teste dos HTML oficiais integrais capturados continua registrado separadamente na auditoria.
