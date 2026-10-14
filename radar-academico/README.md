# Radar Acadêmico

MVP para reunir oportunidades públicas provenientes exclusivamente de fontes oficiais. A ingestão publica automaticamente após validação de fonte, evidência, estado e prazo. O painel da Apogee gerencia o mesmo catálogo ao vivo. A especificação vigente está no [PRD](../docs/radar-prd.md).

## Stack

- Next.js 16, React 19 e TypeScript
- PostgreSQL existente na VPS, acessado apenas pelo servidor
- Docker isolado, porta padrão `3100`
- Cheerio, RSS Parser, robots-parser e PDF.js
- Vitest

Não há dependência paga de Vercel, Supabase ou serviços de scraping.

## Segurança editorial

Uma oportunidade pública exige fonte oficial ativa, evidência, prazo válido ou fluxo contínuo explícito e estado aberto ou próximo confirmado. Perfis e rotas de candidatura são preservados. Retificações válidas são aplicadas automaticamente com histórico. Exclusões lógicas e campos alterados pelo administrador sobrevivem às coletas. Registros incompletos ficam fora do catálogo, com motivo de validação.

## Configuração local

1. Copie `.env.example` para `.env`.
2. Crie um banco e usuário PostgreSQL exclusivos para o Radar.
3. Preencha `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET` e `CRON_SECRET`.
4. Gere o hash da senha com `node scripts/hash-password.mjs "senha forte"`.
5. Execute `npm run migrate`.
6. Execute `npm run dev`.

## Coleta automática

A rota `POST /api/cron/ingest-official-sources` exige `Authorization: Bearer $CRON_SECRET`. Sem `sourceId`, ela seleciona até três fontes **ativas, verificadas e com extração RSS/HTML** cujo intervalo venceu. A seleção usa uma reserva temporária no banco para evitar duas coletas simultâneas da mesma fonte. O serviço `scheduler` do Compose chama a rota a cada cinco minutos por padrão (`INGESTION_INTERVAL_SECONDS`, mínimo de 300). Cada fonte respeita seu próprio `crawl_interval_hours`; falhas tentam novamente após uma hora. A rota com `sourceId`, `maxPages` e `maxCandidates` continua disponível para coleta manual controlada.

O coletor lê uma página de listagem por execução e, dentro do limite de páginas, páginas de detalhe ou PDF oficial. O ponto de avanço por fonte fica salvo em `crawl_listing_index` e `crawl_link_offset`, criados pela migração `0006_crawl_progress.sql`, para percorrer as próximas listagens e links sem voltar sempre aos primeiros. Fichas válidas são publicadas automaticamente; as demais recebem `needs_information` e um motivo técnico, sem fila de aprovação. Até duas fichas existentes são reconsultadas por execução, dentro do orçamento de páginas; a reconsulta é agendada para 24 horas ou uma hora em caso de falha. Fontes com links ou reconsultas pendentes retomam em cinco minutos. Execuções e falhas por fonte ficam em **Admin → Ingestões**. O painel **Fontes** mostra UFs com fontes automáticas ativas e explicita as lacunas. As opções `api`, `sitemap` e `pdf` como modo de listagem ainda não têm adaptador automático; uma página HTML/RSS pode apontar para um PDF de detalhe.

Exemplo conceitual de chamada do agendador:

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

## Ampliar a cobertura

No admin, acesse **Fontes → Nova fonte**. Cadastre somente domínio, subdomínios e URLs oficiais previamente conferidos. Escolha uma UF ou abrangência Brasil, sem atribuir cidade a oportunidades nacionais. A fonte nasce inativa, em `verification_status=pending` e `manual_assisted`. Depois de validar HTTPS, robots.txt, condições de consulta, público e método de extração, registre a auditoria, selecione RSS/HTML e ative a fonte. Alterações de domínio, listagens ou modo exigem nova auditoria. Crawling amplo de subdomínios não é permitido.

Não há garantia de oportunidades em todos os municípios ou áreas somente por existir um catálogo de cidades. Cada UF, cidade, área e modalidade depende de editais atuais nas fontes oficiais verificadas e de validação automática. Os conjuntos de [dados abertos do MEC](https://dadosabertos.mec.gov.br/) incluem indicadores e bolsas concedidas; registros históricos não são tratados como inscrições abertas.

## Importação CSV

Envie CSV autenticado para `POST /api/admin/import-csv` com `Content-Type: text/csv`. Colunas obrigatórias:

`official_source_name,source_page_url,title,institution,applicant_type,application_route,deadline,last_verified_at`

Colunas opcionais: `official_document_url`, `application_url`, `state_code` e `city_name`. A página da fonte deve ser oficial; um formulário externo só é aceito quando vinculado a ela.

Use `YYYY-MM-DD` em `deadline` quando a fonte informar somente a data, ou `fluxo contínuo` quando não houver encerramento definido. Uma data sem horário permanece aberta até o fim do dia no horário de São Paulo.

O CSV legado não informa estado comprovado das inscrições; suas linhas permanecem fora do catálogo até a reconsulta automática da fonte confirmar os requisitos. Para criar e publicar diretamente, use o formulário estruturado na Apogee.

## Verificação

- `npm test`
- `npm run lint`
- `npm run build`

Cobertura inicial: **Beta: UFSC, oportunidades de Santa Catarina e programas nacionais selecionados.**
