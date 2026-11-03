# Recuperação de senha — Apogee

## Escopo e plano

Adicionar “Esqueci minha senha” ao login, solicitar o e-mail cadastrado e enviar um link de uso único com validade de 30 minutos. A página de redefinição pede a nova senha duas vezes (8–128 caracteres). Após a troca, encerrar sessões anteriores e voltar ao login, preservando somente destinos internos permitidos.

Reutilizar Better Auth 1.7.14, `sendMemberMail`, a tabela `verification`, os limites persistentes e os componentes de formulário existentes. Nenhuma dependência ou migração nova. Mensagem idêntica para e-mail existente e inexistente; envio após a resposta para não expor a existência da conta pela latência do provedor. Falhas de envio geram apenas log genérico, sem e-mail, token ou senha.

Arquivos: configuração `lib/members/auth.ts`; política comum `auth-abuse.ts`; contratos em `password-recovery.ts`; actions e duas páginas em `app/membros`; formulários em `components/members`; link no login; caminhos públicos em `proxy.ts`; cabeçalhos e logs em `next.config.ts`; testes e CI.

Validar solicitação, e-mail inválido, confirmação divergente, token inválido/expirado/reutilizado, concorrência, rollback da troca, revogação das sessões, limites por IP/e-mail, callback externo e ausência de IP confiável. Testes de integração usam somente PostgreSQL descartável e envio simulado, sem acessar banco ou e-mail reais.

Referências: [Better Auth](https://better-auth.com/docs/authentication/email-password), [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html) e código/docs instalados de Better Auth/Next.js. Publicação depende de autorização explícita após revisão, conforme AGENTS.md.

## Validação

Base: `origin/main` em `f8d0c50`; branch `feat/password-recovery-20261103`.

- `npm test`: **632/632 aprovados**. A lista de rotas permitidas foi atualizada para as duas páginas novas.
- `node --test tests/password-recovery.integration.mjs`: **8/8 aprovados** com Better Auth real e PostgreSQL 17 descartável. Inclui uso simultâneo do mesmo token, expiração, rollback de falha ao salvar, encerramento das sessões, conta bloqueada e limites persistentes.
- `npm run typegen` e `npm run typecheck`: aprovados.
- `npm run lint`: zero erros; permanece um aviso anterior de `<img>` em `components/gallery/gallery-admin.tsx:87`.
- `APOGEE_LOCAL_PREVIEW=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build`: aprovado; duas páginas novas presentes no build. Perfil local limita compilação a um worker.
- Navegador contra o servidor compilado: formulário rejeitou e-mail inválido; solicitação exibiu confirmação; envio simulado ocorreu com o `after` real do Next.js; confirmação divergente foi rejeitada; troca correta voltou ao login com o destino preservado; senha antiga recusada e nova aceita; membro continuou sem acesso administrativo; reutilização do link exibiu orientação para solicitar outro.
- HTTP compilado: callback e página de redefinição com `Referrer-Policy: no-referrer`; página com `Cache-Control: no-store`. Telas verificadas em 1365 px e 390 px, sem transbordamento horizontal no celular e sem erros de console.
- Revisão independente somente leitura: nenhuma falha bloqueante encontrada. `git diff --check`: aprovado.

Com transações habilitadas, o hook de criação de sessão consulta o usuário pelo adapter do contexto para enxergar o cadastro ainda não confirmado na transação. A integração confirma que cadastro e login continuam funcionando e contas bloqueadas continuam sem criar sessão.

Todos os comandos npm/node de projeto passaram pela fila global, sem tarefas pesadas simultâneas. Servidor e PostgreSQL temporários encerrados após os testes. Evidências locais (não versionadas) em `.local/password-recovery-check/`, incluindo capturas desktop/celular e harness compilado com interceptação do provedor.

## Estado da entrega

Implementação e validação locais concluídas. Sem push, PR, merge ou publicação; sem alteração de contas/banco de produção. Nenhuma migração necessária. Após autorização, publicar o SHA aprovado e verificar comportamento/cabeçalhos públicos sem redefinir senhas de terceiros. O ajuste de Caddy abaixo também precisará integrar a publicação autorizada; somente reconstruir a aplicação deixaria o cabeçalho sobrescrito no proxy.

## Teste adicional solicitado pelo usuário

- Executado Caddy **2.10.2** real em loopback, com o bloco do Caddyfile de produção, Next.js compilado e PostgreSQL descartável. O binário temporário veio do release oficial e teve checksum conferido.
- O teste encontrou o proxy sobrescrevendo `no-referrer` com o valor geral. O Caddyfile agora usa `?Referrer-Policy`, preservando a política explícita da aplicação e mantendo o valor padrão nas demais páginas. Referência: [semântica de cabeçalhos padrão no Caddy](https://caddyserver.com/docs/caddyfile/directives/header).
- `CADDY_BIN=... MEMBERS_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin MEMBERS_AUTH_TEST_USE_NEXT_START=1 npm run test:auth-proxy`: **11/11 aprovados**. Inclui cabeçalhos das duas páginas e do callback, cadastro, login por e-mail/usuário, sessão, IP forjado, IPv6 e limites persistentes. A opção local usa `next start` sobre o build já validado; CI continua usando o servidor standalone.
- `npm run lint -- scripts/test-auth-proxy.mjs`: aprovado.
- Um e-mail real foi enviado ao endereço expressamente autorizado, com o conteúdo produzido pelo formulário e pelo `after` do candidato. O provedor aceitou com HTTP 200 e ID, e o usuário confirmou recebimento na caixa de entrada. A credencial permaneceu no container de produção; nenhuma cópia local foi feita. A consulta posterior do status de entrega não estava autorizada pelo provedor (HTTP 401), portanto a confirmação de recebimento veio do usuário.
- O link enviado apontava para o ambiente local. O teste automático no Mac abriu esse mesmo link, redefiniu a senha da conta descartável e entrou com a senha nova. Depois, o ambiente foi encerrado. O link não era utilizável no celular, e o usuário relatou essa limitação. O usuário optou explicitamente por manter somente testes locais, sem endereço público temporário.
- Servidores e bancos temporários foram encerrados. Nenhuma senha de conta real foi redefinida. Evidências adicionais em `.local/password-recovery-check/proxy-regression.log` e arquivos locais do envio autorizado, sem credenciais.
