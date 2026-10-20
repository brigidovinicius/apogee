# SEC-06 — bootstrap administrativo com identidade verificada

Status: implementação e validação locais, base `316ac36`, branch
`fix/members-admin-bootstrap-sec06`. Sem push, CI remoto, deploy ou acesso à VPS.
Nenhuma conta real foi consultada, promovida, desbloqueada ou revogada. O achado
continua pendente em produção até adoção autorizada dos comandos corrigidos.

## Problema e correção

O bootstrap administrativo identificava o alvo apenas por e-mail. Como o cadastro
público não exige verificação para criar uma conta de membro, o operador podia
promover uma conta previamente registrada por outra pessoa. O seed também promovia
implicitamente pelo endereço, e o bootstrap de gestores de convites administrativos
não exigia e-mail verificado. A exploração dependia de uma operação administrativa.

Os comandos agora exigem simultaneamente:

1. ID explícito e e-mail correspondente a exatamente uma conta;
2. `email_verified === true` e `blocked === false`, lidos do banco;
3. papel atual válido: member/admin para grant-admin, somente admin para manager.

As verificações antecedem também a resposta idempotente: conta já privilegiada
não recebe confirmação de sucesso se estiver bloqueada ou sem verificação.
Dados ausentes não são tratados como verificação positiva. E-mails são normalizados
em minúsculas e comparados sem distinção de caixa; duplicatas nesse critério causam
recusa. IDs não são normalizados: devem corresponder exatamente ao alvo conferido.
Parâmetros continuam vinculados pelo driver, sem interpolação de entrada em SQL.

Leitura e alteração ficam na mesma transação, com bloqueio da tabela de usuários
e da linha. O bloqueio da tabela também impede que surja uma duplicata durante a
concessão. É uma operação administrativa curta, que pode atrasar outras escritas
enquanto estiver ativa. `lock_timeout=5s` e `statement_timeout=15s` limitam espera
e execução; falhas abortam a transação. Não existe retry automático.
Referência: [bloqueios do PostgreSQL](https://www.postgresql.org/docs/17/explicit-locking.html#LOCKING-ROWS).

O UPDATE repete as condições de papel/verificação/bloqueio e exige uma única linha
alterada. Grant-admin muda apenas role; manager muda apenas a capacidade e seu
timestamp. Não criam conta, não trocam senha, não marcam e-mail como verificado,
não desbloqueiam e não concedem capacidade adicional junto com o papel admin.

O seed cria somente categorias e recusa `MEMBERS_ADMIN_EMAIL` ou
`MEMBERS_ADMIN_USER_ID` antes de conectar ao banco. Seu uso normal continua
idempotente. Não houve migração ou alteração de versões/lockfiles.

## Arquivos e trechos

| Arquivo em make-it-fly-current | Trecho funcional |
|---|---|
| `scripts/members-grant-admin.mjs` | bootstrapTarget valida os dois identificadores; verifiedBootstrapAccount concentra identidade, flags e locks; grantAdmin controla a transição; main exige as duas variáveis |
| `scripts/members-grant-invitation-manager.mjs` | Reutiliza a verificação comum; exige admin; confere o UPDATE; CLI exige ID/e-mail |
| `scripts/members-seed.mjs` | seedCategories só grava categorias; entrada CLI rejeita promoção implícita e sanitiza erro |
| `scripts/test-admin-bootstrap.mjs` | Runner de cluster novo em loopback, certificado sintético e encerramento exclusivo dos processos que iniciou |
| `tests/members-admin-bootstrap.integration.mjs` | Testa funções e CLIs reais com PostgreSQL, snapshots de linhas, concorrência e seed |
| `tests/members-admin-access.test.mjs` | Fixtures completas com flags e ID explícito; mantém os testes de autorização de páginas/API |
| `tests/members-invitations.integration.mjs` | Atualiza o ID do bootstrap e a verificação da fixture do emissor; preserva destinatários não verificados nos casos negativos |
| `infra/membros/README.md` | Novo contrato operacional, sem autorizar execução em produção |

Na raiz: `.github/workflows/security-hardening.yml` prepara a integração SEC-06
no job PostgreSQL existente, sequencialmente; `docs/member-invitations-validation.md`
atualiza o exemplo de bootstrap de capacidade. O Dockerfile já copia os dois
comandos de concessão e o driver postgres; não foi necessário novo módulo de runtime.

## Validação

| Execução | Resultado |
|---|---|
| Suíte antes da alteração | 314 testes passaram |
| Regressão inicial em PG real | 13 de 18 cenários falharam; TAP: 14 falhas incluindo o teste pai, cinco passes |
| Suíte final completa | 314 testes passaram |
| Bootstrap/seed no PG real | 20 cenários passaram; TAP: 21 passes incluindo o pai |
| Convites com Better Auth/PG reais | 15 cenários passaram; TAP: 16 passes incluindo o pai |
| Typecheck | Passou |
| Lint | Zero erros; um aviso preexistente de img em gallery-admin.tsx:81, sem alteração nesse arquivo |
| Workflow YAML e git diff --check | Passaram |

As concessões recusam conta não verificada, bloqueada, membro tentando obter a
capacidade de manager, ID ausente/incorreto, e-mail ausente do banco ou duplicado.
Há testes de injeção como entrada de e-mail, sem alteração das linhas. Os casos
positivos conferem exatamente os campos alterados e a idempotência. As entradas
CLI conferem código de saída e ausência de e-mail/credencial na saída.

Duas transações concorrentes revogam a verificação enquanto a concessão aguarda
um lock. Depois do commit concorrente, o comando reavalia a linha e recusa o
privilégio; o teste confere o estado final completo. O seed com cada variável
antiga é recusado sem alterar categorias/conta; o seed normal é executado duas vezes.

PostgreSQL local: 16.14. O runner usa cluster novo em loopback e TLS com certificado
sintético validado por CA explícita; não instala certificados no sistema. A suíte
de convites usa outro cluster descartável, com transporte externo de e-mail
interceptado pelo teste. Nenhum e-mail foi enviado a um serviço real.

O runner não herda DATABASE_URL. O bootstrap alternativo só é permitido com CI=true
e URL sintética exata; cria um banco separado members_sec06_test. No serviço de CI
sem TLS, o seed positivo usa sua função exportada com driver real. A entrada CLI
normal com TLS é exercida localmente. CI remoto/PostgreSQL 17 ainda não executados.

Não houve novo build Next, smoke do site ou build Docker: nenhuma rota, tela,
autenticação HTTP, dependência ou configuração do site mudou. Os scripts afetados
foram executados diretamente, inclusive pelos entrypoints CLI. O build de imagem
limpa e a comprovação do código usado pelo operador continuam pendentes.

Comandos: npm test; npm run typecheck; npm run lint; com MEMBERS_POSTGRES_BIN
apontando para binários já instalados, npm run test:admin-bootstrap. Todos pela
fila global e sem tarefas pesadas em paralelo. Logs resumidos e manifesto estão
em `docs/evidence/security-sec06/`; dados temporários são somente sintéticos.

## Operação futura, somente após autorização específica

Preferir o fluxo existente de convites e comprovação da caixa. Quando bootstrap
for necessário, o operador autorizado deve conferir o ID por fonte autenticada,
a correspondência do e-mail, a identidade do destinatário e a verificação persistida.
Não marcar email_verified manualmente para fazer o comando passar. Usar
MEMBERS_ADMIN_EMAIL + MEMBERS_ADMIN_USER_ID para conceder admin; usar
MEMBERS_INVITATION_MANAGER_EMAIL + MEMBERS_INVITATION_MANAGER_USER_ID para a
capacidade adicional de um admin já existente. Essas variáveis são pontuais.

Conferir SHA da imagem/script e concluir CI antes da execução autorizada. Não usar
comandos antigos para contornar uma recusa. Não criar conta, redefinir credencial,
repetir tentativa ou conceder outro privilégio automaticamente em caso de erro.

Não foi realizada revisão das concessões históricas. Uma revisão posterior,
somente leitura e autorizada, deve verificar metadados/auditoria antes de decidir
qualquer revogação; não se presume comprometimento. A correção não desfaz privilégios
anteriores. Reverter para os scripts antigos reabre SEC-06 e não constitui correção.
