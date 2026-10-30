# Coletores de calendários — validação local em 29/10/2026

## Resultado e limite de homologação

Quatro adaptadores por edição foram implementados na ingestão existente e conectados à recoleta. **OBMEP e OBI passaram pela coleta real e persistência local. Comvest e Fuvest permanecem bloqueadas para coleta real.** Os testes dos dois últimos usam marcação representativa explicitamente identificada, não HTML obtido pelo coletor. Não considerar essas duas fontes homologadas para ativação.

| Fonte | Coleta protegida | Resultado local |
| --- | --- | --- |
| [OBMEP 2026](https://www.obmep.org.br/calendario.htm) | Aprovada | Uma ficha, oito etapas; inscrição encerrada e resultado futuro preservados |
| [OBI 2026](https://olimpiada.ic.unicamp.br/calendario/datas_importantes) | Aprovada | Uma ficha, 16 etapas; escolas/competidores, modalidades, níveis, fases e Semana Olímpica separados |
| [Comvest 2027](https://www.comvest.unicamp.br/ingresso-2027/vestibular-2027/) | Negada pelo robots.txt | Adaptador e casos representativos testados; fonte inativa, sem ficha importada |
| [Fuvest 2027](https://www.fuvest.br/vestibular-da-usp/) | robots.txt indisponível | Adaptador conservador e casos representativos testados; fonte inativa, sem ficha importada |

O comando de auditoria retorna código 1 quando alguma fonte está bloqueada. Esse resultado é registrado como bloqueio de coleta, não como aprovação de todas as fontes. Não há fallback para buscadores, remoção de robots, relaxamento de TLS ou tentativa de contornar bloqueios.

## Implementação

- Registro de quatro fontes na migração aditiva `0044_calendar_sources_local_validation.sql`, sempre **inativas e pendentes**. Reaplicação preserva configurações existentes. A única ativação desta rodada foi explícita, no banco local marcado, para OBMEP e OBI.
- OBMEP seleciona exclusivamente a linha de 2026 e confere os cabeçalhos. Envio de cartões-resposta, cadastro de professores, provas e divulgação de resultados têm significados distintos. Não interpreta avisos históricos de outras edições.
- OBI expande `rowspan` antes de associar datas aos níveis. Agrupa apenas níveis que compartilham modalidade e intervalo; grupos com horários diferentes permanecem separados. Janelas definidas pela escola ficam sem hora inventada. Competições internacionais externas não entram nesta ficha.
- Comvest exige uma linha substituta com data completa para a prorrogação; pagamento e outros processos de ingresso não se tornam inscrições do vestibular. Matrículas mantêm virada de ano e intervalos com horário.
- Fuvest exige edição e período de inscrição explícitos. Só extrai as três provas identificadas nos painéis; não inventa chamadas, resultados ou matrícula ausentes.
- IDs das etapas não incluem suas datas. Mudanças de prazo conservam a identidade da ficha. Hash de conteúdo desconsidera apenas o horário de conferência.
- Recoleta preserva alterações administrativas, falhas de rede/estrutura não apagam evidência anterior, e exclusões não recriam fichas. Uma página já pertencente a outra fonte também não vira uma duplicata por diferença de título.

## Ambiente e evidência real

Banco exclusivo: `127.0.0.1:48763/radar_calendar_editorial_local`, com marcador `apogee-radar-editorial-local-v1` e diretório PostgreSQL conferido antes de qualquer gravação. Nenhuma credencial de banco remoto é aceita pelo script local.

A coleta foi executada duas vezes por fonte permitida. Em ambas permaneceu exatamente uma ficha por fonte, com o mesmo ID. As duas aparecem na consulta de calendário e permanecem ausentes da vitrine de inscrições abertas. Nenhuma oportunidade real foi salva automaticamente na conta do usuário nem enviada ao Google.

Evidência pública sem segredos: `radar-academico/references/calendar-source-audit-20261029.json`. Os HTML completos, resultados locais e logs ficam em `.local/radar-calendar/source-audit/` e `/private/tmp/radar-collectors-*-20261029.log`. Fixtures oficiais no Git foram limitadas ao conteúdo do calendário; fixtures das fontes bloqueadas dizem expressamente que são representativas.

## Reprodução

Executar um processo por vez pela fila global, com o preview desta tarefa pausado mediante a autorização já recebida:

```sh
cd radar-academico
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/audit-calendar-sources.mjs
# Após preparar as migrações exclusivamente no banco editorial local identificado:
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/calendar-sources-local-integration.mjs
```

O segundo script aceita somente a auditoria recente de OBMEP/OBI, verifica o banco e usa a ingestão real com nova consulta às fontes; não injeta snapshots de busca no catálogo.

## Verificação final

- **969 testes automatizados distintos aprovados**: 539 da Apogee, 415 do Radar e 15 de permissões em PostgreSQL real descartável. Esses 15 aparecem ignorados na execução padrão sem banco e foram executados separadamente com sucesso. Reexecuções não são somadas.
- Salvos/ICS: integração com PostgreSQL real e cliente compartilhado Drizzle aprovada, incluindo isolamento, rotação e revogação.
- Google: integração com PostgreSQL real aprovada, simulando somente a API Google. Esta rodada não repetiu gravações reais na conta Google; a validação real anterior está no relatório específico.
- TypeScript e lint aprovados nas duas aplicações. O único aviso é o `<img>` preexistente da galeria administrativa.
- Builds finais Radar e Apogee aprovados em sequência pela fila. Nenhum processo pesado em paralelo.
- A primeira execução completa Apogee identificou a lista de rotas desatualizada: faltavam o callback Google e o endpoint interno de sincronização, já implementados e autorizados. Foram acrescentadas somente essas duas rotas explícitas ao teste, sem relaxar a comparação. A suíte inteira Apogee foi repetida e passou.
- O teste integrado cobre coleta, recoleta, retificação de data com mesmo ID, curadoria preservada, indisponibilidade sem remoção indevida, tombstones e conflito de identidade com outra fonte.
- Preview reaberto em `http://127.0.0.1:4381`. Navegador confirmou Semana Olímpica da OBI (06–12/12) e divulgação de premiados da OBMEP (15/12), ambas como acompanhamento. Três verificações HTTP 200 confirmaram a página completa e os filtros Matemática/Tecnologia.
- Capturas: `coletores-calendario-local.png` e `coletores-etapas-confirmadas.png`, no diretório de visualizações desta tarefa. Dados, sessões e conexão Google existentes foram preservados.

Comandos finais: `npm test` nas duas aplicações; `node scripts/test-runtime-roles.mjs` com `RADAR_POSTGRES_BIN`; `node scripts/calendar-local-integration.mjs`; `node scripts/google-calendar-local-integration.mjs`; `npm run typecheck`, `npm run lint` e `npm run build` em ambas (Apogee com `APOGEE_LOCAL_PREVIEW=1`). Todos executados pelo wrapper FIFO.

Nenhum push, deploy, túnel público, migração remota ou ativação em produção. Comvest e Fuvest dependem de disponibilidade permitida pelo servidor e de uma validação posterior com HTML real antes de qualquer uso do coletor.
