# Blog: mídias e SEO — 12/10/2026

## Implementado localmente

- O administrador salva o primeiro rascunho e então envia JPEG, PNG ou WebP de até 5 MB para a biblioteca daquele artigo. O servidor confirma a sessão `admin`, limita o corpo a 6 MB, converte para WebP de até 2 MB e grava os bytes na tabela `blog_media` do PostgreSQL privado da VPS. Cada imagem recebe texto alternativo e pode ter legenda.
- Imagens podem ser escolhidas como capa ou inseridas no texto pelo marcador `[[media:id]]`. A página pública só renderiza imagens pertencentes ao próprio artigo. Imagens não utilizadas podem ser excluídas. A capa também aparece na listagem, em Open Graph, Twitter e nos dados estruturados `BlogPosting`.
- Links HTTPS do YouTube e Vimeo são validados por domínio e identificador. O artigo incorpora o vídeo após o texto; não há upload de arquivo de vídeo.
- O editor inclui palavra-chave foco, lista de verificação em tempo real, prévia de título/descrição, opção `noindex` e URL canônica. Artigos `noindex` saem do sitemap. A palavra-chave serve à revisão editorial; não gera `meta keywords` nem promete posição em buscas.

## Limites e publicação

- Após integrar a revisão atual da galeria, a migração `drizzle/0002_rapid_queen_noir.sql` cria as três tabelas do blog e os campos de SEO e mídia. Ela sucede `0001_gallery_postgres.sql`, já pertencente à linha principal.
- A rota `/blog/media/[photo]` serve imagens de artigos visíveis publicamente. Imagens de rascunhos só são servidas para uma sessão `admin`; as respostas não são armazenadas em cache.
- A exclusão de uma imagem livre remove seus metadados e bytes em uma operação de banco. Imagens ainda referenciadas pela capa ou texto não podem ser removidas.
- O armazenamento usa a conexão PostgreSQL já existente; não exige segredo ou serviço adicional. Nenhum artigo foi criado ou publicado nesta implementação.

## Validação

- `npm run db:generate`: migração 0002 gerada após a migração 0001 da galeria.
- `npm run typecheck`: passou na revisão integrada.
- `npm run lint`: passou com um aviso preexistente de `<img>` na galeria.
- `npm test`: 233 testes passaram na revisão integrada.
- `npm run build`: compilou e incluiu as rotas do blog, editor e mídia como rotas dinâmicas.
- `tests/gallery-postgres.integration.mjs` agora valida as duas migrações em sequência, bytes de imagem, limite de 2 MB, reaplicação idempotente e recusa de histórico divergente em PostgreSQL descartável no CI. A execução desse teste e a validação remota devem ser registradas separadamente.
