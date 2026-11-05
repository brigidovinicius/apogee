# Calendário e coleções: operação e validação

Implementação local de 05/11/2026. A sexta melhoria da lista de produto inclui acompanhar coleções e receber resumos opcionais (E6 e E7 no planejamento técnico). Curadores e sugestões por URL permanecem fora desta entrega.

## Comportamento

1. Filtros principais de busca, período e localização, com opções adicionais recolhidas e chips removíveis. A URL preserva o recorte e buscas salvas antigas continuam válidas.
2. Salvar/remover diretamente nos cards e etapas, com verificação de sessão, proteção e acesso. A sincronização Google usa a fila existente; salvar não abre detalhes nem consome a primeira oportunidade gratuita.
3. Lista por dia, Hoje, navegação mensal e grade compacta para celular. Datas civis não sofrem deslocamento UTC; eventos em andamento aparecem nos dias do intervalo.
4. Coleções manuais privadas: nome, descrição, quatro capas internas, até 20 coleções ativas e 200 referências por coleção. Arquivar/restaurar preserva os itens; restauração é privada. A mesma oportunidade pode pertencer a várias coleções. Organizar uma coleção nunca altera os salvos ou Google Agenda.
5. Compartilhamento não listado, com link aleatório, prévia, cópia, desativação e rotação explícita. Bloqueio do dono, arquivamento e revogação invalidam o acesso. Páginas públicas usam somente a projeção pública do catálogo atual, sem snapshots de detalhes protegidos.
6. Acompanhamento limitado a 50 coleções, sem e-mail automático. Consentimento separado por coleção para um resumo agregado semanal. Sem novidades não há mensagem. Cancelar e-mail não remove o acompanhamento; revogar um link exige novo acompanhamento e novo consentimento.

As coleções usam o banco de membros; o Radar continua sendo a fonte canônica dos eventos. Nenhum novo framework, serviço de mensageria ou acesso direto ao banco do Radar foi adicionado.

## Ativação após revisão e autorização de publicação

As flags começam desligadas no exemplo de ambiente. Aplicar as migrações aditivas `0014_calendar_collections.sql` e `0015_calendar_following.sql` pelo procedimento aprovado de migração do banco de membros, depois de conferir o histórico do ambiente. Não executar migrações de produção a partir do script de teste local.

Ativar em sequência: `RADAR_CALENDAR_PERSONAL_ENABLED`, `RADAR_COLLECTIONS_ENABLED`, `RADAR_COLLECTION_SHARING_ENABLED`, `RADAR_COLLECTION_FOLLOWING_ENABLED`, `RADAR_COLLECTION_DIGEST_ENABLED`. As últimas quatro dependem das anteriores. O acesso pessoal mantém a política comercial e de proteção existente. Desativar o envio não elimina preferências ou registros.

Para enviar, também são necessários:

- Transporte de membros disponível e domínio remetente verificado pelas configurações já existentes de `sendMemberMail`.
- `RADAR_COLLECTION_DIGEST_WORKER_ENABLED=true` e segredo próprio de pelo menos 32 caracteres, igual no aplicativo e no executor.
- Origem interna confiável em `RADAR_COLLECTION_DIGEST_INTERNAL_ORIGIN`; em Compose, o padrão é `http://web:3000`.
- Orçamento específico em `RADAR_COLLECTION_DIGEST_DAILY_LIMIT` (padrão 10, teto desta implementação 50 tentativas/dia UTC). Esse teto é uma decisão conservadora do código, não a cota do Resend. Confirmar a capacidade combinada com autenticação e alertas antes de ativar o piloto.

O executor de uma rodada é `node scripts/collection-digest-worker.mjs`. Agendá-lo a cada 15 minutos pelo timer/cron operacional do ambiente, somente após autorização. O script faz um POST autenticado, processa até cinco destinatários por rodada e imprime apenas métricas agregadas. Não colocar segredo na URL ou na linha de comando. O timer deve herdar variáveis de um arquivo protegido ou do serviço de segredos. No Mac, qualquer execução Node continua sujeita à fila global.

## Garantias e limites dos resumos

O banco persiste um job único por destinatário/período, com conteúdo e chave estáveis. A reserva de tentativa/orçamento é confirmada antes da chamada externa. Concorrência usa locks por destinatário e coleção; o envio mantém esses locks por até o timeout de 10 segundos do transporte. Opt-out e mudanças de consentimento cancelam e apagam o conteúdo de jobs pendentes. Compartilhamento e bloqueio são reavaliados antes do envio. Uma mensagem já aceita pelo provedor não pode ser recolhida.

Falha de envio não avança o estado de comparação. Tentativas usam o mesmo conteúdo e chave, com intervalo mínimo de 15 minutos, até cinco tentativas e menos de 23 horas desde a criação. A janela oficial de idempotência do Resend é de 24 horas: <https://resend.com/docs/dashboard/emails/idempotency-keys>. Um job antigo vira `failed`, sem reenvio cego. Uma interrupção após a aceitação e antes da confirmação no banco é retomada com a mesma chave dentro dessa janela. Isto não promete entrega exatamente uma vez na caixa de entrada.

O próximo período começa sete dias após a conclusão da rodada. “Aceito” significa aceitação pelo provedor, nunca comprovação de entrega. Novos consentimentos partem do catálogo atual, evitando disparo do histórico. Mudanças só de data de verificação não geram mensagem. Retirada do catálogo não é anunciada como cancelamento; o sistema não infere informação ausente.

O e-mail mostra até 20 novidades deduplicadas e informa a contagem adicional. Todos os itens entram no estado de comparação. O cancelamento por link é uma capacidade aleatória que só desativa e-mails; abrir o link é leitura, confirmar o formulário é a mutação. Preferências também podem ser desativadas pela conta sem acesso pago ativo.

`radar_calendar_digest_job` conserva status, período, contagem de tentativas e datas; remove o payload quando termina. `radar_calendar_digest_budget` conta tentativas, inclusive aquelas que falham ou são canceladas após a reserva. Logs não incluem destinatário, título, token ou corpo do provedor. O relatório agregado do executor deve ser acompanhado no piloto; investigar `retry`, `failed` e ausência prolongada de execuções antes de ampliar a capacidade. Não há monitoramento de entregabilidade nem telemetria de adoção adicionada nesta entrega.

## Verificação local reproduzível

Usar exclusivamente o ambiente sintético criado com `scripts/calendar-local-database.py --collections` e `scripts/calendar-local.mjs setup --collections`. O helper de integração recusa bancos que não correspondam a host loopback, porta 48941, banco/usuário de teste e marcador local. O PostgreSQL deste ambiente é independente dos demais calendários locais.

Executar pela fila FIFO, uma tarefa por vez:

```
node --test --test-concurrency=1 tests/*.test.mjs
node tests/calendar-collections.integration.mjs
node tests/calendar-following.integration.mjs
node node_modules/next/dist/bin/next typegen --webpack
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js <arquivos alterados>
node node_modules/next/dist/bin/next build --webpack
```

Os dois testes SQL criam usuários sintéticos próprios e removem somente esses registros. O transporte de e-mail é interceptado; nenhum e-mail real é enviado. A prévia usa `scripts/calendar-local.mjs serve --collections`, exposta somente em loopback na porta 4381, com catálogo fictício e sem Google, Stripe ou e-mail reais.

Roteiro de navegador: visitante salva e retoma os filtros após login; conta elegível salva/remove sem abrir detalhes; mês e dia funcionam em 320/375/390 px; criar/renomear coleção, adicionar evento, gerar e revogar link; leitura pública não contém dados protegidos; acompanhar sem resumo, ativar por consentimento e cancelar; arquivar e restaurar como privada. A validação de produção e um piloto com usuários reais são etapas posteriores à autorização de publicação.

## Reversão

Desligar primeiro `RADAR_COLLECTION_DIGEST_WORKER_ENABLED`; depois desligar as flags de interface conforme necessário. Conservar tabelas e registros para diagnóstico. Voltar o código não requer apagar coleções, salvos ou buscas. Ao reativar o worker, jobs fora da janela segura não são enviados. Não usar exclusão de dados como rollback.
