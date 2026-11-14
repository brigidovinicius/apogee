# Comunidade anual e cota do Radar — candidato local para validação

Data: 14/11/2026. Branch local: `feat/annual-membership-quota-20261114`.
Estado: implementação local. Sem push, publicação, migração de produção, criação de recurso Stripe ou cobrança real.

## Oferta e regras apresentadas

- Entrada gratuita, sem cartão ou assinatura automática.
- Dez eventos distintos por conta, sem renovação da cota; reabrir o mesmo ID não consome novamente.
- Comunidade exclusivamente anual: R$ 1.438,80 por ano; R$ 119,90 é somente o equivalente mensal. Sem opção mensal ou parcelamento implementado.
- Renovação automática anual; cancelamento da renovação mantém o período efetivamente pago. Falha de renovação não adiciona dias.
- Reembolso integral e disputa suspendem o direito da fatura anual; reembolso parcial mantém o período. Alerta de fraude permanece suspenso até revisão operacional.
- Acessos antigos válidos do Radar continuam independentes. Uma assinatura encerrada não os retira.
- A escolha gratuita anterior permanece. Se confirmada como evento, conta como a primeira consulta; outra categoria conserva a escolha única anterior fora da cota de eventos. Classificação ausente não é inventada.
- Learn, Perks e atividades exigem confirmação das entregas antes da venda. Este candidato não cria cursos ou benefícios fictícios.

## Implementação

A cota usa `radar_free_event`, com dez posições por conta, chave única por ID e trava da linha do usuário durante a abertura. O banco impede exceder dez posições inclusive em dispositivos concorrentes. GET/prefetch, listagens e ferramentas MCP não consomem. A classificação usa `categories.includes('eventos')` do catálogo validado. Trocas na descrição de uma ficha não alteram seu ID.

`community_customer` vincula o cliente Stripe à conta antes do checkout. Checkout é exclusivamente `subscription`, com produto/preço/valor/moeda/período/quantidade validados no servidor; tentativas concorrentes reutilizam a chave idempotente e parâmetros persistidos. Uma assinatura pendente ou existente impede duplicação. Não se aceita preço, destinatário ou customer enviados pelo navegador.

Faturas pagas e respectivos períodos ficam em `community_invoice`, separadas das compras vitalícias. Webhooks exigem assinatura do corpo bruto, reconsultam o estado canônico sob trava por assinatura e deduplicam eventos. A liberação verifica fatura anual exata, pagamento confirmado e vínculo da conta; a URL de retorno não concede direitos. Eventos de risco também são conciliados. Direitos anteriores têm precedência na decisão do Radar.

`/membros/assinatura` apresenta estado, período pago, cancelamento e, quando configurado, portal de faturas. Os POSTs de gestão repetem sessão, origem, conta e limitação de frequência. O portal exige configuração própria, sem troca de plano e sem cancelamento imediato. A venda avulsa em `/api/radar/checkout` retorna 410 em JSON ou encaminha a navegação para a comunidade; o webhook e a confirmação das compras antigas continuam funcionando.

## Prévia local

[Área de validação por conta](http://127.0.0.1:3461/previa/validacao).

Senha exclusivamente local: `RevisaoLocal2026!`.

| E-mail local | Cenário |
| --- | --- |
| revisaolivre@example.test | Saldo inicial de dez eventos. |
| revisaolimite@example.test | Dez eventos já liberados; 11 e 12 bloqueados. |
| revisaolegado@example.test | Radar completo por direito antigo. |
| revisaoanual@example.test | Período anual pago sintético, renovação cancelada. |

Entre pelo formulário normal da aplicação. Para trocar de conta, use Sair. A gravação das consultas persiste entre atualizações e logins enquanto a prévia permanece ativa. Reiniciar o script cria um novo banco isolado.

O catálogo, as contas e o pagamento anual são sintéticos. Autenticação, consultas SQL e decisão de acesso usam a implementação real. As páginas públicas antigas de demonstração continuam separadas. Operações de pagamento são bloqueadas nessa prévia e nenhuma mensagem é enviada.

Comando de reprodução, sempre pela fila global:

```sh
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/local-offer-review.mjs
```

O servidor fica em loopback e usa PostgreSQL nativo próprio. `PG_BIN` pode indicar a pasta dos binários. Não usa `.env` nem banco existente. Os guardas de revisão retornam falso em produção mesmo com as flags ligadas.

## Migração preparada, ainda não executada em produção

`0017_community_annual.sql` e `0018_radar_event_queries.sql` são aditivas e não reescrevem nem removem concessões antigas. `community:access:migrate` faz preflight por padrão; `--apply` é separado. O runner verifica papel, histórico completo por hash, esquema e constraints, aplica em transação e recusa deriva ou estado parcial. Backup restaurável e autorização da revisão exata são necessários antes de execução operacional.

A migração 0017 exige a 0016 já registrada. Uma produção com histórico diferente deve ser reconciliada antes da execução, sem forçar journal, resetar ou alterar migrações aplicadas.

## Pendências para liberar vendas

1. Validar este candidato e as condições de renovação/cancelamento/reembolso.
2. Confirmar as entregas concretas incluídas nos quatro pilares e os textos comerciais correspondentes.
3. Selecionar a conta Stripe e validar sandbox com preço recorrente anual BRL de 143880 centavos, produto, Checkout, fatura e entrega de webhook reais. Nenhum recurso foi criado na Stripe nesta etapa.
4. Configurar `STRIPE_COMMUNITY_ANNUAL_PRICE_ID`, `STRIPE_COMMUNITY_PRODUCT_ID`, segredo do webhook e configuração exclusiva do portal. Manter a configuração legada para conciliar compras antigas. Não desativar os antigos produtos/links remotamente sem inventário e autorização.
5. Conferir no sandbox compra, reentrega, falha de renovação, cancelamento e reembolso. Os testes locais com respostas sintéticas não substituem essa validação.
6. Após aprovação, preparar o release com inventário dos acessos antigos, backup, migração, rollback e validação da revisão exata. A flag `COMMUNITY_BILLING_ENABLED` fica desligada até esses requisitos estarem atendidos.

## Verificações

O relatório entregue em `outputs/validacao-funcional-apogee/REVISAO.md` registra os resultados finais e as capturas locais. Testes usam um PostgreSQL temporário próprio e respostas Stripe sintéticas; nenhum dado de produção ou cartão foi usado.
