# Fila Google Agenda: retentativas, quotas e alertas locais

Implementação de 30/10/2026 no worktree `radar-calendarios-local-20261029`. Escopo autorizado: código, migração e testes **locais**, com dados fictícios. Nenhum push, deploy, alteração de produção, configuração Google, envio de e-mail ou alerta externo foi realizado nesta etapa.

## Comportamento implementado

As falhas agora gravam `consecutive_failures`, `retry_not_before` e `retry_paused` na conexão. A migração aditiva **0011_google_calendar_retries** acrescenta esses campos e uma linha de controle de espera do projeto. Foi aplicada apenas no PostgreSQL isolado do preview. Não se alteraram os arquivos de migração anteriores ou suas somas.

O atraso cresce exponencialmente: base de um minuto, depois dois, quatro, oito, e assim por diante, com variação aleatória positiva de até 25% e teto local de uma hora. Um `Retry-After` válido, em segundos ou data HTTP, é respeitado como piso e pode exceder esse teto. O horário fica persistido, não depende da memória do worker e não é contornado por salvar oportunidades ou por sincronização manual.

Após oito falhas consecutivas, as tentativas automáticas daquela conta são pausadas. Depois da espera, o titular pode retomar pelo botão **Sincronizar agora**. Sucesso e reconexão consentida zeram o histórico; uma passagem parcial sem falha também reinicia a série. Falta de permissão/resposta inválida pausa o processamento para correção/reconexão, e `invalid_grant` retira a credencial revogada da fila. Nenhuma senha ou token é exibido na interface de espera.

Tratamento de respostas:

| Resposta | Conduta |
| --- | --- |
| `403 userRateLimitExceeded` | Quota isolada à conta; outras contas podem continuar |
| `429` genérico, `rateLimitExceeded`, `quotaExceeded` ou `dailyLimitExceeded` | Pausa conservadora do projeto, além da retentativa da conta |
| `5xx`, `408`, falha de rede ou indisponibilidade do catálogo | Retentativa progressiva; não interpretar indisponibilidade como remoção de eventos |
| Permissão recusada ou requisição inválida | Pausar sem repetir indefinidamente |
| Credencial revogada | Sinalizar reconexão e deixar de tentar com aquela credencial |

A pausa ampla é uma escolha conservadora: a razão genérica nem sempre informa precisamente qual quota foi atingida. Ela pode atrasar outras contas para proteger o projeto. Somente a razão explicitamente por usuário recebe tratamento isolado. A classificação usa os campos estruturados do erro, sem procurar palavras em mensagens arbitrárias.

Operações bem-sucedidas e seus identificadores são preservados quando uma etapa posterior falha. A próxima execução retoma os eventos faltantes, usando IDs estáveis, sem recriar os anteriores. Permanecem a reserva com `SKIP LOCKED`, lease de três minutos, orçamento por chamada, lote padrão de três contas e limite de alterações por conta.

## Alertas e monitoramento

O monitor autenticado passou a incluir totais de quota, contas pausadas, retentativas em espera e fim da pausa do projeto. Erros, reconexões, contas pausadas e cooldown também tornam o monitor unhealthy mesmo sem atraso excessivo. Os campos são agregados; não incluem e-mail, ID de usuário, token, destino de alerta ou corpo de erro do Google. `due` continua significando conexões com prazo vencido; a contagem de pausadas é separada e não deve ser confundida com capacidade efetiva de processamento.

O worker detecta incidente de saúde da fila, falha de chamada, quota, pausa e reconexão necessária. Gera um evento de abertura e outro de recuperação, sem repetir a abertura a cada lote. Mudanças de contagem dentro do mesmo incidente permanecem nos logs/métricas. O estado é gravado atomicamente e preservado em reinícios.

Um webhook operacional opcional recebe somente o evento e as métricas permitidas. **O padrão é URL vazia, sem envio externo.** A interface do receptor é JSON com `component`, `type`, `eventId`, `incidentId`, `at`, `reasons` e `metrics`. A URL é configuração privada; não é registrada nos logs. HTTPS é exigido; HTTP só é aceito para loopback com o modo de preview local explícito. Redirecionamentos não são seguidos e a chamada tem timeout de cinco segundos.

Falha no receptor não desfaz a sincronização: o evento fica na outbox persistente e é reenviado com espera progressiva de um minuto até uma hora. A recuperação fica atrás da abertura pendente. A mesma chave `Idempotency-Key` acompanha as retransmissões; o receptor precisa deduplicá-la. A garantia de transporte é **pelo menos uma vez**, não exatamente uma vez em caso de crash entre aceite e gravação local.

A outbox tem limite de 64 eventos. Se o receptor ficar indisponível enquanto a saúde oscila, preserva o evento mais antigo não confirmado e compacta mudanças posteriores, informando `coalescedEvents` e `reconcileComponent: true`. O receptor deve tratar esse evento como reconciliação do componente: encerrar incidentes anteriores desse componente e aplicar a saúde atual indicada por `opened`/`recovered`, evitando um incidente antigo sem fechamento. Os logs locais continuam registrando as transições; nessa situação excepcional não se promete uma mensagem remota para cada transição intermediária.

Se o transporte for habilitado durante um incidente antes registrado somente em log, a abertura corrente será enviada uma única vez. Não é enviada uma recuperação isolada de incidente que terminou antes de o transporte ser habilitado.

Compose e Dockerfile foram preparados para o módulo de alertas e um volume dedicado de estado, gravável pelo usuário `nextjs`, mantendo o restante do filesystem somente de leitura. Nenhum Docker foi iniciado ou reconstruído no Mac ou na VPS. Esse preparo não instala o worker em produção.

## Configuração

| Variável | Padrão | Onde atua |
| --- | --- | --- |
| `GOOGLE_CALENDAR_RETRY_BASE_SECONDS` | 60 | Processo web |
| `GOOGLE_CALENDAR_RETRY_MAX_SECONDS` | 3600 | Processo web; `Retry-After` pode exigir mais |
| `GOOGLE_CALENDAR_RETRY_MAX_ATTEMPTS` | 8 | Processo web |
| `GOOGLE_CALENDAR_ALERT_WEBHOOK_URL` | Vazia | Worker; vazio desativa transporte externo |
| `GOOGLE_CALENDAR_ALERT_STATE_FILE` | `/tmp/apogee-google-calendar-alerts.json` fora do Compose | Worker; Compose usa volume em `/app/worker-state` |

Os parâmetros de retry são validados e uma configuração inválida falha de modo fechado. O webhook não precisa e não recebe o segredo interno de sincronização, credenciais OAuth ou conexão de banco. As variáveis novas foram documentadas nos exemplos, sem modificar `.env` reais.

## Validação

Todos os comandos Node/npm foram executados em sequência pela fila global. Apenas este preview foi pausado com a autorização já existente, preservando sessões, contas, salvos e a agenda de teste. A migração local verifica host, porta, banco e marcador antes de operar.

- Testes focados: **28/28** incluídos na regressão final, com parser de `Retry-After`, espera progressiva/aleatoriedade/teto, exaustão, classificação estruturada, erros OAuth, logs, deduplicação, reinício, falha do receptor, ordem de recuperação, compactação, habilitação posterior do transporte e proteção do destino.
- Integração nova: **29/29 verificações**, com PostgreSQL real em schema aleatório, driver original, `search_path` sem fallback público e HTTP real de loopback. A aplicação e o worker exercitam as respostas Google simuladas e um receptor de alertas local. Inclui falha após gravar parte dos eventos, retomada sem duplicação, espera contra cliques/salvos, pausa ampla versus por usuário, esgotamento, retomada manual e credencial revogada.
- Regressão da fila: sete conexões fictícias em lotes **3+3+1**, reserva concorrente ignorando linha bloqueada e lease de recuperação confirmados no PostgreSQL.
- Regressão OAuth/sincronização existente: state/PKCE, replay, isolamento de conta, criptografia, criação, atualização, cancelamento, remoção/restauração, indisponibilidade, perda de direito, desconexão/reconexão e revogação aprovados com banco local e respostas Google simuladas.
- Regressão completa do site: **552/552** na execução final. Lint sem erros, com o aviso preexistente de imagem em `gallery-admin`. Build do preview e tipos aprovados.

A regressão com o driver original detectou uma incompatibilidade de serialização do instante de retry; o valor passou a ser enviado como ISO e o teste foi repetido com sucesso. O antigo adaptador do teste de lote também foi corrigido para não substituir por prefixo o nome da nova tabela de cooldown. As fixtures próprias foram removidas ao final. Não foi solicitada quota real ao Google nem enviada notificação a um destinatário externo.

Comandos de referência no diretório `make-it-fly-current`, sempre via fila:

```sh
node --test --test-concurrency=1 tests/google-calendar*.test.mjs
node scripts/google-calendar-retries-local-integration.mjs
node scripts/google-calendar-queue-local-integration.mjs
node scripts/google-calendar-local-integration.mjs
npm test
npm run lint
APOGEE_LOCAL_PREVIEW=1 npm run build
npm run typecheck
```

Logs privados locais: `.local/radar-calendar/google-queue-full-tests.log`, `google-queue-lint.log`, `google-queue-build.log` e `google-queue-typecheck.log`. O backend Radar não mudou e sua suíte não foi repetida. A simulação não prova latência, quota disponível ou entrega a um serviço real em produção.

O preview foi reaberto ao final e a conta vitalícia fictícia permaneceu autenticada, com a oportunidade anterior preservada. A conferência visual de Meu calendário mostrou a conexão existente. Um smoke somente de leitura do monitor confirmou anônimo `401`, autenticado `200`, configuração ativa e métricas novas sem erro/reconexão/quota/pausa naquele instante. O GET não processou contas nem chamou o Google. Evidência privada: `.local/radar-calendar/google-queue-preview-smoke.json`; saúde é uma fotografia do momento, não prova de worker permanente instalado.

## Limites para a futura ativação

Continuam pendentes: autorização do release/migrações, operação de conferência, documentos HTTPS, branding/audiência Google e piloto publicado. A nova migração **0011** precisa ser incluída no inventário autorizado de produção antes de executar este código. Não ativar a fila usando somente o esquema anterior.

O transporte de alerta está implementado e testado localmente; falta escolher e autorizar um receptor real e testar sua deduplicação/entrega. Uma parada completa do processo/host não pode ser avisada por ele próprio: é necessário monitor externo para o healthcheck/endpoint e destino operacional aprovado. O polling do endpoint pelo worker mantém o intervalo de um minuto quando não drena lotes; a progressão persistente descrita aqui é por conta/provedor e na entrega de alertas.

Histórico de métricas, p95 por conta, limites reais do projeto e teto de usuários do piloto continuam sem medição em produção. O lote padrão de três contas não constitui limite validado de usuários nem SLA de atualização. Não foi implantado um serviço externo de métricas ou de alerta neste pedido.

Referências oficiais consultadas: [erros Calendar](https://developers.google.com/workspace/calendar/api/guides/errors) e [quotas e backoff](https://developers.google.com/workspace/calendar/api/guides/quota). A escolha de limites e pausas deste candidato é configuração de produto; não atribuir todos os parâmetros numéricos ao Google.
