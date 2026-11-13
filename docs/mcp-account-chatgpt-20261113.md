# Apogee no ChatGPT e no Claude

Continuação do MCP do Radar (`ca2b38b`) na branch `feat/mcp-radar-20261112`. Escopo confirmado pelo usuário: botão no site e consulta ao perfil próprio, com organização de calendário e coleções. Publicado e ativado em 13/11/2026. Conexões pessoais e consultas reais ao Radar foram validadas no ChatGPT e no Claude, com renovação autorizada; consulte o [registro de produção](releases/mcp-20261113-production.md).

## Entrada pelo site

O botão **Incluir no meu ChatGPT** aparece na navegação compartilhada (desktop e menu móvel), no rodapé e na área de membros quando `APOGEE_MCP_ENABLED=true`. A flag continua desativada por padrão. O servidor fornece a disponibilidade aos componentes cliente, mantendo o mesmo estado na renderização e hidratação.

A entrada leva a `/membros/integracoes/mcp`, com o login atual da Apogee e retorno preservado. O guia fornece o endereço selecionável, cópia com instrução de recuperação se o navegador negar o clipboard e abertura de `https://chatgpt.com/plugins`. O usuário adiciona o servidor, escolhe OAuth, autoriza a conta e instala o plugin no ChatGPT. O botão não afirma instalar automaticamente nem declarar conexão concluída. A lista de conexões e a revogação continuam disponíveis.

O fluxo segue a [documentação atual de conexão da OpenAI](https://developers.openai.com/api/docs/guides/custom-mcp-server) e a [página oficial Plugins](https://chatgpt.com/plugins), consultadas em 13/11/2026. A disponibilidade depende da conta e das políticas do espaço no ChatGPT. Nenhum plugin público da Apogee foi submetido ou publicado por este trabalho.

No Claude, o fluxo validado é **Personalização → Conectores → Adicionar conector personalizado**, com nome Apogee e o mesmo endereço `/mcp`. A descoberta selecionou **Entrar agora**, **Registrar automaticamente** (DCR) e HTTP Streamable. O Claude Free permite um conector personalizado; cadastros existentes podem bloquear uma nova inclusão. Após autorizar a conta na Apogee, conferir a integração no menu de conectores do chat e aprovar a consulta solicitada. A validação pessoal Claude concedeu somente `radar:read account:read offline_access`. Consulte a [ajuda oficial de conectores](https://support.claude.com/en/articles/11176164-use-connectors-to-extend-claude-s-capabilities).

## Capacidades e permissões

| Escopo | Ferramentas |
| --- | --- |
| `radar:read` | `search_opportunities`, `get_opportunity`, `list_calendar_entries`, `get_radar_access` |
| `account:read` | `get_account_profile`, `list_my_calendar`, `list_my_collections`, `get_my_collection` |
| `account:read` + `calendar:write` | `set_calendar_opportunity` |
| `account:read` + `collections:write` | `create_collection`, `update_collection`, `set_collection_opportunity` |

O cadastro OAuth define o teto de capacidades do **cliente**, não as permissões do usuário. O desafio inicial solicita somente `radar:read account:read offline_access`. Escritas requerem os escopos adicionais em token e consentimento válidos; a ferramenta devolve um desafio de reautorização com `mcp/www_authenticate`, conforme a [documentação de autenticação](https://developers.openai.com/plugins/build/auth). Consentimento mostra somente as capacidades solicitadas.

Tokens antigos não recebem os escopos novos. Clientes cadastrados na versão anterior podem ter teto limitado ao Radar: se a reautorização não permitir ampliar escopos, remover a conexão no aplicativo e criar uma nova. Isso é explicado no guia. A checagem de família, a revogação permanente e a proteção contra consentimento antigo continuam em vigor. Conexões somente de conta também aparecem para revogação.

## Regras das funções da conta

- Identidade exclusivamente do Bearer verificado; argumentos não aceitam `userId` ou identidade alternativa. Perfil retorna somente nome, username e bio.
- Perfil concluído, conta ativa e proteção de conta verificados em cada operação. Calendário/coleções também respeitam suas flags e o acesso completo atual ao Radar. A consulta de acesso usa `claimPurchases:false`, sem vincular pagamentos ou consumir a escolha gratuita.
- Agenda retorna referências salvas ativas e dados/etapas do catálogo atual. Snapshots históricos não são serializados. Coleções são consultadas por proprietário antes de listar itens; tokens e links secretos de compartilhamento/feed nunca são retornados.
- Criar coleção produz uma coleção privada, com o limite existente de 20; itens mantêm o limite de 200. Criação não é idempotente e não deve ser repetida automaticamente após resposta incerta. Salvar/remover referências é idempotente.
- Atualização parcial de coleção grava somente colunas fornecidas, de forma atômica. Uma chamada não restaura os campos omitidos que outra chamada acabou de alterar.
- Alterações em coleções já compartilhadas continuam visíveis a seus leitores/seguidores. O consentimento explica esse efeito e as respostas incluem `shared`, sem revelar links secretos. O MCP não cria compartilhamentos.
- Salvar/remover na agenda pode refletir na sincronização Google já autorizada pelo usuário. A ferramenta apenas atualiza a Apogee e sinaliza a fila existente; não cria conexão Google, não acessa credenciais e não faz requisição Google diretamente. O consentimento e a descrição explicam esse efeito; `syncPending` não afirma sincronização concluída.

Não há ferramentas de pagamento, documentos de proteção, administração, edição de perfil, publicação, compartilhamento ou ativação de alertas. Escritas declaram `readOnlyHint:false`; alterações/remoções e possíveis efeitos externos usam as anotações correspondentes.

## Validação da etapa local

| Verificação final | Resultado |
| --- | --- |
| `npm test` | 782 testes passaram; zero falhas, cancelamentos ou testes pulados. |
| `npm run typecheck` | Passou. |
| ESLint dos arquivos alterados | Passou, sem erros ou avisos. |
| `npm run build` | Build standalone de produção passou, com MCP/calendário/coleções habilitados; um worker e heap de 2048 MB. |
| OAuth + PostgreSQL + cliente oficial MCP | Consulta de perfil e criação de coleção reais no banco sintético; escopo de coleção não altera agenda; revogação impede novas consultas. |
| Isolamento e direitos | Conta alheia, bloqueio, proteção, perda de acesso e flags recusados; snapshots e tokens secretos ausentes das respostas. |
| Edições simultâneas | Regressão reproduziu a perda de dados antes da correção e passou depois. Revisão independente confirmou o encerramento do achado, sem novas regressões concretas. |
| Guia de conexão | Renderização React, entradas desktop/móvel/rodapé, flag desligada, cópia e recuperação de falha de clipboard passaram. |

Evidências locais em `.local/mcp-radar-20261112/{account-full-test-final.log,account-typecheck.log,account-lint.log,account-build.log,account-concurrency-red.log,account-concurrency-green.log,account-shell-test.log}` (não versionadas). A etapa local não incluiu contas pessoais ou testes visuais; a conexão e a consulta ChatGPT posteriores estão comprovadas no registro de produção.

Todos os comandos pesados foram executados em sequência com `python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command ...`, após consulta ao status da fila. Nenhum servidor existente foi encerrado. O build removeu `DATABASE_URL`, `RADAR_ACADEMICO_API_URL` e `RADAR_ACADEMICO_API_TOKEN` do ambiente e usou somente configuração sintética de autenticação, sem arquivos `.env` locais ou consultas a banco/catálogo reais. O artefato `.next/standalone/server.js` foi gerado. Dependências e lockfile não foram alterados nesta continuação.

Comando de lint executado no diretório `make-it-fly-current` pelo mesmo wrapper:

```sh
npm exec eslint lib/mcp lib/opportunities/collections.ts components/members/mcp-setup.tsx components/members/member-bar.tsx components/site/mcp-connect-link.tsx components/site/site-header.tsx components/site/site-footer.tsx app/layout.tsx app/mcp/route.ts app/.well-known/oauth-protected-resource/mcp/route.ts app/membros/integracoes/mcp tests/mcp-account.test.mjs tests/mcp-setup.test.mjs tests/mcp-app-integration.test.mjs tests/mcp-http.test.mjs tests/mcp-oauth-flow.test.mjs tests/mcp-pages.test.mjs tests/helpers/mcp-test-database.mjs tests/deployment-isolation.test.mjs tests/earth-home.test.mjs
```

Não foram adicionadas migrações nesta ampliação da conta. A implantação inicial usou a migração OAuth `0016_mcp_oauth.sql` do candidato anterior e o histórico existente das funcionalidades habilitadas. Publicação, migração com backup e conexão pessoal ChatGPT foram autorizadas explicitamente e concluídas, conforme o registro de produção.
