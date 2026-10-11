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
- Rollback de código: imagem anterior `e6c1822`, que preserva a administração integrada; a tabela aditiva deve permanecer para preservar novos envios. Não executar DROP ou restauração ampla do banco para rollback de código.
- A galeria PostgreSQL começa sem fotos, porque nenhuma tabela anterior foi encontrada. Não foram publicadas imagens de teste nem importados dados de armazenamento legado; não há evidência para afirmar que fotos antigas foram recuperadas.

## Resultado confirmado

- PR: [21](https://github.com/brigidovinicius/apogee/pull/21). CI final [38167703754](https://github.com/brigidovinicius/apogee/actions/runs/38167703754): quatro jobs aprovados; 228 testes do site, testes dos outros projetos, typegen/typecheck/lint/auditoria/build/smoke e integração PostgreSQL 17.
- A revisão `ff41bc7f4fd374edb1a6029084ec8115f5104280` incorpora a administração da PR 20. Foi integrada e publicada como `7741a7199a0780f8850a1cbeb8c3b4b4f638e4c2`; os aplicativos coincidem com a revisão testada.
- Backup: `/opt/apogee-membros/backups/apogee_membros-before-gallery-20261011T193000Z.dump`, 27.360 bytes, modo 600; `pg_restore --list` confirmou arquivo legível. Não foi executado teste de restauração desse backup.
- Migração retornou `changed: true`, `0001_gallery_postgres`; hash do SQL `a37ed68bd1290df61e9bd9bbb465a58ce77758b8f6cb61e653d77eceacb7d5ae`. Histórico agora contém duas migrações; tabela de galeria pertence a `apogee_app`, com zero fotos. Os oito snapshots de tabelas anteriores permaneceram idênticos.
- Imagem ativa: `sha256:d45e4e0d9f85c4f7429d4882d0884950ff6e02eb8b2adb28d28aa228713f6066`; revisão 7741a71, healthy, zero reinícios. Checkout remoto limpo. Imagem de rollback e6c1822 `sha256:d88b86f4fd481b514b93ff3fa4b4c910099fb0d109d670aec768cc178268e2d7` preservada.
- Somente o container web mudou. Outros 11 containers mantiveram ID, imagem e instante de início. Configuração protegida manteve hash e modo 600; seu último ajuste às 16:21 foi feito pela tarefa de ponte administrativa antes deste deploy. Esta correção não transferiu nem modificou segredos.
- Verificadores HTTP estritos passaram no domínio: cinco páginas públicas, galeria/API 200 com coleção vazia, oito superfícies excluídas, 12 rotas protegidas, sete famílias de API, 404/paginação inválida, 40 recursos internos, sitemap/robots e domínio canônico. Galeria visualmente conferida no Safari: estado vazio e formulário disponíveis, sem erro de carregamento.
- Não foi publicado upload de teste em produção. Upload e bytes WebP foram exercitados com fixtures locais e banco descartável da CI; não existe evidência de recuperação/importação de fotos antigas.
