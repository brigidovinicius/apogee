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
- Build local final aprovado.
- Galerias e formulário já conferidos no navegador em desktop e celular. A confirmação local foi simulada; não foi tratada como persistência real.
- CI da PR #81 inclui teste real da migração e do cadastro em PostgreSQL descartável, após a suíte de billing. Revisão final aprovada no CI.

## Backup e restauração

Backup protegido: /opt/apogee-backups/loja-drops-20261020/apogee_membros.dump. SHA-256 conferido e pg_restore executado com sucesso no banco isolado apogee_loja_restore_20261020. As contagens das 19 tabelas, incluindo o histórico Drizzle, conferiram entre origem e restauração. Nenhum conteúdo de registro foi exibido.

Na restauração, os seis hashes anteriores foram conferidos; o SQL exato da migração foi aplicado com SET ROLE apogee_app; os sete hashes finais conferiram. Inserção, duplicata sem sobrescrita e restrição de telefone passaram em transação revertida. A tabela de teste ficou vazia.

## Publicação

PR: https://github.com/brigidovinicius/apogee/pull/81

Publicada em 20/10/2026 na VPS existente.

- PR #81 integrada; head validado 13f55dfe8c096f791e9d3816e879dc14ac2bd541.
- CI completo aprovado: https://github.com/brigidovinicius/apogee/actions/runs/39515923117.
- SHA publicado: 1ab3b065211794923ec25548c543c7ef61abd141. A árvore do merge é idêntica à do head validado.
- Rollback preservado: e2d0899471c19e391d7d915b00e352d17a07a3a2; imagem sha256:5d0cdb003d94231c4dbe4dc0ae030bda32a4eef146c431439ce2ff232ab0d83c.
- Migração retornou changed=true; repetição de conferência retornou changed=false. Histórico final com sete migrações.
- Somente web recriado, healthy e zero reinícios. Os 12 containers vizinhos mantiveram IDs e imagens.
- HTTP 200 em /loja, nas sete imagens, /makeitfly e /membros/entrar.
- Navegador público: três produtos carregados; camiseta com frente, costas e ampliação; Escape fecha e devolve foco; 1440 px e 390 px sem overflow horizontal. Consentimento mobile com 14 px.
- Cadastro técnico real pela página pública: sucesso, limpeza dos campos e conferência no PostgreSQL de nome, telefone, e-mail e texto/versão/data do consentimento. Removido somente o registro sintético criado pela verificação (DELETE 1), confirmado como ausente depois. Nenhum contato de visitante foi alterado e nenhuma mensagem foi enviada.
- Teste remoto isolado adicional: 18 testes de billing e um de drops aprovados com PostgreSQL novo, dados sintéticos e sem rede externa. Containers próprios encerrados; snapshot de código preservado em /tmp/apogee-loja-validation-a01c134.

A primeira execução aplicou a migração, mas o run interativo do Compose consumiu o restante do script SSH. O web ainda estava na revisão anterior. A continuação usou -T --interactive=false, reconferiu a migração idempotente e completou a troca com rollback e comparação dos vizinhos. Para execuções por stdin, usar sempre esses parâmetros no comando de migração.

Runbook remoto: /opt/apogee-site/releases/20261020-loja-drops.md. Logs locais sanitizados: /tmp/apogee-store-deploy-20261020.log e /tmp/apogee-store-deploy-resume-20261020.log.

Nenhum deploy de Radar ou ALU, alteração de DNS, proxy, segredo, rede, certificado ou volume.
