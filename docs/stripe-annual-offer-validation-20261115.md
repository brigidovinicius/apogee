# Assinatura anual — validação integrada em Stripe test

Execução em 15/11/2026, horário de São Paulo (16/11 UTC). Run `apogee-annual-offer-20261115-01`, conta Stripe `acct_1R7iASASpZUkiAYG` conferida por API. Somente credencial test existente, recursos `livemode=false`, pessoas `@example.test`, cartões oficiais de teste, PostgreSQL nativo próprio. Nenhuma cobrança real, email do aplicativo ou escrita no banco de produção.

## Resultados observados

| Cenário | Evidência e resultado |
| --- | --- |
| Checkout anual pela UI real | Sessão `cs_test_a0PFNQSTL99GDowzqISrUrkCutI6FQTVQMSpqwCKum9mbupRNbaOsmI8j1`, 143880 BRL, recorrência anual. Cartão 4242; assinatura `sub_1UcDiBASpZUkiAYGfLEqJGfs`, fatura `in_1UcDi9ASpZUkiAYGayWi7KpI` paga. UI e ledger confirmaram acesso só a `sandboxcompra`. |
| Uso do recurso | Caixa mostrou Google Flow; Trilha mostrou as três atividades originais. Conclusão da primeira persistiu após recarregar: 1/3, com opção de reabrir. Saldo do Radar permaneceu em dez. |
| Portal | Portal dedicado aberto pela conta correta; total anual, fatura paga e renovação de novembro/2027; troca de plano desativada. Retorno à aplicação permitido. |
| Cancelamento da renovação | Botão real da aplicação; Stripe `cancel_at_period_end=true`. Após webhook/recarregar, UI informou renovação cancelada e acesso pago preservado até 15/11/2027. |
| Recusa e nova tentativa | Sessão `cs_test_a0YZnY5r2cO5QiGmkqDS3eBJYecfBwReaLuElDBm7xstkXhBVSiWiruzQw`. Cartão oficial 4000…0002 mostrou “Seu cartão foi recusado”; nenhuma assinatura/direito local. Na mesma sessão, 4242 concluiu o pagamento; fatura `in_1UcDu9ASpZUkiAYGSLo0TXfs`, assinatura `sub_1UcDuBASpZUkiAYGkHuE6dUO`, acesso de `sandboxrecusa` ativo. Renovação depois cancelada pelo botão real, período preservado. |
| Renovação paga por test clock | `clock_1UcDlSASpZUkiAYGYrsTpIG5`, assinatura `sub_1UcDlTASpZUkiAYGlq1YAHer`. Fatura inicial paga até 16/11/2027 UTC; renovação `in_1UcDp0ASpZUkiAYG9z0Pixm5` paga de 16/11/2027 a 16/11/2028 UTC. Ledger criou exatamente o período canônico. |
| Renovação recusada | Cartão oficial `pm_card_chargeCustomerFail` no cliente do relógio; próxima fatura `in_1UcDs1ASpZUkiAYGKeww9Mtw` ficou `unpaid`, assinatura `past_due`. Período 2028–2029 não concedeu direito. Assinatura do relógio encerrada ao final sem fatura/rateio. |
| Reembolso integral | `re_3UcDi9ASpZUkiAYG1IiSqSoQ`, succeeded, somente da compra sintética inicial. Ledger passou a `refunded`, `sandboxcompra.annual_active=false`. Login por UI e URL direta da Caixa mostraram a oferta restrita, sem Google Flow. |
| Eventos posteriores/conciliação | Atualização de metadata das duas assinaturas próprias provocou novos eventos assinados. Estado reembolsado permaneceu restrito, sem reativação por evento posterior. 20 recibos aceitos ao snapshot final. São novos IDs, não replay do mesmo ID. Duplicação simultânea e fora de ordem são cobertas pelas integrações PostgreSQL locais. |
| Isolamento | `sandboxcontrole` continuou sem anual; `sandboxlegado` manteve legado, sem anual; saldos dos quatro perfis não legados permaneceram dez. Nenhum papel administrativo concedido. |

O test clock avança apenas a Stripe. O relógio da aplicação e do host não foi alterado; por isso o período futuro pago fica no ledger e só será elegível quando vigente. Expiração por tempo, reembolso parcial, fraude/disputa, preço/ambiente/conta incorretos, concorrência e duplicação também passaram na integração local com provedor explicitamente simulado. Não apresentar esses últimos como disputas reais geradas na Stripe.

## Reprodutibilidade e limites

Harness: `make-it-fly-current/scripts/stripe-annual-sandbox.mjs`, pela fila global com flag explícita, whitelist da conta e validação do prefixo test, produto/preço/portal próprios. Listener Stripe CLI 1.34.0 encaminhou webhooks assinados para loopback, API 2026-10-28.endive. O harness preserva o banco e só retoma diretório com marcador do mesmo worktree/run. A ação `finish` encerra seus processos normalmente.

Houve interrupção do host antes da primeira compra: a sessão interrompida estava canonicamente aberta/não paga/sem assinatura e foi expirada no próprio ambiente test. A execução retomada usou o mesmo produto/preço/portal idempotentes e novo banco próprio. Nenhum resultado anterior foi contado como pagamento.

A revisão automática bloqueou a submissão do cartão de recusa até nova autorização explícita do usuário. A sessão foi revalidada por API (`open`, `unpaid`, sem assinatura) e pela página (`livemode=false`, valor e cartão oficiais); só depois da autorização a tentativa foi realizada.

Artefatos locais sintéticos: `/private/tmp/apogee-offer-sandbox-20261115/evidence.json` e snapshots `status-*.json`; credenciais e segredo do controle não são copiados para este documento/Git. Capturas em `.codex/visualizations/2026/11/15/01a1e124-0b37-7421-97a3-45c0cae8d624/`: `assinatura-test-confirmada.jpg` e `stripe-test-recusa.jpg`.

Esta evidência não configura nem autoriza produto/preço/portal/webhook live, entrega de email, OAuth Google, migração real ou deploy. `COMMUNITY_BILLING_ENABLED=false` observado em produção permanece sem alteração.
