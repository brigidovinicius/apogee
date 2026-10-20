# Expansão de eventos, comunidades e competições — 20/10/2026

## Escopo e plano

Ampliar o perfil extracurricular do Radar usando o pipeline existente, uma ficha por edição, sem multiplicar vagas, equipes, trilhas ou dias. A leitura de produção de 20/10/2026 às 11:09 de Brasília confirmou 1.168 IDs publicados, oito com categoria `eventos` e cinco com `competicoes`; três fichas pertencem às duas categorias. Esses totais não devem ser somados como IDs distintos.

Preparar dez edições: WorkInTech/UniCesumar, Hackathon Connect 7.0, OBVC, SouJava novembro, Global Hack Week Builders e Open Source, DevOpsDays Florianópolis e Recife, Semana de Inovação Enap e REC’n’Play. O lote preparado contém nove fichas de eventos e três de competições, com duas interseções, totalizando dez IDs novos. A publicação efetiva está registrada ao final deste documento.

Arquivos: normalizador limitado às edições em `normalize-community-editions-20261020.ts`; integração de contagem, suplemento e normalização em `programme-catalogue.ts`; migração aditiva `0037_audited_community_editions.sql`, cadastrando fontes inativas e ainda sem verificação de produção; testes de regressão, fixtures mínimas e auditoria JSON em `references/`.

Reutilizar `fetchOfficialResource`, `confirmedTerminalStatus`, `eventHasNotStarted` e `publicationIssue`. Conferir título, datas, público, condições e chamada de inscrição na página oficial. Ausência de prazo não vira fluxo contínuo: preservar `not_informed` e retirar no início do evento. OBVC tem prazo de inscrição explícito em 31/10, distinto da entrega de projeto em 01/11; prêmios variáveis não são valores garantidos. Mudança de fatos exige nova auditoria; encerramento ou perda de inscrição impede publicação.

Validação: normalização dos HTML reais capturados pelo coletor protegido, testes de abertura/encerramento/expiração/mudança de evidência/duplicação, integração no pipeline, migração reaplicável em banco descartável, tipos, lint e suíte Radar, sequencialmente pela fila global. Preservar alterações alheias.

## Gates

A preparação inicial autorizava pesquisa e trabalho local. A autorização específica posterior de push/CI, migração, deploy somente do Radar e ativação das dez fontes está registrada em “Publicação autorizada”; os gates foram concluídos conforme “Resultado em produção”. Antes da ativação: revalidar cada URL a partir da VPS, revisar sobreposição com catálogo, backup restaurável, CI completo, SHA aprovado e implantação somente do Radar. Depois: ingestão limitada por fonte, repetição sem duplicatas, comparação de IDs e campos públicos/admin e filtros no site. Fontes rejeitadas ou pendentes não entram na migração.

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

No snapshot de referência, a projeção era eventos de **8 para 17** e competições de **5 para 8**. Esses totais foram confirmados após a publicação, com comparação de IDs e campos e filtros ao vivo, conforme o resultado abaixo. São números datados; eventos e inscrições podem encerrar depois da conferência.

## Checagem de acesso na VPS

Em 20/10/2026, entre 11:23 e 11:24 de Brasília, as dez URLs e o suplemento MLH foram obtidos a partir da VPS com `fetchOfficialResource`, respeitando robots, TLS, allowlist, tamanho e intervalo. O diagnóstico transitório executou somente GET público em memória, sem instalação, arquivos no servidor, banco ou alteração de serviços. Os hashes, bytes e horários estão no JSON de auditoria; log completo em `/private/tmp/radar-expansion-vps-audit-20261020.jsonl`.

Essa checagem inicial comprovou acesso às fontes a partir da VPS. Depois da autorização específica, a ingestão real voltou a obter e validar todo o conteúdo oficial e o suplemento MLH, sem falhas ou bloqueios. A publicação e os filtros ao vivo foram conferidos separadamente, conforme o resultado abaixo.

## Publicação autorizada

Em 20/10/2026, o usuário respondeu “ACEITO” à autorização específica de push/CI, migração, deploy somente do Radar e ativação das dez fontes, após CI e backup validado. A branch de release parte da main atual e contém apenas este lote. Fixtures de regressão compactadas para fatos e links de inscrição; o teste dos HTML oficiais integrais capturados continua registrado separadamente na auditoria.


## Resultado em produção — concluído

Conferência do bridge em **20/10/2026 às 11:51:45 de Brasília**:

| Indicador | Antes | Depois | Variação |
|---|---:|---:|---:|
| IDs publicados únicos | 1.168 | 1.178 | +10 |
| Eventos e comunidades | 8 | 17 | +9 |
| Competições e hackathons | 5 | 8 | +3 |

Categorias se sobrepõem: duas das dez novas fichas pertencem às duas categorias. Todos os 1.168 IDs anteriores foram preservados. Público/admin retornaram HTTP 200, bridge v3, os mesmos 1.178 IDs e os mesmos campos comuns: zero IDs exclusivos de cada lado, zero divergências de campos e zero IDs duplicados. A interface pública exibiu 1.078 cartões agrupados no mural geral; esse agrupamento de apresentação é distinto dos 1.178 IDs do catálogo. Nos filtros de eventos e competições, a interface exibiu respectivamente 17 e 8 cartões, sem agrupamentos adicionais nessas categorias.

### Release e proteção dos dados

- [PR #73](https://github.com/brigidovinicius/apogee/pull/73) integrado em 20/10/2026 às 11:43:14 de Brasília.
- [CI completo aprovado](https://github.com/brigidovinicius/apogee/actions/runs/39439966925): 314 testes Radar, 309 site, quatro legados, integração Gallery em PostgreSQL e 16 testes de convites. O E2E de membro autenticado passou com sessão real sintética, paginação, vestibular explícito, SC/Gaspar, busca, reset e controles de acesso.
- SHA Radar implantado: `7615c0a9951a9de47790753220a8d938589f97e1`. Sua árvore `2e15ae1e8b8cbf23698e6f4d2d935264858405ec` é idêntica à árvore validada pelo CI no head `00e5424d0abc9b1be733a2ac40afbbbe543402c8`.
- Backup `/opt/apogee-backups/radar-community-20261020T144224Z`: dumps consistentes, checksums, ambientes protegidos e inventário. Restauração isolada comparou fingerprints de 13 tabelas Radar e 16 tabelas de membros, todos iguais. Bancos temporários próprios removidos após validação.
- Migração `0037` aplicada; primeiro foram conferidas dez fontes inativas e pendentes, sem fichas. Somente depois do web saudável ocorreu a ativação autorizada, transacional e limitada aos dez IDs/URLs esperados.
- Deploy por SSH: fetch da main, checkout destacado no SHA exato, build de `web`, build/run do serviço `migrate` com cache e recriação somente de `web` com `--no-deps --no-build --force-recreate`. Nada de `pull`, reset, clean ou cópia manual de aplicação.
- Radar saudável, zero reinícios. Site saudável e preservado em `28747e8f74700f9ce5f33771ceca08bf645720f8`. IDs dos demais contêineres e os ambientes protegidos permaneceram iguais.
- Rollback disponível: imagem anterior `radar-academico:1bb4e6b7fe55dd2ae8b9ca9395d5eea973cd89b8`; em necessidade, desativar somente os dez novos IDs e recriar somente o web nessa imagem. Não restaurar todo o banco automaticamente sobre dados novos.

### Coleta e conferências

- Ativação em 20/10/2026 às 11:48:34 de Brasília, com `verification_method=operator_authorized_agent`; não é auditoria humana.
- Primeira rodada, 11:48:48–11:49:19: dez execuções concluídas, dez fichas criadas/publicadas, 12 páginas obtidas (duas para cada MLH), zero falhas/bloqueios/avisos.
- Segunda rodada, 11:49:38–11:50:08: dez execuções concluídas, zero criações, zero atualizações, zero falhas/bloqueios/avisos. Banco: exatamente uma ficha por fonte e vinte `ingestion_runs` concluídos.
- Todos os novos registros ficaram `approved`, `open`, verificados automaticamente, sem `publication_issue`, sem conflito, publicados e sem exclusão. Nove mantêm prazo não informado com início confirmado; a OBVC mantém prazo explícito de 31/10.
- Fontes configuradas com intervalo de 24 horas, última coleta registrada pela execução concluída e próxima prevista para 21/10/2026, aproximadamente 11:49–11:50 de Brasília. O horário efetivo depende da fila normal do scheduler.
- Flags `active` e `verification_status` de todas as fontes anteriores comparadas com o inventário anterior à migração: nenhuma alteração.
- Browser público: filtros 17 eventos / 8 competições; busca OBVC com um resultado; requisitos expandidos exibem taxas de R$60/R$120 e prêmios condicionais. Buscas HTTP no site encontraram cada uma das dez edições.
- Não foi criada sessão de membro em produção nem enviado e-mail de teste. O acesso de membro foi validado pelo E2E sintético do CI; a igualdade do conteúdo público/admin foi conferida ao vivo. O fluxo global de cron/alertas não foi invocado; as coletas usaram `sourceId` individual.

Evidência estruturada: `radar-academico/references/community-release-20261020.json`. Logs locais: `/private/tmp/radar-community-{deploy,activation,ingest-first,ingest-repeat,final-db,schedule,bridge-before,bridge-after,reconciliation}-20261020.*`.

### Ocorrência operacional resolvida

Um diagnóstico antigo foi executado antes de sua revisão e sobrescreveu apenas o inventário auxiliar de fontes de um backup histórico, sem alterar dumps, ambientes ou checksums. O inventário foi reconstruído a partir do próprio dump histórico em restauração isolada, comparado com a referência preservada e teve seus checksums conferidos. O backup novo desta release foi criado e validado separadamente. Depois houve indisponibilidade temporária de SSH/HTTPS; o acesso voltou antes do deploy, sem alterações de firewall, DNS ou serviços. O Web Console foi apenas consultado como contingência; nenhum comando de deploy foi executado nele.
