# Renovação do agendamento do monitor Google — 01/11/2026

Candidato local para renovar a configuração do cron em um novo commit na branch padrão. Ainda não publicado ou validado por disparo automático.

## Problema observado

O workflow `Google Calendar external monitor` permaneceu ativo na branch padrão `main`, com a variável de operação habilitada, mas sem execuções com evento `schedule`. O histórico consultado em 01/11 às 16:32 de Brasília continha apenas os cinco testes manuais de produção. Os testes de incidente, repetição silenciosa, recuperação e persistência de estado já haviam passado; os dois emails de teste foram recebidos.

A configuração publicada contém cron válido. O repositório não é um fork, não está arquivado, Actions está habilitado, o autor do cron é `brigidovinicius` e a página de status do GitHub não informava incidente de Actions. A API não informa por que esses disparos não foram criados. Não se atribui a ausência a um erro de sintaxe comprovado.

O registro do workflow foi desativado e imediatamente reativado pela API, sem alterar código ou permissões. A observação desse procedimento fica nas evidências privadas `.local/google-release-20261101/monitor-followup-*.json`.

## Alteração preparada

O campo cron passa de `3-58/5 * * * *` para a lista explícita `3,8,13,18,23,28,33,38,43,48,53,58 * * * *`. Os doze minutos de execução por hora são idênticos. A finalidade é renovar o registro do agendamento por uma alteração publicada do cron, eliminando também a notação combinada de intervalo e passo.

O restante do workflow permanece idêntico: origem monitorada, credenciais restritas, destinatário, deduplicação, restauração e gravação do estado, permissões e limite de duração. Não há alteração no site, no worker, no banco, no Google OAuth, no Resend ou no acesso de membros. Não é necessário recriar serviços no VPS.

## Validação e publicação

- Conferir a equivalência dos minutos e a igualdade do restante do YAML com o candidato aprovado `3859a86`.
- Executar `git diff --check` e revisar o diff.
- Publicar somente o candidato exato aprovado. A aprovação anterior de `3859a86` não é tratada como aprovação automática de outro SHA.
- Após integrar em `main`, comprovar uma execução criada pelo evento `schedule`, sem substituí-la por `workflow_dispatch`.
- Conferir sucesso do job, restauração do estado anterior, snapshot saudável, gravação de novo artifact, ausência de incidente ativo e zero entregas pendentes.

Uma alteração do cron não garante a correção de uma falha interna do agendador do GitHub. A pendência só termina quando o evento automático real e seus resultados forem observados. O GitHub documenta que execuções agendadas podem atrasar ou ser descartadas sob carga: [referência oficial](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).
