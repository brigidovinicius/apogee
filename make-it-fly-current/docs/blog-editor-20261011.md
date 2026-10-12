# Blog editorial Apogee — 11/10/2026

## Escopo implementado localmente

- `/blog` e `/blog/[slug]`: artigos públicos com filtros por Estudos,
  Empreendedorismo, Tecnologia, Ciências, Assuntos gerais e Atualidades.
- `/admin/posts`, `/admin/posts/novo` e `/admin/posts/[id]`: listar, escrever,
  editar, salvar rascunho, publicar, agendar, retirar do ar, arquivar e
  restaurar. Ações e leituras administrativas exigem sessão com papel `admin`
  no servidor.
- Conteúdo em texto simples, separado por parágrafos, renderizado pelo React
  sem execução de HTML. Slug único, resumo, destaque, título e descrição SEO,
  autor original e eventos de administração são persistidos em PostgreSQL.
- O artigo agendado só aparece em consultas públicas quando `scheduled_at`
  chega. Não há cron. O sitemap inclui apenas artigos visíveis na hora da
  requisição.

## Migração e publicação

Esta etapa gerou originalmente `drizzle/0001_shallow_spectrum.sql` no ramo local.
Após a integração da migração da galeria já presente na linha principal, as
tabelas do blog passaram para `drizzle/0002_rapid_queen_noir.sql`. O código
depende da aplicação dessa migração antes de ser servido em produção. Nenhum
artigo foi criado ou publicado nesta etapa inicial.

## Validação local

- `npm run db:generate`: migração gerada pelo Drizzle.
- `npm run typecheck`: passou.
- `npm run lint`: passou com aviso preexistente de `<img>` na galeria.
- `npm test`: 228 testes passaram.
- `npm run build`: compilou e confirmou `/blog`, `/blog/[slug]`, as três
  rotas administrativas e o sitemap como rotas dinâmicas.

Sem banco de teste local, não houve teste integrado de persistência nem revisão
visual no navegador. O texto do protótipo em `docs/ui-mockup-integration-plan.md`
descreve o diagnóstico anterior à implementação deste módulo.
