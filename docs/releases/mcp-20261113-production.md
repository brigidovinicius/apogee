# MCP Apogee — publicação e validação

Autorização explícita em 13/11/2026: publicar a versão, ativar MCP e botão ChatGPT, incluir também botão Claude e validar a conexão ChatGPT. Migração `0016_mcp_oauth` autorizada em confirmação específica, com backup verificado.

## Candidato

- Versões funcionais: `ca2b38b`, `aebf340`; botão Claude `c570712`.
- Integração com `origin/main` em `5cb29a6`, preservando a árvore já publicada em `eb7b0e2` e o merge `04d5477`.
- Dois botões em Conexões de IA; Claude também no menu móvel, rodapé e barra de membros. Instruções seguem [Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp), com cadastro automático do cliente OAuth, e [OpenAI](https://developers.openai.com/api/docs/guides/custom-mcp-server). Não há alegação de instalação automática.
- Migrador restrito `scripts/mcp-oauth-migrate.mjs`: consulta por padrão; escrita somente com `--apply`; verifica papel `apogee_app`, todos os hashes/timestamps anteriores, ausência de esquema parcial e hash exato da migração. Apenas oito tabelas novas e journal, em uma transação com lock/statement timeout. O runner recebe o script e mantém as mesmas dependências existentes.

## Preflight observado

- VPS `root@srv1439756`, web saudável em `eb7b0e209925586c87954c318c5152f7a4133cb6`, imagem `sha256:2df98f6ad5542d25811d415505a46bd95d2c79dac4048fc3e65f0735fec60888`.
- Checkout remoto limpo, porém em `ede5733`, distinto da imagem publicada. Preparação/testes usarão worktree Git separado; a troca final terá nova conferência de SHA e saúde.
- Banco `apogee_membros`, papel do site `apogee_app`. Journal contém as 16 migrações anteriores; oito tabelas MCP ausentes. Flags de calendário e coleções já habilitadas; MCP ausente.
- Backup `/opt/apogee-membros/backups/pre-mcp-20261113T134455Z.dump`, 11.336.832 bytes, modo 0600, catálogo `pg_restore -l` válido; SHA-256 `d9e355467ebfc484329a3b0c7fc5925994d2ab91b79ce33788e446c3ba57c8bc`.
- Reversão: desativar somente MCP/recriar web ou restaurar imagem/revisão anterior. Preservar tabelas aditivas e backup; não executar DROP ou restauração integral como rollback de código.

## Resultado da publicação

- [PR #160](https://github.com/brigidovinicius/apogee/pull/160) integrada em `f3c23c7`. A imagem inicial publicada foi `589290f`, incluindo a revisão do evento `0fb94d9` que entrou no ar durante o preflight. O rollback dessa troca é `0fb94d9`, imagem `sha256:1cf6c49f8a7b8896186cf79bda486ccf9b8de9ff3b4636614db558ee9ff77ab6`.
- Migração executada com `docker run --rm --network apogee_membros_edge --env-file <env-existente> --volume <CA-pública>:<destino>:ro --read-only --tmpfs /tmp --memory=256m --cpus=0.5 apogee-site:636fd7913aaf3b41a06c6effdbc77cecac7d5c8b node scripts/mcp-oauth-migrate.mjs --apply`. Dry-run anterior apontou exatamente oito tabelas pendentes; aplicação retornou `changed:true`; conferência seguinte retornou `changed:false,pending:false`. O papel foi `apogee_app`, preservando ownership e privilégios existentes.
- Backup completo também lido com `pg_restore -f /dev/null`, sem restauração ou envio dos dados para outra máquina. O arquivo e seu checksum foram preservados.
- Flag `APOGEE_MCP_ENABLED=true` gravada atomicamente no `.env` do site, preservando os demais valores e modo 0600. Backup protegido anterior em `/opt/apogee-site/deploy-backups/site-env-pre-mcp-20261113T141340Z`.
- Somente `apogee-site/web` foi recriado com a imagem já construída e validada, via `docker compose ... up -d --no-deps --force-recreate web`. Checkout limpo e conferência de SHA/imagem anterior foram exigidos antes de cada troca. Sem profile `public`, DNS, Caddy, Vercel, migrações adicionais ou alterações nos demais stacks.

## Ajuste descoberto no fluxo real

O ChatGPT descobriu automaticamente issuer, recurso, DCR e PKCE e chegou ao consentimento da conta já autenticada. O primeiro pedido solicitou os quatro escopos da aplicação, mas omitiu `offline_access`. A autorização foi cancelada antes de conceder acesso, para configurar a renovação corretamente.

[PR #161](https://github.com/brigidovinicius/apogee/pull/161), integrada em `05cda6d`, anuncia `offline_access` também nos metadados do recurso e orienta sua inclusão nos escopos básicos do ChatGPT. O provedor já o suportava; conexões existentes não foram ampliadas. O contraste dos botões foi corrigido e conferido visualmente.

Revisão intermediária de renovação: `bc960a7fe7cd56179d53aa56c4158b7336c9f852`, imagem `sha256:3f271894c822e84fe88228297ec5b278a326dde094971f6a9e8c1f5601d01d65`. Foi substituída pelo ajuste de consentimento registrado abaixo.

## Validação observada

| Verificação | Resultado |
| --- | --- |
| Suíte completa integrada | 783 testes passaram, sem falhas ou testes pulados. |
| CI completo | Sucesso nos heads `636fd79` e `589290f`: runs [43438228911](https://github.com/brigidovinicius/apogee/actions/runs/43438228911) e [43439651529](https://github.com/brigidovinicius/apogee/actions/runs/43439651529). |
| Ajuste de renovação | 18 testes focados de HTTP, OAuth/renovação e guia passaram; lint sem erros. |
| Build Docker final | Passou com TypeScript e um worker, heap de 2048 MB. |
| HTTPS público | Metadados do recurso/servidor 200, issuer e resource canônicos, PKCE S256 e DCR descobertos; MCP sem Bearer 401 com challenge; registro com JSON inválido 400 pela borda; conexões privadas redirecionam visitante ao login. |
| Botões e guia | Confirmados em navegador autenticado; links ChatGPT/Claude visíveis, cópia do endereço confirmada e instrução de renovação publicada. |
| Dados de usuários | Nenhuma oportunidade gratuita consumida, pagamento vinculado, perfil editado, agenda/coleção real alterada ou e-mail enviado. |

## Conexão pessoal no ChatGPT — concluída

### Correção da aceitação de consentimento

Após autorização explícita para substituir o rascunho e conectar a conta com os quatro escopos da aplicação e renovação até revogação, o fluxo real encontrou `401 invalid_request: request not found` ao aceitar. A API em processo do OAuth Provider 1.7.14 precisa de `Request` para continuar no endpoint de autorização; apenas os headers não bastavam. O ajuste fornece esse contexto e define `asResponse:false`, mantendo as verificações de origem, assinatura, sessão e concessão por usuário.

O teste de integração passou a executar a Server Action `decideMcpConsent` real, sem `prompt=consent` artificial: falhou antes da correção e passou depois, verificando código, família imutável, token, consulta via SDK, revogação e reconexão. Os 59 testes MCP passaram; lint terminou com zero erros e um aviso preexistente de imagem na galeria. Revisão independente sem achados relevantes.

### Publicação final e evidência real

- [PR #163](https://github.com/brigidovinicius/apogee/pull/163) integrada em `78028ebf7f2e386359be03efbf43ac87da51fc80`, após os seis gates do [CI 43460155655](https://github.com/brigidovinicius/apogee/actions/runs/43460155655) passarem, incluindo os 783 testes do site. O candidato preserva o painel do PR #158 (`17ed786`, merge `c6ddeb0`). Árvore do app conferida como idêntica ao merge final.
- **Revisão publicada:** `6f1d1977b28ebf1ca1910c89be7b23829f828922`. **Imagem:** `sha256:0329711083ce09edc1128876d010d81dc48f83c085843e3bf3447c4c69756125`. Build Docker e TypeScript passaram. A suíte na imagem isolada passou 782/783 após montar referências externas somente para leitura; a exceção exige Git, ausente nessa imagem, e seus nove testes passaram no repositório local completo. O CI completo também passou nesse contexto.
- Troca exclusiva de `web` sob `flock` em `/opt/apogee-site/deploy.lock`, após o responsável pelo blog concluir a troca independente do worker. SHA/imagem anteriores e checkout limpo foram conferidos antes da troca. Healthcheck `healthy`, zero reinícios, `APOGEE_MCP_ENABLED=true`; IDs dos demais serviços do projeto preservados. Home e metadados públicos responderam 200. Sem nova migração ou alteração de configuração. Rollback imediato: imagem/revisão `bc960a7`, preservando tabelas e flag.
- O rascunho inicial foi excluído e substituído com autorização pessoal explícita. O novo aplicativo solicita os cinco escopos, incluindo `offline_access`; a retomada retornou ao ChatGPT e o aplicativo passou a oferecer uso no chat.
- **Consulta real concluída:** `search_opportunities` com `pageSize=3` e `deadlineWindow="abertas"` retornou três oportunidades, com links Apogee e oficiais. A atividade da Apogee e a resposta ficaram visíveis no chat. Nenhum calendário, coleção, perfil ou pagamento real foi alterado.
- Conferência adicional no banco, em transação somente leitura, retornou os cinco escopos e `access_active=true`, `refresh_active=true`, `family_active=true`, sem ler ou imprimir credenciais. A emissão de renovação foi confirmada; não se esperou a expiração do token para observar uma rotação automática real. Rotação e revogação foram verificadas nos testes sintéticos.

## Conexão pessoal no Claude — concluída

- A conta Claude Free estava acima do limite de um conector personalizado e não permitia adicionar a Apogee. Dois cadastros personalizados anteriores foram removidos somente após autorização expressa do titular; a opção de adição foi então liberada.
- Conector **Apogee** cadastrado com `https://www.apogee.community/mcp`, transporte HTTP Streamable, **Entrar agora** e **Registrar automaticamente**. A descoberta OAuth/DCR funcionou; o callback foi `https://claude.ai/api/mcp/auth_callback`.
- Consentimento real da Apogee mostrou `radar:read`, `account:read` e `offline_access`. O titular autorizou explicitamente leitura do Radar, perfil, calendário e coleções, com renovação até revogação. O callback concluiu e o Claude exibiu as 12 ferramentas da integração. Na primeira validação, o token não recebeu escopos de escrita.
- Na conversa, a Apogee estava habilitada. O Claude solicitou `search_opportunities` com `pageSize=3` e `deadlineWindow="abertas"`; a execução recebeu aprovação somente para essa chamada. A atividade **Carregou ferramentas, usou a integração Apogee** e a resposta com três oportunidades, prazos e links Apogee/oficiais ficaram visíveis.
- Nenhum calendário ou coleção foi alterado. A renovação foi solicitada e autorizada; não se esperou a expiração para observar sua execução automática. Não foi necessário alterar código, flags, infraestrutura ou banco para essa validação, além dos registros OAuth normais da conexão autorizada.

### Ampliação para organizar calendário e coleções

- O titular pediu as mesmas capacidades de organização já autorizadas no ChatGPT. A conta Claude foi conferida no menu da própria interface. A desvinculação inicial foi rejeitada pela revisão automática por falta de autorização explícita para interromper a conexão existente; nenhuma ação foi contornada. Após confirmar a conta, o titular autorizou expressamente desvincular somente a Apogee e reconectar com organização de calendário/coleções e renovação, incluindo possíveis reflexos no Google Agenda já conectado e nas coleções já compartilhadas.
- O cadastro do conector foi preservado. O Claude iniciou uma requisição OAuth nova. Um novo pedido padrão a `/api/auth/oauth2/authorize` solicitou os cinco escopos, preservando integralmente cliente, callback, state, resource e PKCE dessa mesma tentativa. Os campos de assinatura do consentimento anterior não foram reutilizados: o provedor validou a requisição e produziu uma nova tela assinada com as permissões completas. O usuário já havia autorizado exatamente esse conjunto de dados, ações e destino.
- O callback concluiu com **Conectado a Apogee**. Uma transação somente leitura confirmou `radar:read account:read calendar:write collections:write offline_access` no consentimento, no token de acesso e no token de renovação, com família ativa. Nenhuma credencial foi lida ou impressa. As quatro ferramentas de organização permaneceram como **Requer aprovação**, sem transformar a concessão OAuth em aprovação automática de alterações.
- Renovação real confirmada após a expiração do token original. O Claude executou novamente `get_radar_access` e retornou `fullAccess:true`; os metadados passaram de zero para uma rotação, com novo prazo de acesso e os cinco escopos preservados no consentimento, acesso e renovação, além da família ativa. A checagem foi somente leitura, sem acessar credenciais. Não foram feitas alterações de teste em calendário ou coleções. Essa ampliação não exigiu deploy, migração ou alteração de código/configuração do servidor.

Limitação observada para futuras ampliações automáticas: o desafio inicial solicita leitura. O retorno atual de ferramenta sem escopo usa `_meta["mcp/www_authenticate"]` em HTTP 200; a [documentação oficial de step-up do Claude](https://claude.com/docs/connectors/building/lazy-authentication) requer HTTP 403 com `WWW-Authenticate: Bearer error="insufficient_scope", scope="..."` para iniciar essa ampliação automaticamente. A conexão pessoal acima recebeu os cinco escopos por um novo consentimento OAuth explícito; não foi feita mudança de transporte nesta etapa.

As conexões validadas no ChatGPT e no Claude são pessoais; não houve submissão aos diretórios públicos de aplicativos.

Evidências locais não versionadas em `.local/mcp-radar-20261112/`: logs anteriores, `consent-action-red.log`, `consent-action-green.log`, `consent-action-tests.log`, `consent-action-lint.log`, `consent-action-repository-context.log`, `published-buttons.jpg`, `chatgpt-radar-validated.jpg`, `claude-connector-limit.jpg`, `claude-consent-ready.jpg`, `claude-connected.jpg`, `claude-radar-validated.jpg`, `claude-account-confirmed.jpg`, `claude-full-consent.jpg`, `claude-write-permissions.jpg` e `claude-write-renewal-validated.jpg`. Logs isolados na VPS em `/opt/apogee-site/deploy-logs/mcp-{636fd79,589290f,bc960a7,6f1d197}-*.log`. Não persistir URLs OAuth assinadas ou tokens nesses relatórios.
