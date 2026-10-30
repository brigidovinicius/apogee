# Google Agenda: monitor e capacidade — candidato local

Implementação local em 30/10/2026. Nenhum push, deploy, instalação de serviço, acesso à VPS, alteração no consentimento Google ou envio de alerta externo foi realizado nesta etapa. Somente Google Agenda; assinatura `.ics` e Calendário do Mac permanecem fora do escopo.

## Monitor independente

`make-it-fly-current/scripts/google-calendar-monitor.mjs` consulta o endpoint protegido por HTTP, em processo separado do worker. A credencial `GOOGLE_CALENDAR_MONITOR_SECRET` deve ser diferente de `GOOGLE_CALENDAR_SYNC_SECRET`: permite GET, mas não POST, processamento de contas ou escrita do heartbeat. Credenciais iguais são recusadas. O endpoint permanece indisponível anonimamente.

O worker registra início, sucesso e falha de cada lote no PostgreSQL. O monitor verifica a idade desse registro mesmo com fila vazia; por padrão, mais de 240 segundos, ausência ou data futura deixam a condição insalubre. Também detecta conexão recusada, timeout, respostas inválidas, falhas de sincronização, quota, reconexão, pausa e projeção de escoamento acima do orçamento configurado. Consultar o monitor não chama as APIs do Google.

O processo exige origem explícita, HTTPS fora do preview, não segue redirecionamentos e limita tempo e tamanho da resposta. No modo local, origem e receptor de alertas precisam ser loopback. Saída e arquivos contêm apenas campos agregados permitidos; não incluem conta, token, calendário, evento, cabeçalhos ou corpo de erro do provedor.

Alertas de abertura e recuperação reutilizam a outbox persistente, deduplicação, chave de idempotência, espera progressiva e limite de pendências. O receptor também deve respeitar a idempotência: uma entrega pode ser repetida quando o reconhecimento se perde. Arquivos são gravados atomicamente com modo 0600, em diretório restrito. Sem webhook não há entrega remota. Evitar configurar dois notificadores para o mesmo incidente sem definir a reconciliação entre eles.

`--once` retorna 0 para saudável, 1 para condição insalubre e 2 para erro de configuração/estado. `--healthcheck` confere a execução recente do próprio monitor; pode retornar saudável enquanto o alvo está indisponível, pois mede a vida do monitor, não a saúde do alvo. A perda do host do próprio monitor exige supervisão adicional fora dele.

## Métricas e limites da projeção

A migração `0012_google_calendar_observability` foi aplicada exclusivamente ao banco local identificado pelo marcador de teste. Ela cria histórico por tentativa, sem identificadores de pessoas, contas ou eventos, e os campos do heartbeat. Migração de produção continua pendente e exige autorização própria.

Cada tentativa registra duração, resultado, chamadas HTTP ao Google (incluindo renovação do token), respostas HTTP não 2xx, erros de rede, respostas de quota e escritas de eventos confirmadas pelo provedor. Uma escrita confirmada pode ser contada mesmo se outra etapa falhar depois. HTTP 404/409 usados na recuperação idempotente também entram no contador HTTP; esse contador não equivale a sincronizações malsucedidas. Instrumentação usa contexto assíncrono para separar tentativas concorrentes. Falha na gravação da métrica é registrada sem dados privados e não altera o resultado da sincronização.

O endpoint apresenta volume observado, média, p95, taxa de sincronização completa, chamadas, erros, quotas e eventos alterados. A janela padrão é de 15 minutos. Tentativas sem chamada ao provedor são contadas, mas não entram nas durações e taxa de sucesso do provedor. O p95 usa `percentile_cont(0.95)` no PostgreSQL; a taxa é sincronizações completas / tentativas com chamadas, não usuários únicos. A duração inclui o trabalho da tentativa até seu resultado, antes da inserção da própria telemetria.

O histórico mantém no máximo 10.000 IDs recentes e remove registros anteriores a 24 horas a cada gravação ou heartbeat de sucesso, inclusive com fila vazia. A limpeza precisa do processo e do banco disponíveis; não promete eliminação física pontual durante uma indisponibilidade. Consultas excluem amostras antigas e futuras independentemente da limpeza.

Estimativas exigem pelo menos 20 tentativas com provedor por padrão, p95 positivo e ausência de falha, execução parcial, quota, reconexão, pausa ou cooldown na amostra/fila. Caso contrário, retornam `null`, nunca capacidade ilimitada. `observedSyncedPerMinute` representa volume ocorrido na janela. `estimatedFullSyncsPer15Minutes` é uma projeção de sincronizações completas sob a mesma mistura de trabalho, não quantidade de usuários atendidos ou teto de quota do Google.

O modelo considera um worker serial, p95 por tentativa e a pausa de um segundo entre lotes: `tempo por tentativa = p95 + 1000 / tamanho do lote`, em milissegundos. O escoamento multiplica esse valor por `ready`, as contas elegíveis agora; contas retidas por quota/retry/pausa não são uma promessa de entrega nesse tempo. Catálogo, volumes por conta, latência do banco e do Google, frequência das alterações, erros e trabalho novo podem mudar o resultado. Não é SLA ou benchmark de capacidade real.

Com 25 durações fictícias de 1 a 25 segundos, média de 13 segundos, p95 de 23,8 segundos e lote de três:

| Contas fictícias prontas | Projeção do escoamento |
| --- | --- |
| 10 | 242 segundos |
| 30 | 724 segundos |
| 100 | 2.414 segundos |

Esses números verificam a fórmula com dados conhecidos. Não dimensionam a operação publicada. O alerta de pressão compara a projeção disponível com `GOOGLE_CALENDAR_MONITOR_DRAIN_BUDGET_SECONDS`, padrão 900; atraso e saúde continuam sendo avaliados mesmo quando não há amostra suficiente para projetar.

## Preparação operacional, ainda não instalada

Os modelos `make-it-fly-current/infra/monitor/google-calendar-monitor.env.example` e `apogee-google-calendar-monitor.service.example` preparam execução futura em outro host. O pacote precisa de Node compatível e de `google-calendar-monitor.mjs` e `google-calendar-alerts.mjs`; não precisa de banco, OAuth ou segredo de escrita. Os arquivos não criam usuário, serviço, host ou destino.

Antes de instalar, definir host independente, responsável, credencial de leitura restrita, receptor autorizado, retenção/acesso aos agregados e supervisão do monitor. Copiar os dois scripts para o diretório indicado no modelo, preparar usuário sem privilégios e arquivo de ambiente restrito, e validar permissões e caminhos. Revisar o serviço e ambiente com o operador; a implantação deve usar o processo autorizado e o SHA exato. Manter estado durável fora de `/tmp` no serviço real.

Configuração principal do aplicativo: `GOOGLE_CALENDAR_MONITOR_SECRET`, `GOOGLE_CALENDAR_METRICS_WINDOW_MINUTES`, `GOOGLE_CALENDAR_METRICS_MIN_SAMPLES` e `GOOGLE_CALENDAR_WORKER_MAX_AGE_SECONDS`. Configuração do monitor: origem, mesma chave de leitura, intervalo, timeout, orçamento de escoamento, webhook opcional e caminhos de estado/snapshot. O preflight agora inventaria a migração 0012 e exige a chave de leitura distinta; continua somente leitura e retorna `releaseAuthorized:false`.

Permanecem pendentes para usuários reais: aprovações jurídica/comercial e do procedimento supervisionado, revisão de contas existentes, atendimento demonstrado, branding/audiência/verificação aplicável do Google, entrega e migração autorizadas, instalação do worker e monitor fora do host, receptor real, quotas observadas, teto do piloto e teste consentido no ambiente publicado. A implementação local não conclui esses gates.

## Validação

Resultados confirmados nesta etapa:

- `npm test`: **578/578 testes**, zero falhas e zero skips na execução final. Os 23 testes focados de monitor/capacidade/telemetria/alertas também passaram.
- `node scripts/google-calendar-retries-local-integration.mjs`: **70 verificações**, PostgreSQL real, HTTP loopback e worker/monitor em processos separados. Provedor Google simulado; nenhum envio a destinatário externo.
- A integração verificou p95 conhecido, janela temporal, persistência entre módulos, limite de 10.000 registros e limpeza de 24 horas, worker parado com fila vazia, queda/timeout do aplicativo, recuperação, pressão de capacidade, ausência de chamadas ao Google por GET, falha de entrega/outbox, idempotência entre reinícios e permissões dos arquivos. O receptor local recebeu 11 tentativas de notificação, incluindo a repetição da entrega que respondeu 503.
- Build local e `npm run typecheck` passaram; `npm run lint` passou sem erros, com somente o aviso preexistente de `<img>` em `gallery-admin`.
- `node scripts/google-calendar-queue-local-integration.mjs` confirmou drenagem de sete conexões fictícias, lotes, exclusão de linhas bloqueadas e lease de recuperação. `node scripts/google-calendar-local-integration.mjs` confirmou OAuth/PKCE, isolamento/replay, criptografia, idempotência, alteração/cancelamento de etapas, remoção/restauração, indisponibilidade, revogação de acesso e desconexão/reconexão, com respostas Google simuladas.
- Preview reaberto em `http://127.0.0.1:4381/membros/meu-calendario`, com conta `local_vitalicio`, oportunidade fictícia salva e conexão de QA preservadas, confirmadas no navegador. GET anônimo do monitor: 401. GET autenticado de leitura: 503, `workerHealthy:false`, heartbeat ausente, zero amostras e projeções `null`, como esperado: os processos da integração foram descartados e nenhum worker permanente foi iniciado contra a conta Google conectada. Não foi clicado em sincronizar nem executado POST nesse preview durante esta etapa.

Nas repetições, foi identificado e corrigido um problema de horário na outbox: ao consultar o relógio novamente ao enfileirar, o primeiro alerta podia ficar elegível um milissegundo depois do horário da própria observação e aguardar o próximo ciclo. O teste com relógio que avança reproduziu a falha antes da correção; depois passaram abertura e recuperação imediatas, mantendo o backoff das entregas malsucedidas. Diagnósticos de falha da integração contêm apenas estados agregados e incidentes fictícios.

Todos os comandos de projeto rodaram pela fila global obrigatória. Os processos descartáveis e o esquema aleatório da integração foram encerrados/removidos pelo próprio teste; a conexão Google de QA e as oportunidades salvas do preview foram preservadas. Logs ficam em `.local/radar-calendar/google-monitor-*` e não são versionados. O backend editorial não mudou nem teve sua bateria repetida nesta etapa. Não foi realizado teste de carga contra o Google ou validação de quotas reais.

Referências técnicas: [PostgreSQL — agregações e percentis](https://www.postgresql.org/docs/current/functions-aggregate.html), [Node — contexto assíncrono](https://nodejs.org/api/async_context.html). Continuidade: [revisão de liberação](google-agenda-current-readiness-20261030.md) e [retentativas da fila](google-agenda-fila-retentativas-local-20261030.md).
