# Convites de membro e administrador — evidências locais

Implementação concluída e validada em desenvolvimento (19–20/10/2026) no checkout `radar-optimization-20261016`, base `e6ed04f`.

## Superfícies e política

- `/admin/convites`: emitir, consultar (100 mais recentes), reenviar e revogar.
- `/membros/convite`: apresentação por GET; somente POST autenticado aceita.
- `/api/members/invitations`: esquema estrito por operação, sessão Better Auth, Origin configurada, limites em PostgreSQL. Não recebe identificador do ator ou flags de verificação na aceitação.
- `/api/members/verification`: envia a verificação nativa Better Auth ao e-mail atual da conta; callback interno permitido. A verificação não concede perfil.
- Administrador ativo pode gerenciar convites de membro. Administrador ativo com `can_manage_admins=true` pode gerenciar convites administrativos. Membro/visitante não pode. A autorização adicional não é herdada pelo administrador convidado e é reavaliada no consumo. Inicialização explícita: `MEMBERS_INVITATION_MANAGER_EMAIL=... node scripts/members-grant-invitation-manager.mjs` no ambiente autorizado; não executado em produção.
- Migração aditiva `drizzle/0004_member_invitations.sql` e snapshot `meta/0004_snapshot.json`. Nenhuma migração remota aplicada.
- Nomes: NFC, espaços normalizados, 1–100 pontos de código, ao menos uma letra, somente letras/marcas Unicode, espaços, hífen, apóstrofos e iniciais com ponto isolado. Rejeita links, domínios, e-mails, HTML, controles e codificações/disfarces representativos. Não decodifica nem remove trechos. Frontend, hooks create/update, fórum, confirmação social e convite usam a regra central. Nomes legados não são limpos automaticamente; React os escapa como texto.
- Google: nome inválido vira o placeholder seguro “Membro” com confirmação obrigatória; todo novo cadastro Google confirma nome/usuário. Vínculo com conta local exige e-mail local já verificado para evitar vincular uma credencial social a cadastro não confirmado.
- Convites: 32 bytes aleatórios; só SHA-256 no banco; 48h padrão configuráveis entre 1 e 168h; tokens substituídos no reenvio; expiração/revogação; bloqueio de convite e usuários em transação; consumo único/idempotente com um evento. Não altera senha, não duplica usuário, não rebaixa admin, não desbloqueia conta. E-mail comparado em minúsculas, como o Better Auth.
- Envio usa Resend conforme padrão do Radar, texto puro, origem confiável, timeout e chave de idempotência. “Aceito pelo provedor” não significa entregue. Falha/resultado incerto fica persistido como `unconfirmed`; reenvio invalida token anterior.
- As tabelas de membros usam conexão privada server-only; não há acesso anônimo de navegador nem chave pública desse PostgreSQL. O Supabase separado de candidaturas não grava os usuários do Better Auth. Nenhuma política de assinatura é alterada; a plataforma ainda lista Assinaturas como indisponível.

## Verificações

Todos os comandos npm/Node de teste, geração e build são executados sequencialmente pelo executor obrigatório `/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command ...`.

- `npm test`: 298 testes passaram, zero falhas (inclui nomes e renderização real do painel com fixture maliciosa escapada).
- `INVITATIONS_TEST_DATABASE_URL=postgres://apogee_test@127.0.0.1:55439/postgres node --test tests/members-invitations.integration.mjs`: Better Auth, ORM e PostgreSQL reais; 16 testes passaram, zero falhas. Transporte Resend interceptado somente pelo harness de teste; isso não prova entrega real.
- `node --test --test-concurrency=1 tests/member-names.test.mjs tests/members-invitations.integration.mjs`: 20 testes passaram na revalidação final de segurança.
- `npm run typecheck`: passou.
- `npm run lint`: zero erros; um aviso preexistente de `<img>` em `components/gallery/gallery-admin.tsx:81`.
- `npm run build`: passou, rotas novas incluídas.
- `npm run db:generate -- --name member_invitations`: migração e snapshot gerados pelo Drizzle, aplicados apenas no cluster descartável.

Nos testes de integração, os casos negativos conferem estados de convites, papéis, nomes, verificação e credenciais persistidos. Incluem adulteração, e-mail não verificado/diferente, bloqueio, perda de autorização do emissor, expiração, revogação, reenvio, concorrência e idempotência. Nenhum serviço remoto é acessado pela suíte automatizada.

## Problemas encontrados e corrigidos

1. Validação anterior do nome só verificava comprimento e não cobria update-user. Agora a política é centralizada nas gravações.
2. Serialização de Date no SQL direto e timestamps retornados como string pelo cliente compartilhado com Drizzle. Agora parâmetros são ISO e leituras de expiração são convertidas explicitamente.
3. Lista fechada de rotas de isolamento precisava reconhecer as quatro rotas autorizadas. Lista atualizada mantendo o fechamento das demais.
4. Vínculo Google a conta local não verificada era permitido; passou a exigir verificação local.
5. Dados de erro do adapter podiam carregar parâmetros SQL. O tratamento de erro de autenticação agora preserva respostas esperadas e registra somente ocorrência genérica, sem payload.

6. O feedback nativo do nome forçava o foco ao sair do campo inválido. Substituído por mensagem inline acessível, retestado no cadastro/perfil sem permitir persistir links.
7. O painel administrativo tinha uma consulta de período que passava Date direto ao cliente SQL. Corrigida para ISO; regressão coberta em PostgreSQL e painel aberto no navegador.
8. Logs de desenvolvimento podiam registrar URLs com tokens. As rotas com convites/verificação e retornos de autenticação foram excluídas do log de requisições; os artefatos preservados não contêm tokens.

## Navegador e e-mail real

Teste concluído na madrugada de 20/10/2026 (Brasília), com banco descartável em loopback e aplicação local. Envio Resend real, sem mock, utilizando temporariamente a credencial existente do Radar. O harness restringiu o destino a `contato@apogee.community`; não alterou destinatários, conteúdo, headers de autenticação ou respostas do provedor. Foram submetidos exatamente três e-mails, todos HTTP 200, e os três foram vistos no webmail Hostinger. Os IDs e horários estão em `evidence/member-invitations/mail-provider-results.json`.

| Etapa | Evidência |
|---|---|
| Convite de membro recebido | `mail-member-received.png` e `member-invitation-pending.png` |
| Convite administrativo e verificação recebidos | `mail-invitations-and-verification-received.png` |
| GET e tentativa antes de verificar | Ambos convites permaneceram pending; conta member/email_verified=false, conferidos no banco |
| Link nativo de verificação recebido | Navegador abriu o link assinado lido do webmail; email_verified=true e ambos convites ainda pending |
| Aceitação de membro por POST | `member-accepted.png`; um único evento de consumo |
| Membro acessa `/admin/usuarios` | Redirecionado a acesso negado: `member-admin-denied.png` |
| Aceitação administrativa por POST | `admin-accepted.png`; painel e usuários acessíveis: `admin-dashboard-allowed.png`, `admin-users-allowed-and-legacy-name-inert.png` |
| Gestão de administradores não herdada | `invited-admin-cannot-manage-admins.png`; can_manage_admins=false |
| Nome inválido no perfil | `name-link-rejected.png`; nome/bio preservados em `invalid-profile-persistence.json` |
| Fixture maliciosa antiga no banco | Texto visível no painel, zero img/script/handler injetados: `legacy-name-inert.json` |
| Estado final | `database-results.json`: dois convites accepted, um evento cada, uma única conta destinatária verificada/admin, sem autorização de gerenciar admins |

A mesma caixa controlada foi usada sequencialmente como membro e depois administrador, cobrindo também promoção de conta existente sem duplicação. A suíte automatizada cobre novos destinatários separados para os dois perfis, concorrência e casos negativos.

A cópia temporária da chave (modo 600) foi removida após encerrar o servidor de teste. Nenhuma credencial foi gravada no repositório. Os e-mails de teste foram preservados na caixa.

## Arquivos e limites da entrega

Arquivos principais: `lib/members/{validation,auth,dal,schema,forum,invitations,invitation-http,mail}.ts`, `lib/admin/{invitation-policy,data}.ts`, `app/api/members/{invitations,verification}/route.ts`, `app/admin/convites/page.tsx`, `app/membros/convite/page.tsx`, os componentes `invitation-manager`, `invitation-acceptance` e `name-input`, formulários de cadastro/perfil, conclusão social, proxy, navegação administrativa, `next.config.ts`, `.env.example`, scripts de concessão, testes, migração e snapshot. A lista exata está no commit local desta entrega.

A política social e os hooks foram testados com perfis sintéticos; não foi executado login ao Google real no ambiente local. O recebimento real dos convites e a verificação por e-mail não dependem de Google e foram concluídos. Não houve push, CI remoto, merge, deploy, migração remota, mudança de DNS ou alteração do ambiente da VPS.

Referências técnicas consultadas: documentação instalada de Next.js 16.3.8 (forms, route handlers, data security e logging) e [Better Auth — verificação de e-mail](https://better-auth.com/docs/concepts/email), além do código instalado da versão usada pelo projeto.
