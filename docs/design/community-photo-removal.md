# Remoção da foto da comunidade

O usuário solicitou remover a foto da nova homepage e excluí-la do banco, substituindo o pedido anterior de redução/recorte.

Foto confirmada: `2026-09-23T10-57-15-503Z-3033bf41-154b-4294-8a89-5c32c8e423df`, envio anônimo, 900 × 1600 px, 105.548 bytes. A galeria tinha um único registro.

A credencial de exportação do endpoint administrativo não estava configurada; nenhum segredo ou acesso foi criado. Foi feita uma transação estreita no PostgreSQL existente, restrita ao ID, dimensões, anonimato, tamanho e hash MD5 conferidos, com exigência de exatamente uma linha afetada. Imagem e metadados estavam na mesma linha.

Após COMMIT, uma conexão separada confirmou `target_rows=0` e `gallery_total=0`. A API pública retornou `{"photos":[],"nextOffset":null}`, e a URL da imagem retornou HTTP 404. Nenhum outro registro foi excluído. Não houve deploy, troca de imagem, migração, reinício de serviço remoto, alteração de credencial ou cópia dos bytes da foto. A verificação cobre o banco ativo e o acesso público; backups existentes não foram alterados.

No código local, a seção de comunidade mantém texto e links, sem foto, moldura ou placeholder. O componente exclusivo HomeGallery e seus estilos foram removidos. O preview usa galeria vazia, acompanhando a exclusão real. A compilação e o preview foram concluídos após a exceção estreita do REA MCP e o reenfileiramento autorizado das esperas antigas.

Evidência estruturada: `exclusao-foto-comunidade.json`.

## Validação concluída

ESLint da homepage e build Next.js, incluindo TypeScript, passaram. No navegador local, 320/390/768/1440 px sem overflow horizontal, zero imagens/figures na seção de comunidade, sem mascote e com três links preservados. Menu com Escape e filtro por competições foram retestados; o filtro exibiu três resultados. Preview ativo em http://127.0.0.1:3109/#comunidade. Capturas atuais: comunidade-sem-foto-desktop.png e comunidade-sem-foto-mobile.png.

A fila recebeu somente a exceção exata `npm exec rea-agents@6.5.0 mcp`; setup, outros comandos REA, outros pacotes, builds e testes continuam sujeitos à fila. Foram reenfileirados, com autorização, os supervisores sem filhos 61746 e 65161, mantendo Radar antes da homepage. Os conectores e servidores existentes não foram encerrados. Os 293 testes aprovados pertencem ao trabalho do Radar; não são apresentados como suíte desta alteração da homepage.

Não houve deploy. As verificações de exclusão no banco ativo e HTTP 404 permanecem registradas na evidência da exclusão. Backups existentes e capturas históricas não foram alterados.
