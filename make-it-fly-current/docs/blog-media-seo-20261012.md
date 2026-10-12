# Blog: mídias e SEO — 12/10/2026

## Implementado localmente

- O administrador salva o primeiro rascunho e então envia JPEG, PNG ou WebP de até 5 MB para a biblioteca daquele artigo. O servidor confirma a sessão `admin`, limita o corpo a 6 MB, converte para WebP de até 2 MB e armazena no bucket Supabase já utilizado pelo site. Cada imagem recebe texto alternativo e pode ter legenda.
- Imagens podem ser escolhidas como capa ou inseridas no texto pelo marcador `[[media:id]]`. A página pública só renderiza imagens pertencentes ao próprio artigo. Imagens não utilizadas podem ser excluídas. A capa também aparece na listagem, em Open Graph, Twitter e nos dados estruturados `BlogPosting`.
- Links HTTPS do YouTube e Vimeo são validados por domínio e identificador. O artigo incorpora o vídeo após o texto; não há upload de arquivo de vídeo.
- O editor inclui palavra-chave foco, lista de verificação em tempo real, prévia de título/descrição, opção `noindex` e URL canônica. Artigos `noindex` saem do sitemap. A palavra-chave serve à revisão editorial; não gera `meta keywords` nem promete posição em buscas.

## Limites e publicação

- A migração `drizzle/0002_perfect_namor.sql` adiciona `blog_media` e quatro campos a `blog_post`. As migrações 0001 e 0002 precisam ser aplicadas na ordem antes de executar este código em produção.
- O bucket de imagens é público. As imagens de rascunhos podem ser acessadas por quem tiver a URL direta. Para rascunhos privados, será necessário outro desenho de armazenamento.
- A exclusão remove primeiro o registro do banco e depois tenta apagar o objeto. Se a exclusão no storage falhar, o objeto pode ficar órfão; o servidor registra essa falha.
- A confirmação local não demonstra armazenamento nem banco remoto. Push, migração remota e deploy não foram executados nesta etapa. Nenhum artigo foi criado ou publicado.

## Validação

- `npm run db:generate`: migração criada.
- `npm run typecheck`: passou.
- `npm run lint`: passou com um aviso preexistente de `<img>` na galeria.
- `npm test`: 230 testes passaram.
- `npm run build`: compilou e incluiu as rotas do blog, editor e API de mídia como rotas dinâmicas.
- Sem banco de teste local e sem credenciais de storage de teste, o fluxo completo de upload e persistência não foi exercitado. A migração remota e a operação em produção permanecem sem validação.
