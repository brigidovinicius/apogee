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

## Resultado

Em preparação. Registrar revisão exata, comandos, migração, flag, saúde, HTTP público e resultado real do fluxo ChatGPT após concluir. Nenhuma mudança de DNS, Caddy, Vercel ou stacks vizinhos faz parte desta publicação.
