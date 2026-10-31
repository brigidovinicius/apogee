# Radar — expansão do catálogo em 30/10/2026

Candidato em `feat/radar-expansion-20261030`, a partir de `ac04696c4852c904c448694605e7efc7b1e18d32`. Nenhuma publicação ou alteração de produção desta etapa foi realizada neste ponto.

## Escopo e evidência

O inventário reúne 101 identidades pesquisadas: 100 no recorte acadêmico e a competição técnica SENAI marcada para revisão de escopo. Inclui a OBVC já existente, sem criar uma nova ficha para ela. O número 88 foi tratado como meta de cobertura; não foi encontrada uma fonte que estabeleça exatamente esse total nacional. Há 4 identidades com inscrições vigentes na pesquisa, 72 encerradas, 1 futura e 24 sem janela atual confirmada. A ausência de calendário não foi classificada como encerramento.

Os arquivos em `research/radar-expansion-20261030/` preservam fontes, modalidade, edição, condições, divergências e pendências. UFSM e CNPq orientam a descoberta; os fatos de inscrição precisam de fonte primária. Inglês e Espanhol têm banner de abertura divergente de regulamento já vencido; não entram como abertas. OPA/OPEF/OPEFOG não anunciam edição 2026. Nenhum ano futuro foi inventado.

O pacote em `radar-academico/references/radar-expansion-20261030/` separa identidades monitoradas, edições e eventos Luma. São 115 alvos propostos; 3 exigem confirmação de autoria ou uma página institucional estável. A competição técnica SENAI fica fora da contagem acadêmica e pode ser monitorada na categoria competições. Os demais ainda dependem do teste de acesso/robots. Consulta bloqueada permanece explícita e não é apresentada como monitoramento funcionando.

## Implementação

- Normalização específica de 7 fontes de edições: Literatura, Oceano, OBAPO, Hack Brasil, PUCPR, UFMS e PMI. Oceano tem duas modalidades vigentes; OBAPO mantém renovação restrita e inscrição geral futura separadas. Uma modalidade não abre as demais.
- 6 eventos Luma identificados em São Paulo/Rio: lançamento Hack Brasil, WoMakersCode, Shiva Hack, PlatformCon, Founders Live e Builders Day. A inscrição de público não vira candidatura a pitch nem inscrição no hackathon. Shiva é aprendizagem sem competição. Lotes pagos atuais não herdam a gratuidade de lotes vencidos.
- JSON-LD público complementa os links de descoberta, inclusive cards sem texto no link. Datas passadas/cancelamentos são filtrados. Descobrir um evento não autoriza o organizador ou todo o domínio Luma para publicação.
- Monitoramento diário registra um hash e um pequeno trecho público por consulta em `ingestion_runs`, sem migração de schema. Mudanças na mesma URL ficam registradas e visíveis no painel de descoberta; candidatos bloqueados podem ser reavaliados. Descartes, exclusões, fontes desativadas e decisões editoriais permanecem preservados.
- Mudança de página de descoberta não envia e-mail. Somente alterações validadas da oportunidade usam o fluxo existente de revisão e avisos aos interessados.
- Eventos Luma usam data/hora com fuso, disponibilidade e controle de inscrição visíveis. Datas e preço do lote disponível são reextraídos. Não são lidos dados de hidratação, participantes, e-mails ou endereços privados.

Os adaptadores de edições auditadas falham quando evidências de prazo/eligibilidade divergem; a mudança fica registrada para nova auditoria, sem preencher informações por suposição. As datas de inscrição e submissão são distinguidas. Eventos iniciados saem da vitrine conforme a política atual do Radar.

## Operação e validação

`expansion-source-audit.test.ts`, com `RADAR_EXPANSION_AUDIT_PATH`, executa apenas leituras públicas pelo fetcher real (robots, TLS, DNS, limites e rate limit). Produz auditoria sem corpo das páginas ou dados pessoais. Sem variável, fica desabilitado na suíte comum.

`node scripts/radar-expansion-package.mjs` mostra o plano. `--apply --audit=/caminho/auditoria.json` exige auditoria completa correspondente aos dados e ao código de extração/transporte/instalação, com menos de 24h, além de `DATABASE_EDITOR_URL` no ambiente. A instalação insere apenas registros novos; fontes e monitores existentes não são reativados, inclusive quando a URL proposta só acrescenta uma barra final. Somente fonte com normalização e acesso confirmados é ativada. Monitores sem autoria ou acesso confirmado ficam pendentes. A instalação não cria fichas: estas passam pela ingestão e validação automática usuais.

Testes cobrem prazos vencidos, janela futura, elegibilidade restrita, fonte exata, mudança de data, preços, esgotamento, lista de espera, privacidade, logs de mudança e instalação transacional/idempotente. Resultado executável será registrado após a validação isolada. A fila local continua ocupada pelo servidor de outro trabalho, que foi preservado.

Antes da ativação: revisar diff e auditoria, executar testes/lint/tipos/build, obter autorização para publicação desta nova versão e aplicar o fluxo Git/SSH com SHA exato, backup e conferência de produção. Nenhum formulário, inscrição real ou e-mail de teste é enviado.

## Revisão e estado de execução

A revisão independente identificou e motivou três correções: data principal do PMI em 12/12 (não a abertura do período preparatório em novembro); encerramento específico por modalidade nas páginas compartilhadas; ausência de `eventStatus` não elimina um link HTML válido de descoberta. Foram adicionadas regressões para os três casos.

Verificações realizadas localmente: JSONs válidos, 115 identificadores únicos e dentro do limite, URLs HTTPS sem `authuser`, contagem conciliada de 101 registros de pesquisa/100 acadêmicos; conferência textual leve contra as páginas públicas coletadas confirmou os trechos de evidência das 13 fontes; `git diff --check` passou. Isso não substitui execução do normalizador, testes de integração, lint, tipos ou build, que ainda não foram executados.

O checkout público base foi extraído apenas em `/opt/apogee-work/radar-expansion-20261030`. A revisão automática rejeitou o envio do diff porque a autorização de transferência anterior era restrita às etapas 1 e 2. Foi solicitada autorização específica de envio e validação isolada da etapa 3. O diff não foi transferido. Nenhum pacote npm local pesado foi iniciado; o servidor que ocupa a fila global foi preservado. Não houve importação do pacote, ativação de fontes, publicação de fichas, push ou deploy desta etapa.

## Validação isolada autorizada

O usuário autorizou especificamente o envio dos diffs da etapa 3 e testes/consultas públicas em `/opt/apogee-work/radar-expansion-20261030`. O pacote foi transferido sem `.env`, credenciais ou dados de produção. Os comandos usaram Node 22.23.4 instalado na área isolada e dependências com lockfile idêntico; variáveis de banco, e-mail e cron foram removidas do ambiente.

Na revisão final do código, **513 testes passaram e 31 foram pulados** (21 exigem PostgreSQL externo real; 9 são auditorias externas anteriores; 1 é a auditoria desta expansão executada separadamente). `npm run lint`, `npm run typegen`, `npm run typecheck` e `npm run build` passaram, sequencialmente. A rodada focada anterior teve 120 testes aprovados, incluindo persistência/reconsulta de Luma e Oceano, uma única atualização na fila de avisos, preservação de campos editados, falha de extração e exclusão pelo administrador. Nenhum e-mail foi enviado: a integração usa banco fictício e adaptador de envio simulado.

A revisão independente confirmou as correções de dados incompletos e do trecho que comprova encerramento por modalidade; não encontrou bloqueio residual. O transporte gzip ficou limitado aos três IDs/hosts e caminho auditados em `research/radar-expansion-20261030/transport-audit.md`, com limites de entrada/saída e robots preservados. O teto de descoberta permanece 2 MiB.

A consulta pública de `main` ainda retornou o SHA base `ac04696c4852c904c448694605e7efc7b1e18d32`. O resultado final da auditoria ao vivo será anexado com a lista de fontes aptas e pendências. Publicação da branch pública, PR, integração, deploy e ativação em produção continuam pendentes de autorização desta nova versão após a revisão.

## Resultado final da auditoria e proposta de ativação

A auditoria terminou em **30/10/2026 às 22h25 de Brasília** (`2026-10-31T01:25:55.960Z`): 128 leituras, **13/13 fontes de edição/evento validadas**, **104/115 alvos acessíveis** e 11 bloqueados. O normalizador encontrou **13 fichas abertas**, a inscrição geral futura da OBAPO e PlatformCon já encerrado. Estes dois últimos não entram na vitrine de abertas. A mudança de disponibilidade do PlatformCon em relação à pesquisa inicial demonstra por que a leitura atual tem precedência sobre o levantamento.

O instalador pode inserir **99 monitores ativos novos e 13 registros pendentes**. OBI e OBMEP já existem, nunca revisados, e são preservados pelo instalador; a proposta é concluir a verificação nesses dois mesmos cadastros com a evidência auditada, sem recriação ou sobreposição de decisões posteriores. OBA/OBAFOG usam uma única consulta à página compartilhada. Somando a conferência dos dois cadastros existentes, o plano abrange **101 páginas distintas aptas**, cobrindo 102 alvos (89 identidades acadêmicas em 88 páginas). As 13 pendências restantes incluem 11 problemas de acesso e duas confirmações de autoria/página estável.

Os detalhes estão em `research/radar-expansion-20261030/access-audit.md`; a evidência de máquina completa está em `radar-academico/references/radar-expansion-20261030/access-audit.json`. O hash dos dados/código coincide entre o workspace e a cópia isolada: `584ad11bcc5e55d86c66c691bd0a1ebd3bbe3adb1521ce24f3695b945f48b356`.

Produção foi apenas consultada: site e Radar estavam em execução e saudáveis, com horários de início anteriores à rodada final; scheduler em execução. Não houve push, PR, merge, deploy, migração, alteração de dados de produção ou envio real de e-mail. O próximo gate é autorizar a publicação do candidato no repositório público, integração após CI, deploy do Radar e ativação dos registros qualificados, mantendo as pendências inativas. Antes da operação, revalidar revisão exata, saúde, backup e validade da auditoria; não usar autorização vencida para um pacote diferente.
