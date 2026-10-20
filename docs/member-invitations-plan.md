# Convites e nomes — plano local (19/10/2026)

Base: checkout limpo `radar-optimization-20261016`, `e6ed04f`, aplicação `make-it-fly-current`.

1. Compartilhar regra Unicode de nome (1–100 caracteres, letras, espaços, hífen, apóstrofos e iniciais), validar hooks de criação/atualização Better Auth, gravações do fórum e confirmação social. Nunca reescrever nomes antigos automaticamente.
2. Migração aditiva: autorização explícita `can_manage_admins`, bloqueio e confirmação de nome no usuário; convites e eventos de auditoria privados. Administrador ativo gerencia membros; só administrador ativo com autorização específica gerencia administradores. Nenhuma concessão automática a administradores existentes.
3. Tokens de 32 bytes, somente SHA-256 persistido, validade padrão 48h, rotação no reenvio, revogação, consumo transacional e idempotente. Papel deriva do banco; bloquear destinatário e reavaliar emissor sob locks. Não alterar credenciais, assinatura ou rebaixar administradores.
4. Resend (padrão existente do Radar), texto puro, URL de origem configurada, falhas explícitas. Verificação nativa Better Auth separada da aceitação. GET não consome convite.
5. API com sessão, campos estritos, CSRF por Origin confiável, limites em banco; telas `/admin/convites` e `/membros/convite` com componentes/estilos existentes.
6. Testes de política, API e PostgreSQL descartável; navegador; lint, tipos, build sequenciais na fila. Mail sink de teste no harness, sem bypass no produto. Entrega externa depende de caixa controlada/configuração; simulação não prova entrega real.

Arquivos: lib/members/{validation,auth,dal,schema,forum,invitations,mail}.ts; lib/admin/invitation-policy.ts; app/api/members/*; telas/componentes de convites e confirmação; componentes de nome; proxy; drizzle/0004_member_invitations.sql e journal; testes/scripts e este relatório. Sem push, publicação ou banco remoto.


Atualização de encerramento (20/10/2026): o escopo local original acima foi
seguido por autorizações explícitas para publicação, migração, configuração e
testes na VPS. A implementação está publicada; ver o
[registro público da release](member-invitations-rollout-20261020.md).
