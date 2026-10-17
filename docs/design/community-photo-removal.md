# Remoção da foto da comunidade

O usuário solicitou remover a foto da nova homepage e excluí-la do banco, substituindo o pedido anterior de redução/recorte.

Foto confirmada: `2026-09-23T10-57-15-503Z-3033bf41-154b-4294-8a89-5c32c8e423df`, envio anônimo, 900 × 1600 px, 105.548 bytes. A galeria tinha um único registro.

A credencial de exportação do endpoint administrativo não estava configurada; nenhum segredo ou acesso foi criado. Foi feita uma transação estreita no PostgreSQL existente, restrita ao ID, dimensões, anonimato, tamanho e hash MD5 conferidos, com exigência de exatamente uma linha afetada. Imagem e metadados estavam na mesma linha.

Após COMMIT, uma conexão separada confirmou `target_rows=0` e `gallery_total=0`. A API pública retornou `{"photos":[],"nextOffset":null}`, e a URL da imagem retornou HTTP 404. Nenhum outro registro foi excluído. Não houve deploy, troca de imagem, migração, reinício de serviço remoto, alteração de credencial ou cópia dos bytes da foto. A verificação cobre o banco ativo e o acesso público; backups existentes não foram alterados.

No código local, a seção de comunidade mantém texto e links, sem foto, moldura ou placeholder. O componente exclusivo HomeGallery e seus estilos foram removidos. O preview usa galeria vazia, acompanhando a exclusão real. A compilação está enfileirada após outro trabalho, bloqueado pelos conectores permanentes REA não isentos na fila atual.

Evidência estruturada: `exclusao-foto-comunidade.json`.
