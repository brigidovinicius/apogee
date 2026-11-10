# Worker do blog — escopo de 06/11/2026

Base: origin/main `511a4f4`; PRD v0.2 e política `apogee-blog-economico-v1` em `outputs/blog-prd-20261104` do workspace. A hipótese anterior de Google Auth foi substituída pela decisão posterior do usuário: API OpenAI com benefício incluído, sem usar Codex autenticado.

Implementar neste pacote Node independente: coleta RSS limitada, seleção/deduplicação sem IA, fila e orçamento transacionais no PostgreSQL, adaptador Responses, importação apenas como rascunho no CMS e operação por profile Docker opt-in. Nenhum serviço novo, banco externo, Redis ou CLI de IA. O schema `blog_worker` tem migração própria; não participa da geração Drizzle do site.

Arquivos: `config` (política/fontes/preços inativos), `sql` (fila, ledger e importador restrito), `src` (política, coleta, provedor, persistência e loop), `test` (unidade + PostgreSQL isolado), `Dockerfile` e profile opt-in em `make-it-fly-current/infra/site/docker-compose.yml`.

Aceite: concorrência não ultrapassa orçamento; reparos compartilham teto; reserva incerta permanece; reexecução/cache não duplica geração; benefício ausente/expirado/oferta e preço ausente bloqueiam; nenhum fallback; textos continuam privados; fontes desativadas não fazem HTTP; conteúdo remoto não consegue chamar ferramentas; HTTP e logs não vazam segredos. Validar com fixtures e PostgreSQL local, sem chamadas à API.

Fora desta etapa: habilitar fontes reais, resgatar benefício, testar geração com a chave, deploy, migração em produção, publicação, painel novo, scraping genérico, imagens/vídeos gerados e integração Radar. A coleta RSS de metadados pode funcionar sem geração; transformar conteúdo de feed em evidência exige homologação explícita por fonte. Rascunhos exigem revisão editorial factual e de direitos.
