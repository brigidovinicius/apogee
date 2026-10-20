# SEC-05 — privilégio mínimo no banco Radar

Status: implementação local. Sem push, CI remoto, migração na VPS, alteração de
segredos ou deploy. O achado de produção permanece aberto até o corte autorizado
e verificação dos papéis efetivamente usados pelos contêineres.

## Escopo do lote

O runtime anterior usava DATABASE_URL tanto para consultas públicas quanto para
administração. Na auditoria, a credencial da VPS tinha SUPERUSER e BYPASSRLS.
As políticas existentes dependiam de app.is_admin, variável que uma conexão pode
alterar: ela é contexto da transação, não comprovação de identidade.

A [documentação do PostgreSQL](https://www.postgresql.org/docs/17/ddl-rowsecurity.html)
explica que SUPERUSER/BYPASSRLS ignoram RLS e que TRUNCATE não é protegido por RLS.

Este lote muda somente a separação de credenciais, papéis/policies, acesso ao banco,
configuração dos contêineres e testes necessários. Outros achados da auditoria e
avisos de dependências não estão incluídos.

## Comportamento preparado

| Processo/operação | Credencial | Permissão |
|---|---|---|
| queryPublic | DATABASE_READER_URL / radar_reader | SELECT nas três tabelas públicas, sujeito às políticas; transação read only |
| withAdminTransaction | DATABASE_EDITOR_URL / radar_editor | SELECT/INSERT/UPDATE nas 12 tabelas de negócio; DELETE apenas na retenção de assinaturas/limites |
| Migrador explícito | DATABASE_MIGRATION_URL | DBA/credencial de operação, fora do runtime |
| Scheduler | CRON_SECRET | Chama a rota interna; nenhuma credencial de banco ou e-mail |
| Ownership | radar_owner, NOLOGIN | Schema/tabelas separados dos LOGINs do runtime |

Os LOGINs de runtime são NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE,
NOINHERIT e NOREPLICATION. Não têm membership de outro papel, ownership ou CREATE
em banco/schema. A aplicação verifica essas propriedades antes de cada transação,
inclusive em conexões reutilizadas, e recusa credencial incompatível. Não há
fallback para a URL da outra função ou para a URL antiga.

As 15 políticas existentes ficam restritas ao papel correspondente. O leitor não
obtém acesso privado alterando app.is_admin. O editor continua dependendo da
autorização server-side já existente nas rotas/actions. Possuir a senha de editor
permite agir com os grants de editor: a GUC não é uma segunda autenticação nem
substitui proteção dessa senha.

A migração 0038 não contém senhas e não altera o role de bootstrap antigo. Roles
novos não autenticam por SCRAM até o operador provisionar suas senhas. Roles
preexistentes com privilégios elevados/membership causam falha, exigindo revisão.
Futuras tabelas exigem análise/grants explícitos; não há permissão automática em
novos objetos privados. As PKs atuais são UUID/texto e não requerem sequences.

O Compose deixa de injetar todo o arquivo de segredos nos processos. Web recebe
apenas variáveis enumeradas e duas credenciais de runtime. Migração/DBA ficam no
perfil de operação. Na execução direta de Next, mantenha o `.env` exclusivamente
com credenciais de runtime: não carregue o arquivo de operador nessa sessão.

## Validação local

- Base antes das mudanças: 261 testes do Radar passaram.
- Regressão inicial em PostgreSQL descartável: seis testes falharam e um passou;
  a conexão pública antiga se identificou como postgres e expôs linhas privadas.
- Suíte Radar/PGlite completa testa catálogo, criação/edição/exclusão lógica,
  ingestão, descoberta e alertas com os novos papéis.
- Testes PostgreSQL reais usam LOGINs separados, credenciais sintéticas e cluster
  novo em loopback. Validam visibilidade de rascunho/rejeitado/suspenso/expirado/
  sem publicação; GUC e SET ROLE; escrita, DDL e TRUNCATE negados; editor;
  rollback; ausência de fallback e rejeição de seis flags de privilégio elevadas.
- Teste de Compose renderiza configuração com dados sintéticos e confere que a
  senha de bootstrap não chega a web e que scheduler não recebe banco/e-mail.
  Esse teste não inicia Docker nem contêineres.
- `npm run test:runtime-roles` exige RADAR_POSTGRES_BIN apontando para binários
  locais já instalados. Cria e encerra exclusivamente o cluster que iniciou;
  mantém logs/dados sintéticos em /tmp para revisão. Não usa DATABASE_URL existente.
- A suíte de CI inclui job PostgreSQL 17 descartável separado; CI remoto ainda
  não executado. O PostgreSQL nativo disponível nesta máquina é 16.14.

Resultado final local: **277 testes passaram** (261 da suíte Radar, 15 PostgreSQL
e um Compose). Typegen, typecheck, lint, build standalone e smoke HTTP passaram.
Os 15 casos PostgreSQL aparecem como skipped no npm test comum e foram executados
separadamente com o cluster descartável. Evidência: `docs/evidence/security-sec05/`.
Credenciais reais não são necessárias para build.

Dependências locais foram copiadas por clone APFS de um node_modules existente,
após conferir que o lockfile é idêntico. O build standalone foi refeito com essa
cópia física e o smoke HTTP passou. A inspeção encontrou zero symlinks externos no
standalone. Não houve instalação nova com npm ci nem build de imagem limpa.
CI remoto/PostgreSQL 17 e verificação do corte na VPS continuam gates separados.

## Corte futuro — somente após autorização específica

Não executar este roteiro como parte da validação local.

1. Confirmar SHA aprovado, checkout remoto limpo, versões e inventário completo de
   papéis/membership/owners/grants/policies/12 tabelas/sem sequences relevantes.
   Confirmar que o cluster é exclusivo do Radar e que não houve nova migração.
2. Fazer backup com checksum e testar restauração em destino isolado. Preservar
   volume, configurações anteriores e estado da aplicação. Sem backup restaurável,
   não executar a migração nem trocar credenciais.
3. Preparar senhas independentes e URLs de leitor/editor em arquivo de operador
   com modo 0600. Nenhuma senha deve ir a Git, argumentos, logs ou histórico.
   A URL elevada fica somente no perfil migrate/arquivo de operador.
4. Pausar apenas o scheduler Radar durante a janela aprovada; verificar sessões
   ativas/locks. Aplicar a migração 0038 com a credencial de migração. Lock timeout
   de 5 s e statement timeout de 60 s fazem a transação falhar sem esperar
   indefinidamente. Não reexecutar manualmente migrações históricas.
5. Provisionar senhas de radar_reader/radar_editor por canal interativo protegido
   (por exemplo, comando `\password` do psql), sem imprimí-las. Não fornecer esses
   roles membership do owner/migrador/editor entre si. Não reutilizar a senha DBA.
6. Conferir com os LOGINs reais os mesmos testes negativos e positivos da suíte,
   sem alterar dados reais como teste. Usar queries de metadados/contagens
   aprovadas e transações revertidas apenas quando explicitamente autorizado.
7. Renderizar `docker compose --env-file ... config -q`, sem imprimir config completa
   com segredos. Subir apenas imagens aprovadas de web/scheduler com a nova
   allowlist. Confirmar que o web não recebe DATABASE_URL, DATABASE_MIGRATION_URL,
   RADAR_DB_PASSWORD e que scheduler recebe somente cron/origem/intervalo.
8. Validar catálogo privado/público, uma operação editorial autorizada, ciclo de
   scheduler/alertas sem envio de teste externo e saúde. Não usar /api/health
   isoladamente como comprovação de roles: a rota de saúde é estática.
9. Confirmar sessão atual como radar_reader/radar_editor, flags false e ownership
   separado. Retirar/restringir a credencial antiga dos ambientes de runtime;
   retirar LOGIN da conta antiga exige inventariar seu uso pelo migrador/backup e
   autorização própria. Registrar evidência sanitizada e só então fechar SEC-05
   como corrigido em produção.

## Rollback

Falha na migração: rollback transacional, sem continuar para o deploy. Senhas de
roles existentes são preservadas; nenhuma tabela é apagada. Corrigir a causa de
lock/privilégio/configuração antes de tentar novamente.

Falha após o corte: a decisão de rollback também é do operador autorizado. Manter
as tabelas/roles e dados novos; pausar scheduler e usar a imagem/Compose/arquivo de
operador anteriores inventariados. O legado usa a credencial elevada e reintroduz
SEC-05, portanto rollback não é sucesso de segurança. Não improvisar DROP ROLE,
DROP TABLE, restauração sobre dados novos ou concessão ampla ao runtime. Se a
versão nova ainda estiver ativa, não fornecer DATABASE_URL como fallback: ela é
intencionalmente recusada para leitura/escrita do runtime.

## Integração da release de segurança

A migração foi renumerada para `0038_runtime_database_roles.sql`: a main já contém `0037_audited_community_editions.sql`. O SQL de privilégios foi preservado. As evidências detalhadas referenciadas neste relatório permanecem no checkout local da auditoria e não fazem parte da branch pública de release.
