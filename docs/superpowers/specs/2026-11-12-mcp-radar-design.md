# MCP do Radar da Apogee

Autorizado pelo usuário em 12/11/2026: implementar a primeira versão com login pela conta da Apogee e os direitos de acesso existentes. A autorização não inclui publicação, migração de produção ou mensagens reais.

## Comportamento

Um endpoint MCP remoto Streamable HTTP expõe quatro ferramentas de leitura: `search_opportunities`, `get_opportunity`, `list_calendar_entries`, `get_radar_access`. O cliente faz OAuth authorization code com PKCE S256, o usuário entra pelo login existente e aprova uma permissão `radar:read`. A conexão pode ser revogada na Apogee. Nenhuma ferramenta escreve no calendário, adquire produtos ou reivindica a oportunidade gratuita.

Busca e calendário usam os filtros e a ordenação existentes, têm paginação limitada e retornam prévias para contas sem direito ao detalhe. O detalhe respeita acesso administrativo, legado, compra ativa e oportunidade gratuita já escolhida. Usuários bloqueados, removidos ou com perfil incompleto não obtêm acesso através de um token antigo. Reembolsos e revogações são observados nas chamadas seguintes. Falhas de infraestrutura nunca liberam detalhes.

Datas de inscrição e de evento são campos distintos. Fonte oficial, requisitos e custos protegidos só aparecem para quem já pode consultar o detalhe. Resultados trazem URL da Apogee, verificação, estado e informações ausentes explicitamente. Só itens editoriais publicados disponíveis nas consultas normais são utilizados; não há execução de coletores.

## Arquitetura e escolhas de implementação

- Reutilizar Better Auth e sua sessão para autenticar e apresentar consentimento; usar o OAuth Provider oficial compatível com a versão instalada, sem criar protocolo OAuth próprio.
- SDK oficial MCP para transporte HTTP stateless e ferramentas tipadas. Cada chamada resolve identidade e direitos atuais no servidor; `userId` nunca é argumento de ferramenta.
- Guardar clientes, consentimentos e tokens em tabelas próprias do provedor, com migração SQL revisável e testes sintéticos. Tokens não são incluídos nos retornos ou nos logs.
- Metadados OAuth e de recurso protegido em rotas well-known, CORS adequado aos clientes, limites de corpo e requisições. Recursos de escrita não são registrados.
- Ativação por `APOGEE_MCP_ENABLED=true`; desativado por padrão. O login atual continua independente dessa ativação.
- Cliente OAuth com PKCE, códigos de uso único, audience canônica e escopos limitados. Cadastro dinâmico, se necessário à compatibilidade, restrito ao recurso e escopo do Radar; nenhum privilégio administrativo.
- Tokens de acesso opacos e armazenados como hash, validados a cada chamada pela API interna oficial `getOAuthProviderApi(...).requireActiveAccessToken`. O aplicativo verifica também audience, issuer, identidade humana, escopo e ausência de vinculação DPoP não suportada. Não criar chaves JWT ou lógica OAuth própria. O provedor valida sessão, cliente, expiração e revogação.
- Antes da autorização, capturar os IDs imutáveis dos consentimentos em estado isolado por requisição. Famílias identificadas pelo hash imutável do código são registradas antes da emissão, sob a mesma trava da conta usada na desconexão, exigindo que o consentimento capturado ainda exista e cubra os escopos/recurso. Uma autorização suspensa não pode aproveitar o consentimento novo da reconexão. Desconectar marca as famílias permanentemente revogadas, além de remover tokens e consentimento. Bearers de famílias antigas continuam negados após reconexão, inclusive quando uma emissão/renovação em voo recria registros.
- `radar:read` autoriza somente leitura; `offline_access` permite renovação da conexão. Não solicitar nome, e-mail ou outros escopos OIDC nesta versão.
- A página de login específica da conexão usa o cliente oficial do mesmo Better Auth e as credenciais e o Google da conta Apogee. A cópia assinada da solicitação OAuth é validada pelo provedor e pela página; o consentimento identifica o aplicativo e o domínio de retorno.
- Implementação no próprio app `make-it-fly-current`, reaproveitando DAL e serviços existentes com adaptação de identidade para chamadas Bearer.

## Validação

Testes de política com duas contas, perda de direito e informação protegida; testes de transporte com o cliente oficial MCP; fluxo OAuth real isolado com PKCE, consentimento, refresh e revogação; tipos, lint e build pela fila global. Sem banco de produção, e-mails reais ou publicação. Instalação efetiva no Claude/ChatGPT depende de uma URL HTTPS publicada, a autorizar separadamente.

## Referências técnicas conferidas

- [Autorização MCP](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [OAuth Provider do Better Auth](https://better-auth.com/docs/plugins/oauth-provider)
- [Código da API oficial do provedor na versão 1.7.14](https://github.com/better-auth/better-auth/blob/v1.7.14/packages/oauth-provider/src/token.ts)
- [SDK MCP v1](https://ts.sdk.modelcontextprotocol.io/server)
- [Correção de validação de requisições no SDK, aplicada via versão 1.32.2](https://github.com/advisories/GHSA-46jr-4wx8-v453)
- [Conexão no ChatGPT](https://developers.openai.com/api/docs/guides/custom-mcp-server)
- [Conexão no Claude](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp)
