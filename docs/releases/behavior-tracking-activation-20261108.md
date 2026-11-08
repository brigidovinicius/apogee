# Rastreamento de comportamento publicado e ativado — 08/11/2026

O usuário autorizou publicar e ativar a medição no site e no Radar, mantendo a regra de não armazenar dados sensíveis. A ativação disponibiliza a escolha de medição; cada visitante precisa permitir antes de enviar eventos.

## Revisão e CI

- [PR #128](https://github.com/brigidovinicius/apogee/pull/128), integrado.
- Head validado: `dc6bc8be99437ef6eb51d99d5e599590861abbc1`.
- SHA publicado: `42f7a2fb6b1d03c051387850cf86785766f83b87`, árvore idêntica ao head validado.
- [CI 42490657893](https://github.com/brigidovinicius/apogee/actions/runs/42490657893): seis jobs aprovados. Inclui os três projetos, auditoria de dependências, smoke standalone, PostgreSQL com papéis reais, autenticação, convites, limites de corpo e cobrança com dados sintéticos.
- O teste HTTP compilado verifica 410 imediato para o coletor aposentado e 408 para upload incompleto no novo coletor, sem conexões de persistência nesses caminhos.
- Aviso de privacidade atualizado para `2026-11-08.1`, descrevendo a escolha, as contagens, os sinais do navegador, a retenção e o histórico anterior. Os termos mantêm `2026-11-01.2`.

## Publicação e banco

Preflight confirmou checkout limpo na VPS `srv1439756`, revisão anterior `b723bc0e0408d8fe62fafca855fe2034d30cc868`, web saudável e sem reinícios, ambiente modo 600 e capacidade disponível.

Backup privado em `/opt/apogee-backups/behavior-20261108/`: dump do banco de membros (112.509 bytes), checksum, configuração anterior e inventário de containers. O dump foi restaurado em banco isolado, e a migração foi ensaiada como `apogee_app`. O banco de ensaio foi removido depois da validação; o backup permanece preservado e privado.

Somente `make-it-fly-current/sql/behavior-daily.sql` foi aplicado no banco `apogee_membros`, como `apogee_app`. A tabela `apogee_behavior_daily` pertence a esse papel e não possui grants para outros papéis. Não foi executado o journal geral de migrações. Contas, inscrições, pagamentos e histórico anterior não foram alterados.

A tabela contém somente `day`, `page`, `event`, `target`, `device` e `count`. O contrato e os checks do PostgreSQL aceitam categorias fixas; não há coluna de texto livre, URL, resposta, IP, user-agent, conta ou sessão. Os incrementos são agrupados por dia de Brasília, e não existe registro individual de eventos.

Foram alteradas somente duas configurações de execução: `APOGEE_BEHAVIOR_ENABLED=true` e `APOGEE_PRIVACY_APPROVED_VERSION=2026-11-08.1`. As demais linhas de configuração foram preservadas. A troca foi feita por Git e SHA exato, com build/recriação exclusivamente de `web`, usando `--no-deps`.

Imagem publicada: `sha256:fa98f9253c70fba28d5aacee13a2897905fe47ff74fcdfe837f0f4daf0153b77`.

O web ficou `healthy`, com zero reinícios, em duas conferências. Os 13 containers vizinhos conservaram IDs e imagens, incluindo Radar, sincronização Google, membros, Caddy e sistema de locação. Não houve mudança de DNS, Caddy, credenciais, certificados, redes ou volumes.

## Validação pública

Dezoito verificações HTTP aprovadas: dez rotas públicas com 200, painel administrativo anônimo redirecionando ao login, bloqueio de ausência de escolha/origem indevida/campos extras/marco livre, DNT/GPC retornando sem gravação e `/api/journey` encerrado com 410. Privacidade e termos foram conferidos nas versões previstas.

Chrome em contexto anônimo temporário: dez verificações aprovadas em desktop e celular. Sem requisições antes da escolha ou após recusa; permissão explícita recebeu 202 do coletor real; retirada interrompeu a medição nas navegações seguintes; GPC prevaleceu sobre uma escolha anterior. Os eventos chegaram sem cookies, Referer ou conteúdo digitado. A interface de escolha coube em 390 px e foi conferida visualmente.

O navegador percorreu home, Radar e filtros, abertura externa da inscrição e interesse na loja. Dados sintéticos foram digitados na loja sem submeter o cadastro. Nenhuma conta, inscrição, salvamento, compra, cobrança ou mensagem externa foi criada por esses testes; POSTs de negócio e origens externas estavam bloqueados.

A verificação produziu quatro lotes com onze eventos de uso. Na leitura inicial do banco, havia onze combinações e onze incrementos, sem identificadores individuais. As contagens iniciais incluem essa validação técnica e não representam pessoas únicas nem conversões de venda.

Artefatos locais, fora do Git, em `make-it-fly-current/outputs/behavior-validation/`: `production-ci.json`, `production-deploy.log`, `deploy-result.json`, `database-privacy-check.json`, `production-http-before.json`, `production-http-after.json`, `production-browser.json`, `production-desktop-consent.png` e `production-mobile-consent.png`.

O relatório operacional também foi registrado na VPS em `/opt/apogee-site/releases/20261108-behavior-tracking.md`. Este registro documental é posterior ao deploy e não implica outra publicação.

## Operação e limites

- Painel: [Comportamento](https://www.apogee.community/admin/comportamento), sujeito à autorização administrativa, com últimos 30 dias.
- Coleta desativada para quem recusa ou envia DNT/GPC. Nenhum cookie de autenticação é enviado pelo coletor. Limite antiabuso usa digest efêmero em memória; não é persistido nos agregados.
- A rotina de gravação exclui contagens anteriores às últimas 90 datas; sem novas gravações, a limpeza ocorre na execução seguinte. Não foi adicionado agendamento de banco.
- Admin, callbacks, convites, redefinições de senha, perfis, conteúdo de fórum e links portadores de segredo ficam fora da medição. Páginas dinâmicas medidas são reduzidas a categorias.
- O Google Forms é medido somente pela abertura da página hospedeira e do link externo; não há acesso a respostas ou etapas internas. O formulário próprio legado continua com adaptador seguro, mas não substitui o iframe atual.
- Não há novo envio de eventos para Sheets. O endpoint web antigo foi encerrado; a versão remota do receptor Apps Script e seu histórico não foram publicados, importados ou apagados neste deploy.
- Não foi feito login real no painel administrativo nem teste de pagamento real. Autorização e persistência foram exercitadas no CI com PostgreSQL; a proteção anônima foi confirmada no site real.

Para suspender a medição mantendo o novo site, definir `APOGEE_BEHAVIOR_ENABLED=false` e recriar somente `web`; preservar a tabela e seus agregados. A imagem anterior foi preservada como `apogee-site:rollback-behavior-20261108`, junto ao ambiente anterior privado. Nenhuma exclusão de histórico é necessária para desativar a coleta.
