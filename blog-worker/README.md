# Blog editorial Apogee

O worker monitora RSS aprovados e importa artigos e capas como rascunhos privados. O painel `/admin/posts/pipeline` reúne fontes, pautas, comandos, evidências, consumo e revisão SEO/GEO. Publicar ou agendar usa o editor existente e exige administrador.

A geração usa o cliente oficial Antigravity com Google OAuth e assinatura elegível. `useG1Credits=false`, sem Gemini API, OpenAI API ou Codex como runtime. Código de API legado existe somente para testes e auditoria; o CLI operacional recusa esse provedor. A distribuição mantém fontes e geração desligadas; a conta real fica em configuração privada do ambiente.

Limites: um artigo/dia, cinco/semana, três chamadas/dia, quinze/semana; concorrência um; duas tentativas textuais no máximo e uma capa. Cada execução tem uma invocação do modelo, até 45 segundos para texto e 150 para imagem. Reserva conservadora de 60 mil tokens por chamada, 180 mil/dia e 900 mil/semana. Bloqueio prévio se alguma cota Google estiver abaixo de 20%. Não são garantias de limite rígido da cota do provedor.

RSS e deduplicação não usam IA. Texto e metadados saem juntos; o cliente recebe somente fatos necessários, sem campos contábeis repetidos. Capas são lidas do artefato nativo da mesma conversa, validadas e normalizadas para WebP. Timeout, uso desconhecido e excesso de reserva bloqueiam o fluxo sem repetição automática nem fallback pago.

## VPS

O perfil Compose `blog` contém worker e proxy de banco exclusivo, com TLS, sem portas públicas e sem reconfigurar o PgBouncer compartilhado. O worker executa como usuário não privilegiado. D-Bus e GNOME Keyring ficam dentro do contêiner; o diretório pessoal persiste em `/opt/apogee-blog/home`, com chaveiro criptografado. A senha de desbloqueio fica em arquivo privado montado apenas para a inicialização. Não copiar tokens do Mac nem colocar credenciais no Git.

Procedimento: backup e restauração isolada; migrações sequenciais `001` a `003`; papel de worker sem escrita direta nas tabelas públicas; grants mínimos para o papel web; cliente Linux oficial com checksum verificado; login oficial no contêiner; conferência de conta/plano/cota e atestado com validade operacional de até 24 horas; habilitação somente de fontes homologadas e da política autorizada. Verificação expirada bloqueia geração e exige revalidação, enquanto a captação pode continuar.

Configuração privada deve preencher `google_account_email`. O atestado precisa coincidir com essa conta. `attest-subscription`, `migrate`, `reconcile` e `resume` exigem `--execute` e credencial operacional separada. A credencial de migração não é montada no worker contínuo.

Revisão obrigatória: fatos, limitações, originalidade, fontes, legenda de IA e indexação. Rascunhos nascem com `seo_noindex=true`. O worker não publica.

## Validação

```sh
npm test
BLOG_TEST_PG_BIN=/caminho/bin/postgresql npm run test:integration
node src/cli.mjs check
```

Integração usa PostgreSQL descartável e DDL real do CMS, sem chamadas de IA. No Mac, respeitar a fila global do AGENTS. Registros privados dos pilotos permanecem fora da release pública.
