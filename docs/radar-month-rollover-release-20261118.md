# Conciliação automática na virada mensal

Estado: candidato local validado; envio, CI, merge, migração e ativação pendentes de autorização para a revisão exata.

## Comportamento

O processo financeiro existente acorda após a meia-noite de Brasília na virada do mês. Verifica o consumo do novo período, o consumo acumulado desde a âncora original e a tarifa oficial antes de abrir um novo ciclo. A transação mantém US$ 50/mês e US$ 30/15/5, preserva compromissos incertos e registra consumo externo sem duplicar recibos confirmados. A concessão original e sua expiração não são renovadas pelo calendário.

Pausas, conta divergente, preço alterado, resposta incompleta, saldo esgotado ou crédito vencido impedem a abertura. Uma falha não prolonga a prova financeira anterior. A coleta gratuita permanece independente. Não são criadas credenciais nem alteradas as atuais.

## Validação local concluída

- `npm run test:ai-foundation`: 89/89 aprovados, sem chamadas reais ao provedor.
- `RADAR_POSTGRES_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:ai-postgres`: 48/48 aprovados em PostgreSQL 17 descartável, com login financeiro real e concorrência entre aberturas.
- `npm test`: 789 aprovados, 38 ignorados por dependências de ambiente e um teste sem arquivo disponível no checkout esparso. Após disponibilizar a migração já versionada do calendário, somente esse teste foi repetido e aprovado: 790 testes aprovados no conjunto, sem falha de código pendente.
- `npm run lint`: aprovado.
- `npm run typecheck`: aprovado.
- `git diff --check`: aprovado.

Inclui limites mensais e por faixa, retenção de compromissos antigos, passagem de dezembro para janeiro no horário de Brasília, concorrência real, repetição sem nova abertura, renovação sem redefinir crédito, falha sem estado parcial e recuperação após evidência válida. O teste inicial da escalada de papel foi ajustado para usar login real PostgreSQL, pois SET LOCAL ROLE no PGlite mantém a sessão original privilegiada.

Não houve publicação, abertura de mês ou alteração de esquema em produção nesta etapa. A inspeção da VPS foi somente leitura. Não houve geração paga durante os testes. Não há mudança de interface ou dependências que exija build local do Next.js; a CI completa ainda deve aprovar o candidato antes da implantação.

## Instalação a executar após aprovação

1. Enviar somente a branch deste candidato, criar PR, aguardar CI completa e revisar o diff; integrar sem modificar o candidato aprovado. Se for necessário alterar código, obter nova autorização para o SHA resultante.
2. Conferir `origin/main`, checkout remoto limpo, revisão exata, saúde e identidade de todos os containers. Adquirir os quatro locks de deploy existentes. Preservar hashes das configurações e dos arquivos de credenciais sem exibir seus conteúdos.
3. Preparar release imutável por Git e construir somente o alvo `finance-runner` do Dockerfile do Radar. A web, o scheduler, o trabalhador de IA e o blog permanecem com suas imagens atuais.
4. Criar backup PostgreSQL protegido, verificar checksum e restaurá-lo em banco isolado. Aplicar `0061_automatic_month_opening.sql` somente na cópia e validar privilégios, consumo atual, concessão e conciliação com a chave de leitura já instalada. Simulações de meses e alterações de fixtures devem ficar restritas à cópia; nenhuma chamada de geração é necessária.
5. Aplicar a migração aditiva em produção em transação, registrando-a em `schema_migrations`. O novo sinal permanece falso por padrão. Ativar somente a âncora original vinculada ao controle vigente, sob lock, após conferir conta/projeto, crédito gratuito vigente, recarga automática desativada e atestado existente. Não inserir concessão, renovar vencimento ou zerar consumo.
6. Recriar somente `finance-worker`, com a imagem do candidato e os segredos já montados. Executar uma conciliação de leitura real, confirmar orçamento, prova, sinal de abertura automática e logs sanitizados. Observar saúde e verificar que os demais containers e configurações foram preservados. Não simular a data nem forçar uma abertura futura no banco ativo.
7. Registrar revisão, migração, resultado e rollback em evidência privada. No Linear, registrar somente o status autorizado de instalação.

## Rollback

Desativar `automatic_months` na âncora original e voltar somente à imagem financeira anterior registrada no inventário. Preservar a migração aditiva, ciclos e recibos; não restaurar o banco sobre consumo já registrado. O processo anterior renova somente um mês já aberto e não cria novos ciclos. Erro de privilégio, conta divergente, alteração de limite/faixa ou falha na validação financeira impede a ativação.

O runbook geral exige aprovação explícita por revisão: [deploy rotineiro](apogee-routine-vps-deploy.md).
