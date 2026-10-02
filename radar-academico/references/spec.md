# Especificação do MVP

## Objetivo

Entregar um Radar Acadêmico de custo monetário adicional zero, hospedável na VPS já paga, que reúna oportunidades públicas de fontes oficiais sem inventar campos ou publicar automaticamente.

## Regras centrais

- Fonte primária pública, oficial, registrada e rastreável.
- Bloqueio de terceiros, encurtadores, IPs, credenciais, HTTP, localhost em produção e redirecionamentos externos.
- Formulário externo somente como caminho de candidatura vinculado a fonte oficial.
- Prioridade: API, RSS, sitemap, HTML, PDF e importação manual assistida.
- Respeito a robots.txt, uma requisição por domínio a cada dois segundos, cache condicional, timeout, backoff e limites.
- Itens extraídos entram em `pending_review`.
- Publicação exige prazo, público, rota de candidatura, fonte e revisão humana.
- Retificações preservam histórico e exigem nova revisão.
- PDFs sem texto ficam em revisão manual; não há OCR no MVP.
- Nenhuma oportunidade fictícia.

## Infraestrutura

Aplicação Next.js em contêiner próprio, PostgreSQL existente por `DATABASE_URL`, porta configurável e nenhuma dependência SaaS paga. Deploy e migrações na VPS são manuais e precedidos por inventário e backup.

## Entidades

`official_sources`, `opportunities`, `opportunity_sources`, `opportunity_revisions` e `ingestion_runs`, com RLS forçada e política pública limitada a itens aprovados, abertos e revisados.

## Interface

Página pública, detalhe com fonte, selos separados, admin de fontes, ingestões, fila de revisão, cadastro controlado de nova fonte e importação CSV autenticada.
