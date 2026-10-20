# Loja Apogee: produtos e novidades dos drops

## Escopo

Pedido de 20/10/2026: substituir o catálogo conceitual por dois produtos reais, usando as cinco fotos enviadas; sem compra ou finalização. Recolher nome, telefone e e-mail para novidades dos próximos drops. Outros produtos serão fornecidos depois.

- Moletom Building the Future azul-marinho: frente e detalhe.
- Boné Made to Create bege: frente, lateral e costas.
- Fotos originais copiadas, sem alterações. Nomes descritivos, sem inferir preço, material, estoque, data ou tamanhos.
- Galerias com miniaturas, ampliação em diálogo nativo e navegação por teclado.
- Cabeçalho e tokens existentes da Apogee; marinho #07182d, azul #b9d3ee, branco #fff, texto #173653, linha #dbe2e9; Instrument Serif nos títulos e Inter no corpo. Fotos ocupam duas colunas no desktop e uma no celular.
- Página /makeitfly e seus descendentes preservados.

## Cadastro

POST /api/loja/novidades valida os três campos e consentimento obrigatório. Usa leitor de corpo existente (limite 4 KiB), allowlist de origem, honeypot e limites persistentes por IP, e-mail e global. Chaves pessoais dos limites usam HMAC com o segredo existente, sem expor contatos.

Tabela privada store_drop_signup com nome, telefone normalizado, e-mail normalizado/único e texto, versão e data do consentimento. Duplicatas não sobrescrevem dados existentes; a resposta não revela se o contato já existia. Falha de banco retorna erro e o formulário preserva os campos para repetir. Não envia e-mail ou mensagem, não cria conta, pedido ou reserva.

Adicionar produtos: editar lib/store/products.ts e incluir suas imagens em public/images/loja.

## Banco e publicação

A migração 0006_store_drop_signups é aditiva. O comando npm run store:drops:migrate verifica hashes e ordem das seis migrações anteriores, recusa tabela/histórico divergente e transaciona somente a criação da tabela e o registro da migração. Não executa migrações anteriores.

O migrador antigo do billing lê somente suas seis entradas para continuar utilizável antes da nova migração, mesmo com a extensão do journal.

Nenhum banco real foi acessado ou migrado. Não houve push, merge, publicação, deploy, envio externo ou ativação de campanha. Para produção ainda são necessários autorização de banco, backup/restauração verificados, migração, autorização de publicação e teste real de persistência.

## Validação

- next typegen --webpack: aprovado.
- tsc --noEmit --incremental false: aprovado.
- ESLint nos arquivos alterados: aprovado, sem avisos na rodada final.
- 29 testes focados: aprovados (cadastro, erros, consentimento, limites, duplicata, migração simulada, vitrine e isolamento do Make It Fly).
- next build --webpack: aprovado, rota /loja estática e /api/loja/novidades dinâmica.
- Hash SHA-256 das cinco fotos de destino: idênticos aos arquivos recebidos.
- Browser interno: desktop 1440x1000 e celular 390x844, sem overflow horizontal; fotos carregadas, troca de miniatura, ampliação e Escape; consentimento exigido pelo navegador.
- Preview de produção local recusou a origem localhost (403), mostrou erro e preservou os dados fictícios. Resposta de sucesso simulada exclusivamente para o endpoint local via CDP confirmou mensagem e limpeza dos campos. Interceptação removida, página recarregada e aba temporária fechada. Nenhum contato foi gravado.
- Testes HTTP e do migrador usam dependências de banco simuladas e não comprovam persistência nem aplicação do SQL em PostgreSQL real.
- git diff --check: aprovado.

Worktree: loja-drops-20261020. Branch: feat/loja-drops-20261020. O servidor de preview temporário foi encerrado após a revisão para liberar a fila global.

## Ampliação e autorização de execução

O usuário respondeu "Ok, execute inclua também esse produto" após o aviso de migração e publicação pendentes. Incluída Camiseta Apogee azul-marinho com frente e costas; catálogo agora com três produtos e sete fotos. Execução da ativação segue com preflight, validação final, backup e teste de restauração, migração e publicação restritas à Apogee. Evidências finais serão acrescentadas após cada etapa.
