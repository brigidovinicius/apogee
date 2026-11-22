# Piloto de medição do Radar com Amplitude

Piloto desenvolvido sobre a revisão web `93e02b7` e preparado para publicação sobre `78ceee3`.

| Evento | Origem |
| --- | --- |
| `radar_list_viewed` | Catálogo público ou de membros exibido no navegador, com sessão elegível. |
| `radar_detail_viewed` | Resumo público ou detalhe acessível exibido. |
| `radar_opportunity_saved` | Criação ou reativação de um salvamento na agenda confirmada pelo PostgreSQL. |
| `radar_official_link_clicked` | Ativação de um link de fonte oficial no Radar. |

A preferência é independente da medição agregada. A sessão precisa pertencer a uma conta com e-mail confirmado e revisão de maioridade aprovada. A adesão cria uma permissão versionada em PostgreSQL. Revogar a permissão invalida o identificador dessa adesão em todas as abas e dispositivos. DNT e GPC bloqueiam os eventos e permitem revogar a preferência. O servidor confere a permissão novamente antes de iniciar uma entrega assíncrona. Uma requisição que já saiu pode concluir durante a revogação.

A API recebe somente o nome de um evento permitido e o identificador da adesão. O servidor envia o nome, o horário, um identificador de inserção e um identificador de analytics derivado por HMAC. As duas ações web de salvamento emitem o sucesso diretamente no servidor após a gravação. A entrega é de melhor esforço, sem fila persistente ou retentativas, e tem timeout de dois segundos.

## Ensaio no Mac

Use a fila global, na pasta `make-it-fly-current`. O script exige Chrome, Playwright e os comandos `initdb` e `pg_ctl`. Para uma instalação compartilhada do Playwright, aponte `BEHAVIOR_PLAYWRIGHT_MODULE` para o respectivo `index.mjs`.

```sh
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py status
APOGEE_LOCAL_PREVIEW=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 \
  /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command npm run build
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/test-radar-amplitude-browser.mjs
```

O ensaio sobe somente processos próprios em loopback e usa a porta `4381` para a aplicação. Cria um banco descartável, aplica as migrações nesse banco e inicia um coletor que imita a HTTP V2 API. O navegador bloqueia destinos externos. As contas, oportunidades, sessões e chaves são sintéticas.

Em 22/11/2026, o build com TypeScript, o ESLint dos 14 arquivos alterados e a suíte completa com 885 testes passaram. O Chrome aprovou 11 verificações com dados sintéticos, incluindo os quatro eventos, a recusa, a revogação, DNT/GPC, a deduplicação de salvamentos simultâneos e o salvamento durante falha do coletor. O ensaio também confirmou que uma falha de gravação e um salvamento com sinais de privacidade ativos ficam sem evento de salvamento.

Após incorporar o texto aprovado, passaram `npm run lint` nos 12 arquivos JS/TS alterados, `npm test` com 887 testes e `npm run build` com o perfil de prévia local. No Chrome, `/privacidade` exibiu a versão esperada para cada configuração e a API retornou 404 com o piloto desligado. O componente do aviso foi exercitado à parte no navegador com respostas simuladas para recusa, autorização, revogação e falha. A validação também cobriu navegação por teclado, o link para a política e o bloqueio de autorização com GPC. Esse ensaio rodou com a coleta desligada e sem aplicar a migração do piloto.

O candidato sobre `78ceee3` passou no ESLint dos 21 arquivos JS/TS alterados, na suíte com 888 testes, no build com TypeScript em perfil de prévia e no ensaio isolado no Chrome com as duas versões da política e o aviso simulado. A política pública foi verificada em HTTP 200 na versão `2026-11-08.1`. A configuração de publicação da nova versão é `APOGEE_PRIVACY_APPROVED_VERSION=2026-11-22.1`. Durante a validação, a coleta ficou desligada e a migração do piloto permaneceu pendente.

## Configuração e ativação

`APOGEE_RADAR_AMPLITUDE_ENABLED` começa desligada. O adaptador exige `APOGEE_RADAR_AMPLITUDE_API_KEY` e `APOGEE_RADAR_AMPLITUDE_IDENTITY_SECRET`. No modo `APOGEE_LOCAL_PREVIEW=1`, a única saída permitida é o endereço `http://127.0.0.1:<porta>/2/httpapi` em `APOGEE_RADAR_AMPLITUDE_TEST_ENDPOINT`. Fora da prévia, a configuração exige confirmação explícita da região com `APOGEE_RADAR_AMPLITUDE_REGION=EU`.

A seção do piloto integra a política `2026-11-22.1`. Fora da prévia, o piloto só fica disponível quando essa é a versão publicada da política. O aviso exige uma permissão de versão 2. Uma cópia anterior da interface ainda pode pedir revogação e precisa ser recarregada para solicitar uma nova permissão.

O checkout de publicação reserva `0026_store_drop_products.sql` da revisão já implantada e registra a migração do piloto como `0027_radar_amplitude_consent.sql`. O SQL do piloto é o mesmo do ensaio original.

Antes de analisar usuários reais, o estudo prevê revisão do inventário, confirmação de região e retenção do projeto, exercício de exclusão no fornecedor e autorização separada para a migração `0027_radar_amplitude_consent.sql` e a ativação. O ensaio local valida o contrato HTTP, com uma resposta simulada do fornecedor.
