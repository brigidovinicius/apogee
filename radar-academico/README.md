# Radar Acadêmico

MVP para reunir oportunidades públicas provenientes exclusivamente de fontes oficiais. A ingestão nunca publica automaticamente: itens descobertos entram em `pending_review` e só ficam públicos após revisão humana.

## Stack

- Next.js 16, React 19 e TypeScript
- PostgreSQL existente na VPS, acessado apenas pelo servidor
- Docker isolado, porta padrão `3100`
- Cheerio, RSS Parser, robots-parser e PDF.js
- Vitest

Não há dependência paga de Vercel, Supabase ou serviços de scraping.

## Segurança editorial

Uma oportunidade pública exige fonte oficial, prazo ou fluxo contínuo, público elegível, rota de candidatura e revisão humana. Chamadas para instituições, empresas, professores ou pesquisadores não aparecem como candidatura direta para estudantes. Retificações geram revisão separada e preservam o estado anterior.

## Configuração local

1. Copie `.env.example` para `.env`.
2. Crie um banco e usuário PostgreSQL exclusivos para o Radar.
3. Preencha `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` e `CRON_SECRET`.
4. Gere o hash da senha com `node scripts/hash-password.mjs "senha forte"`.
5. Execute `npm run migrate`.
6. Execute `npm run dev`.

## Cron diário na VPS

A rota `POST /api/cron/ingest-official-sources` exige `Authorization: Bearer $CRON_SECRET`. Configure o agendador da VPS somente depois do deploy isolado. Exemplo conceitual:

`curl --fail --request POST --header "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3100/api/cron/ingest-official-sources`

Não grave o segredo diretamente em arquivos públicos ou no histórico do shell.

## Deploy seguro na VPS

Antes do deploy, inventarie `docker ps`, portas, redes, volumes, bancos e backups da aplicação existente. Use:

- banco e usuário PostgreSQL exclusivos;
- nome de projeto Compose exclusivo;
- porta externa livre, configurada em `RADAR_PORT`;
- rede Docker própria;
- backup antes da primeira migração;
- proxy reverso em subdomínio exclusivo;
- nenhuma alteração ou remoção de contêiner, volume ou banco existente.

O `docker-compose.yml` contém apenas o Radar e não cria nem modifica o PostgreSQL da VPS. Migrações não são executadas automaticamente no boot.

## Adicionar uma universidade

No admin, acesse **Fontes → Nova fonte**. Cadastre somente domínio, subdomínios e URLs oficiais previamente conferidos. A fonte nasce inativa, em `verification_status=pending` e `manual_assisted`. Após validar HTTPS, robots.txt, termos, público, método de extração e contato, altere o status diretamente no banco durante a fase operacional. Crawling amplo de subdomínios não é permitido.

## Importação CSV

Envie CSV autenticado para `POST /api/admin/import-csv` com `Content-Type: text/csv`. Colunas obrigatórias:

`official_source_name,source_page_url,official_document_url,title,institution,applicant_type,application_route,deadline,last_verified_at`

Todas as linhas entram em revisão. Formulários externos só são aceitos como `application_url` quando vinculados a uma página oficial registrada.

## Verificação

- `npm test`
- `npm run lint`
- `npm run build`

Cobertura inicial: **Beta: UFSC, oportunidades de Santa Catarina e programas nacionais selecionados.**
