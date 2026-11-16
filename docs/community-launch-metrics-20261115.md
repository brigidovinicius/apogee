# Indicadores mínimos e cobertura

`scripts/community-launch-metrics.mjs` produz JSON somente com agregados, em transação **REPEATABLE READ READ ONLY**, timeout de dez segundos, sem carregar dotenv, escrever dados, consultar provedores ou exportar identidades. O teste com PostgreSQL próprio confirmou `transaction_read_only=on`, separação test/live, exclusões, cálculos e ausência de alteração no ledger (fila 2132).

Comando no ambiente autorizado, sempre pela fila se local:

```sh
node scripts/community-launch-metrics.mjs --from 2026-11-09 --to 2026-11-16 --mode test
```

`from` inclusivo e `to` exclusivo são dias em America/Sao_Paulo. A fotografia usa o instante da execução. A configuração de conexão/TLS reutiliza `databaseOptions`; credenciais só no ambiente proprietário, sem valores no comando/log. Não executar com modo test sobre um banco real para simular validação: **modo Stripe não identifica a origem do banco**. Nesta entrega o teste usou cluster nativo novo, com dados inteiramente sintéticos.

| Indicador | Fonte e definição | Cobertura/limite |
| --- | --- | --- |
| Pedidos do evento | `community_contact`, campanha permitida `codex`, data original do consentimento | Finalidade de orientações; não conta, presença, assinatura nem marketing. Tabela ausente retorna null. |
| Cadastros | Contas verificadas/não bloqueadas criadas na janela | Fotografia atual; não reconstitui status histórico. Exclui admin; live exclui domínios sintéticos reservados conhecidos. Outros testes exigem inventário. |
| Primeira consulta | Primeira linha em `radar_free_event` na mesma semana de Brasília do cadastro, sobre a coorte de contas sem direito Radar anterior | Não inventa taxonomia da seleção antiga; conta legada/compra antiga sai do denominador. Semana em curso é incompleta; reportar fração/base. |
| Oferta/origens/uso | Contadores diários existentes, com escolha de medição respeitada; sem junção com contas | Não identifica pessoas ou coortes. Rotas internas novas sem vocabulário próprio não têm cobertura por recurso. Não inferir usuário único de clique. |
| Início de checkout | Linhas retidas de `community_checkout_attempt`, por ambiente, com início derivado da expiração fixa de uma hora | É o pedido retido, não todo histórico de cliques/sessões; linha anterior é substituída. Não comprova pagamento. |
| Pagantes vigentes | Contas membro com fatura `paid`, sem risco, no período vigente e modo escolhido | Não conta lead, admin, gratuito ou legado sem fatura anual. Cancelamento da renovação ainda conta durante período pago. Bloqueio/verificação não apagam pagamento; `annual_accounts_access_eligible` mostra separadamente as contas aptas a acessar. |
| Receita normalizada | Pagantes vigentes × 143880 centavos anuais; mensal ÷ 12 | Valor de referência, antes de custos. **Não é caixa recebido**, receita líquida ou nova cobrança mensal. |
| Cancelamentos | Pagantes vigentes com `cancel_at_period_end` | Fotografia de não renovação; não taxa histórica de churn nem perda imediata de direito. |
| Risco | Faturas em disputa/risco e marcadores mantidos | Fila de revisão operacional; não limpar marcador para aumentar indicador. |
| Conteúdo disponível | Ferramentas publicadas/conferidas, benefícios vigentes e módulos publicados com atividade | Saúde editorial; catálogo vazio não satisfaz entrega paga. |
| Conversão em 30 dias | Novos pagantes / contas gratuitas da mesma coorte madura | **Não medido**: ledger atual não guarda data canônica da primeira liquidação. Período da fatura ou customer não substituem esse fato. Conciliar pela Stripe; não retornar zero fictício. |
| Ativação em sete dias | Entregável concluído ou ação concreta a partir da oportunidade, após primeira contratação paga | **Não medido**: progresso reaberto não é histórico imutável; resultado e cobertura de consentimento individual não estão definidos. Visita não vira ativação. |
| Retorno dias 8–14 | Nova ação de valor por quem ativou na primeira semana | **Não medido**: requer a definição anterior e coorte madura. Não criar identificação comportamental para preencher a lacuna. |
| Caixa/churn financeiro | Recebimentos, taxas, reembolsos e base/período de cancelamento | **Não medido aqui**: usar relatório canônico Stripe. Ledger local não guarda valor do reembolso parcial ou histórico completo de status. |
| Erros/atendimento | Logs técnicos sanitizados e registro operacional com categorias de motivo | Responsável e rotina a confirmar; não inserir conteúdo da mensagem, cartão ou dados do membro em analytics. |

Os campos indisponíveis saem como null acompanhados das limitações. R11 tem uma base operacional verificável; a medição de ativação/retorno/conversão permanece dependência de definição/cobertura, não uma funcionalidade declarada pronta. Hipóteses de 60%/40% e metas estratégicas não são resultados nem bloqueios técnicos arbitrários. Nenhuma nova coleta ou migração é ativada por este relatório.
