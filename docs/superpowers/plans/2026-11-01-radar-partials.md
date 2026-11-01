# Conclusão das etapas parciais do Radar

> Execução sequencial neste checkout, respeitando a fila npm global. O pedido de 01/11 autoriza implementar e testar o escopo conferido no relatório; publicação e alterações operacionais seguem os gates do projeto.

**Objetivo:** concluir as partes implementáveis das etapas 2, 3 e 5 e produzir evidência executável, preservando dados e consentimentos existentes.

**Arquitetura:** reutilizar filtros e catálogo compartilhados, armazenamento PostgreSQL e fila de avisos existentes. Filtros nomeados pertencem à conta; acompanhamento recorrente tem adesão separada das assinaturas de uma edição. Nenhuma agenda é criada por salvar um filtro; a integração Google continua usando as oportunidades escolhidas.

**Stack:** Next.js 16.4.2, React 19, TypeScript, PostgreSQL, node:test e Vitest/PGlite. Node 22 nos comandos executáveis.

**Especificação:** lista original do usuário, `../../../../planejamento-radar-20261030.md` e `../../../../verificacao-lista-radar-20261101.md` no diretório que contém este checkout. Escopo aprovado por “ok, resolva oq esta parcial e teste”.

## Restrições

- Não implementar etapas 4 e 6 neste escopo.
- Uma tarefa npm/node pesada por vez, pela fila; preservar processos existentes.
- Não publicar versão, aplicar migração de produção, alterar OAuth/documentos aprovados ou enviar e-mail sem a autorização aplicável.
- Não substituir TLS/robots nem inventar dados para resolver uma fonte inacessível.
- Manter a distinção entre inscrições abertas, futuras, encerradas e não confirmadas.

## Atenção da revisão

1. ID de filtro de outra pessoa nunca permite leitura/escrita cruzada.
2. Falha de catálogo não pode apagar agenda Google ou anunciar fim de competição.
3. Datas sem hora e eventos próximos da meia-noite não mudam de dia por conversão de fuso.
4. Nova adesão a próximas edições não reativa nem amplia assinatura antiga.
5. Repetir coleta/worker/confirmação não duplica aviso nem evento.

## Tarefa 1 — filtros salvos e calendário mensal

Arquivos: `make-it-fly-current/lib/opportunities/calendar-filters.ts`, `saved-calendar-filters.ts`, `components/opportunities/calendar-filters.tsx`, `calendar-month.tsx`, `calendar.module.css`, páginas `/calendarios/[slug]` e `/membros/meu-calendario`, ações do calendário, schema, migração `0013_radar_calendar_filters.sql` e journal.

- [x] Escrever e executar regressões para filtros combinados com inscrições fechadas/etapas futuras, parâmetros inválidos, mês/fuso, ação sem autorização e persistência isolada por usuário.
- [x] Implementar `readCalendarFilters`, `calendarFilterQuery`, `filterCalendarItems` e `calendarMonthDays`; consumir filtros canônicos no calendário e no armazenamento.
- [x] Salvar/atualizar/remover até 20 combinações por conta, com nome de 1–80 caracteres e validação no servidor.
- [x] Mostrar seleções salvas, formulário combinável, mês/lista e próximas datas sem inventar dia para itens sem data.
- [x] Testar, rodar lint/tipos/build e registrar os resultados.

## Tarefa 2 — acompanhamento de próximas edições

Arquivos: migração Radar aditiva `0048_series_alerts.sql`; `lib/alerts/series.ts`, `monitoring.ts`, `db/live-catalogue.ts`, rotas de catálogo/avisos; cliente Radar e página pública de acompanhamento de competições no site; regressões de integração PGlite e fronteira HTTP.

- [x] Escrever teste que acompanha alvo fechado e recebe uma nova edição validada, sem avisos por alteração de página/falha/repetição.
- [x] Adicionar `target_id` opcional às assinaturas com exclusividade edição/alvo; manter existentes como edição e preservar status/consentimento.
- [x] Relacionar edição ao alvo por mapeamento explícito ou fonte exata; não usar semelhança de nome ou domínio como prova.
- [x] Listar identidades verificadas em diretório público, oferecer adesão separada e reaproveitar confirmação/cancelamento/fila/orçamento.
- [x] Validar confirmação, cancelamento, idempotência, quotas, falha temporária, escopo privado e transições entre edições.

## Tarefa 3 — fontes pendentes

Arquivos: `research/radar-completion-20261101/`, pacote de recuperação e auditoria de acesso correspondente em `radar-academico/references/`, testes do coletor/instalador se houver mudança de comportamento.

- [x] Reconsultar 13 alvos pendentes e o bloqueio de Agropecuária pelo fetcher seguro, com ritmo por host.
- [x] Pesquisar alternativas institucionais e autoria; distinguir mudança de URL de mudança de identidade.
- [x] Preparar recuperação específica apenas dos registros ainda pendentes e com configuração original correspondente; preservar alterações/descartes posteriores.
- [x] Executar auditoria atual com código e fontes vinculados por hash; documentar limitações externas que persistirem.

## Tarefa 4 — integração e evidência

- [x] Executar suítes de site e Radar, lint, geração de tipos, typecheck e build sequencialmente com Node 22 e fila global.
- [x] Validar migrações em banco isolado; não migrar produção para testar.
- [x] Exercitar navegação do calendário em desktop/mobile e isolamento entre contas no ambiente de teste.
- [x] Revalidar o fluxo Google existente com respostas controladas e banco isolado; usar conta real somente pelo OAuth consentido.
- [x] Para recebimento real de e-mail, aguardar endereço autorizado e registrar submissão ao provedor separadamente de recebimento.
- [x] Revisar diff completo, registrar limitações e deixar candidato concreto para aprovação de publicação.

## Registro de execução

- Checkout isolado criado a partir de `main` em `26251383456dc6faa9ca7d62243e36e0505fea25`; branch `fix/radar-partials-20261101`.
- Fila global estava vazia; dependências dos dois serviços instaladas sequencialmente pelo lockfile. Shell padrão usa Node 20; validações usarão Node 22 explicitamente pela fila.
- E-mail/conta para piloto real solicitados ao usuário; implementação e testes isolados não dependem da resposta.

### Progresso confirmado

- Calendário implementado: filtros nomeados por conta (máximo 20), remoção, atualização por nome, mês/lista, etapas, recorte por calendário e reset de cidade ao trocar UF.
- Testes de calendário: 4/4; proxy de avisos e calendário focados 17/17; persistência PostgreSQL real passou em sete verificações, incluindo concorrência e isolamento.
- Site completo: 585/585, sem falhas/skips; a lista de rotas autorizadas foi atualizada especificamente para `/competicoes`.
- Backend completo intermediário: 516 aprovados e 32 pulados (auditorias externas e banco externo); integração de série: 59/59 no ponto anterior ao teste novo do instalador.
- Aviso real: assinatura NASA criada no fluxo publicado para o endereço autorizado; mensagem recebida no Gmail INBOX em 01/11 às 08h32m26 BRT. Confirmação e cancelamento retornaram 200. Assinatura de teste cancelada; nenhuma data de oportunidade real foi alterada.
- Auditoria externa: OBRL/OSM/OBE Empreendedorismo/Agropecuária responderam; Física responde em `/2026/index.php`. OBE tem autoria Expacer documentada em página oficial; OSM tem autoria corroborada pela FGV. Alternativas de Sergipe e USP verificadas; última rodada de contingência de portais ainda deve ser executada com hash final.
- Não foi alterada a política de compressão/TLS: ONHB respondeu 503 na consulta independente, portanto não há justificativa para uma exceção de gzip. OBMACS/OPM seguem com TLS inválido; Butantan/Cianorte e Wolfram ainda têm bloqueio de acesso. Polymathos não tem monitor institucional acessível validado.
- Banco de teste novo em 127.0.0.1:48931; cluster e segredos somente em `.local/radar-completion-calendar`. Nenhum banco existente reutilizado.

- Instalador de recuperação testado: 60/60 integrações. Só altera alvo ainda inativo e com URL, organizador, notas e revisão exatamente iguais ao pacote original; auditoria precisa corresponder ao código/dados e ter até 24h.
- Lint site: sem erros, somente aviso preexistente de imagem em gallery-admin. Primeiro build site passou; minuta de privacidade está sendo atualizada para descrever filtros/adesão recorrente e requer nova aprovação por versão antes de ser publicada.
- Cliente Google Local existente preparado no novo ambiente; somente identificador/segredo do aplicativo foram reutilizados. Nenhum grant de usuário foi copiado; chaves de criptografia e sincronização do teste são novas. Preview ainda não iniciado.
- Ruling: a origem em um portal ou uma URL semelhante não estabelece que uma oportunidade é nova edição da competição. Foi adicionada regressão RED→GREEN e o envio recorrente agora depende apenas de mapeamento explícito de fonte. Migração liga NASA e as sete fontes de edição auditadas quando a URL original coincide e não existe mapeamento posterior do operador. Alvos de descoberta genéricos continuam monitorados, mas novas fichas exigem vínculo validado antes de gerar aviso de edição.
- Pacote final de seis recuperações possui auditoria completa correspondente ao hash `108d38a13e24250e82e0e0968adfa524885b4e7b3b09abf0a9ae7fd34439774e`; todos os seis destinos passaram. Arquivo público sem corpo de páginas em `radar-academico/references/radar-completion-20261101/access-audit.json`.
- Validação final (antes da conferência UI) passou em dez etapas: site 585/585, backend 518 aprovados/32 ignorados, lint/tipos/build de ambos e persistência PostgreSQL real.
- Conferência UI encontrou ajuste necessário: salvar uma combinação com mês explícito está descartando mês/visualização. Corrigir após o piloto atual; a preferência de período faz parte da combinação escolhida pelo usuário. Nenhuma mudança foi aplicada ainda enquanto este preview está em execução.
- Google: Chrome com a conta indicada chegou ao aviso “O Google não verificou este app”. A revisão automática rejeitou clicar em Continuar por exigir handoff do usuário. Aba marcada para handoff e pergunta assíncrona enviada; não contornar por outra interface ou reutilização de grant. Aguardar ação do usuário para qualquer teste Google dependente.
- Preview temporário em execução na sessão exec 43205; fila ordem 976. Encerramento próprio em até 15 minutos ou pelo arquivo `.local/radar-completion/qa-stop.signal`, observado pelo supervisor que encerra só o grupo de processos que criou. Banco novo de teste permanece na porta 48931; não sinalizar processos de outros trabalhos.
- UI desktop: autenticação real com conta fictícia, troca UF/cidade, filtros combinados e calendário mensal passaram. Captura em `.local/radar-completion/calendar-desktop.jpg`. Cadastro de combinação persistiu e voltou na conta, mas revelou a perda de mês/visualização; teste atualizado para exigir preservação do período explicitamente escolhido. Implementação e RED→GREEN aguardam liberação da fila ocupada por este próprio preview.
- Período/visualização: regressão executada e falhou pelo mês descartado; correção aplicada e suíte 585/585, lint, build e tipos passaram novamente. Mensagem vazia duplicada do calendário também removida.
- Google com PostgreSQL local real: OAuth/PKCE, replay, isolamento, criptografia, criação/idempotência, alteração/cancelamento, remover/restaurar, indisponibilidade, revogação e reconexão passaram. Teste de fila de sete conexões e leases passou.
- Ensaio avançado de retentativas/monitor falhou ao iniciar o worker da fixture (sem heartbeat). Investigar diretório de trabalho da cópia executada via stdin antes de concluir esse ensaio; não há falha atribuída à produção nem ao provedor real. Logs em `.local/radar-completion/google-calendar-retries-local-integration.log`.

- Causa do ensaio de monitor: a cópia via stdin foi executada em `scripts/`, enquanto o helper inicia filhos com caminhos `scripts/...` relativos à raiz do site. Ajuste aplicado somente ao launcher privado de QA para restaurar cwd da aplicação; código de produção não foi alterado para isso. Ensaio avançado está sendo repetido isoladamente.

### Revisão final

- Revisor independente leu o diff completo e arquivos novos sem executar tarefas pesadas. Três problemas importantes foram confirmados: disponibilidade sem mapeamento de fonte, identidade de edição baseada somente na ficha e controles React reaproveitados ao trocar presets. Foram adicionadas regressões que falharam antes das correções.
- Avisos agora exigem fonte mapeada ativa/verificada; o diretório preserva os demais alvos com avisos em preparação. Identidade explícita de edição substitui deduplicação somente por ficha; edição fechada conhecida não vira novidade ao reabrir. Acrescentar metadados à ficha antiga apenas estabelece baseline, sem aviso falso.
- O formulário de filtros recebe chave conforme valores/escopo para atualizar selects na navegação entre combinações. Conferência A → B → Limpar será feita no navegador interno, conforme preferência do usuário por manter Chrome livre.
- Corrigida a conclusão de Agropecuária: a consulta intermediária respondeu, porém a auditoria final voltou a bloquear acesso. Manter a evidência final como estado entregue.
- Ensaio avançado do monitor repetido com cwd correto: 70 verificações passaram, sem envio externo.
- Usuário concluiu pessoalmente OAuth. Banco isolado confirma grant criptografado e agenda secundária criada; nenhum grant anterior foi copiado.

- Regressão adicional do revisor: futura edição B na mesma ficha de A era consumida antes de abrir. Três cenários (adesão antes/depois da descoberta e ficha fechada) foram reproduzidos em RED e corrigidos, preservando B pendente. Backend final: 525 aprovados, 32 ignorados; lint sem avisos, tipos/build passaram. Site final: 586/586.

- Revisão direcionada final: pendência precisa persistir mesmo se a data prevista chegou e a fonte ainda não confirmou abertura; data única sem end continua suportada. Interação entre primeira metadata e edição futura pendente também coberta. Último parecer não encontrou outro defeito concreto e condicionou aprovação ao ajuste pontual e à regressão; ambos aplicados. Backend 527 aprovados/32 ignorados na última suíte.

- Conferência final no navegador interno: A → B → Limpar, mês/visualização persistidos e remoção de combinações passaram. Diretório público passou. Mobile detectou overflow dos spans de acessibilidade; contêiner relativo corrigiu, build repetido passou. Página390/viewport390 e desktop1280/viewport1280; somente tabela rola em seu contêiner. Capturas finais privadas desktop/mobile registradas.
- Piloto Google real: 3 eventos criados, atualização de data mantendo ID, cancelamento de etapa(2), retirada da oportunidade(0). Leitura independente Google confirmou cada transição. Fixture restaurada, conexão local desconectada, nenhum token/grant anterior copiado ou agenda primária usada. Preview próprio encerrado e viewport restaurado.

- Banco PostgreSQL criado para este trabalho foi encerrado ao final, preservando dados/arquivos locais. Nenhum processo preexistente foi encerrado. Hash final de recuperação reconferido: 28 endereços auditados e 6 recuperações, sem divergência.
