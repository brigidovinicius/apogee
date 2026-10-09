# Plano pendente de autorização: banco e runtime Radar

Nada deste diretório foi aplicado. `runtime-roles.sql` não integra `db/migrations`
e termina em ROLLBACK. Não executar em produção como teste: até DDL revertido
adquire locks. A evidência atual é de código/configuração, não de roles da VPS.

1. Autorizar inventário somente leitura e backup restaurável do banco exclusivo
   Radar. Confirmar versão, tabelas/migrações, owners, políticas, grants herdados,
   extensões, sequences e ausência de dependência de outros serviços.
2. Preparar duas credenciais sem superuser/BYPASSRLS/ownership: leitor e editor.
   O exemplo PostgreSQL usa POSTGRES_USER como bootstrap superuser; essa
   credencial deve ficar restrita à migração/administração e sair do runtime.
3. Revisar o SQL proposto com o inventário. As políticas por role são necessárias:
   qualquer conexão pode configurar `app.is_admin`; a GUC sozinha não autentica.
   Não conceder ao leitor membership de editor, owner nem migração. Conceder
   CONNECT apenas no banco Radar; revisar grants PUBLIC existentes.
4. Antes da troca, implementar/validar em PR separado pools com URLs distintas
   para `queryPublic` e `withAdminTransaction`, sem fallback entre credenciais.
   Hoje ambos usam DATABASE_URL; aplicar estas políticas sem essa mudança pode
   interromper leituras. A correção atual adiciona filtros SQL explícitos.
5. Em banco descartável, testar com as credenciais finais: leitor não vê pending,
   rejected, suspended, expired nem unpublished, inclusive após SET app.is_admin;
   leitor não escreve e não assume role editor; editor só grava com autorização
   da aplicação. Testar rollback/reutilização de conexão e fluxo editorial humano.
6. Só depois de autorização explícita aplicar DDL, criar LOGINs/segredos fora do
   Git, atualizar env/pools e validar o SHA aprovado. Preservar volumes e backups.
   Rollback: restaurar credenciais/configuração anterior e políticas inventariadas
   por transação revisada; não improvisar DROP, reset ou recriação do banco.

Outros gates independentes: deploy Radar, rede/egress e proxy; confiança no IP
somente após comprovar que o proxy sobrescreve X-Real-IP e que não há acesso
direto ao serviço; armazenamento distribuído de rate limit se houver réplicas;
migrações; ativação de fontes e ingestão real. Nenhum desses gates foi executado.
