# MCP da conta e entrada no ChatGPT

Escopo aprovado em 13/11/2026: botão “Incluir no meu ChatGPT” no site, consulta ao próprio perfil e consulta/organização do calendário e das coleções da conta. Continuação local do candidato `ca2b38b`; publicação e migração continuam separadas.

## Implementação

- Entrada pelo cabeçalho (desktop/mobile), rodapé e área de membros, condicionada à flag existente. Uma decisão do servidor compartilhada por contexto evita expor configuração do servidor em componentes cliente.
- Guia em Conexões de IA, com URL selecionável, cópia com recuperação de falhas e link oficial `https://chatgpt.com/plugins`. Sem afirmar instalação automática; criação, OAuth e instalação são concluídos no ChatGPT. Não existe plugin público da Apogee publicado por este trabalho.
- Manter `radar:read`; adicionar `account:read`, `calendar:write` e `collections:write`. O teto do cliente cadastrado permite os quatro escopos; o desafio inicial pede somente leitura. Esse teto não concede permissões à conta. Ferramentas verificam seus escopos e retornam desafio OAuth para elevação explícita. Consentimento mostra exatamente as capacidades solicitadas; grants antigos não recebem permissões novas automaticamente.
- Perfil próprio somente nome, usuário e bio. Calendário/coleções exigem as mesmas flags, proteção de conta e acesso ativo do site, sem vincular compras. IDs de usuário nunca vêm dos argumentos. Reaproveitar operações com ownership, limites e validações existentes.
- Operações: listar calendário e coleções; consultar coleção própria; salvar/remover oportunidade do calendário; criar e editar coleção; adicionar/remover item da coleção. Nenhuma ferramenta de compartilhamento, alertas, pagamento, proteção documental, edição de perfil ou administração.
- Anotações MCP distinguem leitura, alteração e remoção. Não incluir snapshots brutos, links secretos de feed/compartilhamento ou dados de terceiros nas respostas.

## Validação

1. Testes de PostgreSQL sintético para isolamento de contas, direitos/flags e operações reais; teste SDK para escopos insuficientes e grants antigos.
2. Testes do fluxo guiado, inclusive falha do clipboard e inexistência de alegação de instalação concluída.
3. Suíte, tipos, lint e build em sequência pela fila global, sem servidores ou agentes pesados em paralelo.
4. Revisão independente, `git diff --check`, documentação dos resultados e commit local atômico. Sem push, deploy ou banco real.

Referências verificadas: [conectar servidor](https://developers.openai.com/api/docs/guides/custom-mcp-server), [OAuth e elevação por ferramenta](https://developers.openai.com/plugins/build/auth), [Plugins](https://chatgpt.com/plugins).
