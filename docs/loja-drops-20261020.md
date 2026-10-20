# Loja Apogee: produtos e novidades dos drops

## Resultado solicitado

Vitrine sem compra ou finalização com três produtos e sete fotos originais:

- Moletom Building the Future azul-marinho: frente e detalhe.
- Boné Made to Create bege: frente, lateral e costas.
- Camiseta Apogee azul-marinho: frente e costas.

Nome, telefone e e-mail podem ser cadastrados para receber novidades dos próximos drops, com consentimento obrigatório. Nenhum preço, material, estoque, tamanho ou data foi inventado. Não há envio automático de mensagens, criação de conta, pedido ou reserva.

As galerias usam miniaturas e ampliação em diálogo nativo. A grade usa três colunas no desktop, duas em telas intermediárias e uma no celular. Tipografia e tokens existentes da Apogee, com ícones vetoriais e foco visível. A atualização mantém as melhorias da main e não altera Make It Fly em relação à main integrada.

## Cadastro e migração

POST /api/loja/novidades valida os três campos, exige consentimento e origem permitida, limita o corpo a 4 KiB e aplica honeypot e limites persistentes por IP, e-mail e global. As chaves pessoais dos limites usam HMAC com o segredo existente.

A tabela privada store_drop_signup guarda nome, telefone e e-mail normalizados e texto, versão e data do consentimento. E-mail é único; duplicatas não sobrescrevem os dados existentes e a resposta não revela se o contato já existia. Falhas ao salvar não produzem confirmação e preservam os campos para repetir.

A migração 0006_store_drop_signups é aditiva. npm run store:drops:migrate verifica os hashes e a ordem das seis migrações anteriores, recusa tabela/histórico divergentes e transaciona somente a criação da tabela e o registro da migração. O script está empacotado no Dockerfile. O migrador antigo do billing limita-se às suas seis entradas anteriores.

Adicionar produtos: lib/store/products.ts e public/images/loja.

## Autorização e validação

Em 20/10/2026, após o aviso de migração e publicação pendentes, o usuário respondeu: "Ok, execute inclua também esse produto". O escopo de execução é ativar o cadastro e publicar esta vitrine na VPS existente, com backup e teste de restauração, preservando segredos e os demais serviços.

- Sete fotos copiadas com SHA-256 idêntico aos originais recebidos.
- Typegen, typecheck e lint dos arquivos de produção alterados aprovados.
- Suíte completa local: 435 testes aprovados com dependências isoladas deste worktree. O inventário de rotas foi atualizado para a nova API.
- Build local aprovado na revisão anterior à correção do inventário; a rodada final está sendo concluída.
- Galerias e formulário já conferidos no navegador em desktop e celular. A confirmação local foi simulada; não foi tratada como persistência real.
- CI da PR #81 inclui teste real da migração e do cadastro em PostgreSQL descartável, após a suíte de billing. Aguarda a revisão final.

## Backup e restauração

Backup protegido: /opt/apogee-backups/loja-drops-20261020/apogee_membros.dump. SHA-256 conferido e pg_restore executado com sucesso no banco isolado apogee_loja_restore_20261020. As contagens das 19 tabelas, incluindo o histórico Drizzle, conferiram entre origem e restauração. Nenhum conteúdo de registro foi exibido.

Na restauração, os seis hashes anteriores foram conferidos; o SQL exato da migração foi aplicado com SET ROLE apogee_app; os sete hashes finais conferiram. Inserção, duplicata sem sobrescrita e restrição de telefone passaram em transação revertida. A tabela de teste ficou vazia.

## Publicação

PR: https://github.com/brigidovinicius/apogee/pull/81

Migração e deploy de produção ainda não executados. A revisão exata, CI, saúde, teste real e preservação dos serviços serão registrados após cada etapa.
