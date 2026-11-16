# Pausa de novas vendas e continuidade dos contratos

Correção isolada sobre `73b90ff`. A falha anterior usava `COMMUNITY_BILLING_ENABLED` como interruptor do serviço inteiro: eventos anuais assinados recebiam 200 sem processamento durante a pausa; portal, cancelamento e conciliação também ficavam indisponíveis.

## Contrato de configuração

- `COMMUNITY_BILLING_ENABLED=false` recusa exclusivamente **novos checkouts**. Não cancela sessões Stripe já abertas nem impede sua confirmação posterior.
- Preservar `STRIPE_MODE`, chave, segredo do webhook, produto/preço anuais e configuração do portal ao pausar. Não remover recursos/credenciais para interromper vendas.
- Quando há configuração anual (produto ou preço), o webhook continua consultando o estado canônico, verificando vínculo/modo e processando faturas, reembolsos e risco. Configuração parcial retorna erro; não confirma silenciosamente a entrega.
- Portal, cancelamento da renovação e conciliação administrativa usam a configuração do serviço, independente da venda. Autenticação, origem, titularidade, limites e permissão administrativa continuam obrigatórios.
- Sem configuração anual e com vendas desativadas, o handler anual não é acionado. A configuração legada do Radar continua independente.
- Direitos já pagos são avaliados pelo ledger/período e continuam independentes da flag. Pausar vendas não estende períodos nem remove direitos antigos.

## Validação proporcional

Regressão PostgreSQL em `tests/community-access.integration.mjs`: checkout negado sem chamada Stripe; fatura assinada confirmada durante pausa; replay sem duplicação; portal/cancelamento disponíveis; período pago preservado; reembolso processado; falha do provedor sem recibo falso e repetição posterior; configuração parcial recusada. A conciliação administrativa também deve funcionar durante a pausa.

O provedor dessa regressão é explicitamente simulado; ela não substitui os pagamentos Stripe test já registrados no candidato, nem comprova operação live. Nenhuma mudança de schema, produção, configuração live ou cobrança é feita aqui.

Resultado local: **15/15 cenários aprovados**, pela fila global (ordem 2123), PostgreSQL nativo novo e sintético. A primeira execução detectou somente uma expectativa incorreta do teste (o handler devolve 503, não 500, na indisponibilidade do provedor); corrigida. A falha é injetada depois da inserção do recibo para comprovar rollback da transação.

Fontes: [webhooks e tentativas de entrega](https://docs.stripe.com/webhooks), [cancelamento ao fim do período pago](https://docs.stripe.com/billing/subscriptions/cancel).
