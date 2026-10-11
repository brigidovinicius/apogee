# Correção da galeria — PostgreSQL direto na VPS

Data: 11/10/2026. O usuário autorizou corrigir a galeria e informou que a Apogee usa PostgreSQL direto na VPS. Não foi aceita nem executada a proposta anterior de copiar configuração Supabase.

## Diagnóstico confirmado

Após o deploy de SEO `294b3cb863264878a1bdc76fe79fe9d455fd2089`, `/api/gallery` ainda respondia 503. O código legado exigia Supabase Storage e variáveis ausentes/inválidas; a configuração já existia antes desse deploy. A VPS possui a conexão `apogee_app` → PgBouncer privado → banco `apogee_membros`, com certificado TLS validado e segredo Better Auth já configurado.

A consulta de catálogo encontrou somente as tabelas de autenticação/fórum e `drizzle.__drizzle_migrations`. Não havia tabela de fotos PostgreSQL. O histórico tem exatamente a migração inicial, com SHA-256 `128f8b37bc9bc541925fa68e8799f929207311e6cebd06156894365e2706c619`, igual ao arquivo versionado. O papel da aplicação já possui CREATE no schema público e acesso ao histórico; nenhuma nova concessão é necessária.

## Mudança revisável

- `gallery_photo` armazena bytes WebP (máximo 3 MB), dimensões, créditos públicos e consentimento. Fotos e créditos são gravados por um único INSERT parametrizado, sem arquivos órfãos.
- A conexão TLS é reutilizada; a galeria não lê nem chama Supabase e não exige novos segredos. A limitação de envio usa o segredo Better Auth existente, com domínio HMAC próprio.
- Leituras listam somente os campos públicos e nunca apagam dados. A imagem aposentada continua excluída do mural; nenhum processo de leitura a remove do banco.
- `/galeria/fotos/[photo]` entrega somente bytes WebP processados, com `nosniff`. Imagens públicas podem ser rastreadas; arquivos ausentes/inválidos retornam 404/noindex. Administração continua exigindo autorização no servidor e respostas privadas.
- A migração gerada `0001_gallery_postgres.sql` somente cria a nova tabela, com restrições de tamanho, crédito anônimo, ID e dimensões. Não altera tabelas ou registros existentes.
- O comando estreito `gallery:migrate` trava o histórico em uma transação, verifica o hash inicial antes de criar a tabela e registra o hash novo no histórico Drizzle. Uma divergência interrompe a operação; reaplicação idêntica é idempotente.

## Validação e publicação

- Local: 228 testes passaram; TypeScript passou; lint sem erros, com o aviso anterior da imagem administrativa.
- CI inclui PostgreSQL 17 descartável, migração inicial/aditiva, reaplicação, bytes binários, anonimato, paginação, exclusão estreita e falha fechada por histórico divergente. Somente dados sintéticos nesse ambiente; ele nunca usa `DATABASE_URL` real.
- Deploy autorizado: conferir checkout/saúde atuais, construir somente a imagem web, criar um `pg_dump` protegido em `/opt/apogee-membros/backups`, conferir que o arquivo pode ser lido por `pg_restore --list`, executar a migração empacotada e recriar somente web. Segredos, DNS, Caddy e redes permanecem sob configuração existente.
- Rollback de código: imagem SEO anterior `294b3cb`; a tabela aditiva deve permanecer para preservar novos envios. Não executar DROP ou restauração ampla do banco para rollback de código.
- A galeria PostgreSQL começa sem fotos, porque nenhuma tabela anterior foi encontrada. Não foram publicadas imagens de teste nem importados dados de armazenamento legado; não há evidência para afirmar que fotos antigas foram recuperadas.

Resultado da publicação e validação pública será registrado após conclusão dos gates.
