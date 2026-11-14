# Validação do checkout anual na Stripe — 14/11/2026

Estado: concluída no ambiente de teste da APOGEE (`livemode=false`), com revisão antes de publicar. Nenhuma publicação, push, migração ou configuração de produção foi executada.

A prévia funcional foi aprovada pelo proprietário, que autorizou a validação do checkout no sandbox. O conector MCP continuou listando apenas produção mesmo após a autorização; a sessão do navegador interno confirmou o modo de teste da APOGEE, e a integração usou a credencial **test** existente do mesmo merchant. Foi usado o modo de teste da conta existente, com recursos novos identificados por execução; não foi criado um sandbox separado.

## Escopo e isolamento

- Conta: `acct_1R7iASASpZUkiAYG`, APOGEE, somente test.
- Execução: `apogee-annual-20261114-checkout1`.
- Código-base aprovado: `9649cfe917ab0075a1715ee7d69beb8dfb165439`, acrescido dos ajustes descritos abaixo.
- Banco PostgreSQL local novo, sem conexão com dados de produção.
- Catálogo e contas fictícios. Autenticação, checkout, portal e processamento de webhooks reais da aplicação.
- Cartões públicos de teste: aprovação `4242…4242`; recusa `4000…0002`. Não foram usados cartão ou dados pessoais reais.
- Encaminhamento pelo Stripe CLI oficial v1.55.11, cópia temporária com SHA-256 conferido. Webhooks recebidos no localhost; nenhum endpoint público foi criado.
- Chaves e segredo do webhook somente na memória/ambiente dos processos; não foram incluídos em código, relatório ou log exportado. Instalação global do CLI preservada.
- E-mails fictícios; envio do aplicativo desativado. Checkout permaneceu em BRL, sem adaptação de moeda, descontos ou cálculo automático de tributos habilitado neste teste.

## Recursos de teste criados

| Recurso | ID |
| --- | --- |
| Produto anual de teste | `prod_Vd14aQ3Hu5CdzY` |
| Preço anual de teste | `price_1Ubl21ASpZUkiAYGkOx8YLKN` |
| Portal exclusivo | `bpc_1Ubl22ASpZUkiAYGusOKAHn1` |
| Assinatura da compra/reembolso | `sub_1Ubl5DASpZUkiAYGeExWA6t5` |
| Assinatura da recuperação após recusa | `sub_1UblAhASpZUkiAYG1pDt7lKR` |
| Assinatura do Test Clock | `sub_1Ubl6qASpZUkiAYGgtjfeVn5` |

O preço foi validado como **143880 centavos BRL, intervalo year, quantidade 1**, sem teste gratuito ou opção mensal. As duas sessões Checkout concluídas foram criadas pelo POST real da aplicação. A assinatura do Test Clock foi criada pela API de Billing exclusivamente para simular renovações.

## Resultados confirmados

| Cenário | Resultado observado |
| --- | --- |
| Compra anual aprovada | Checkout mostrou R$ 1.438,80 por ano e `livemode=false`; pagamento foi aprovado, fatura paga registrada e acesso anual liberado para a conta correta até 14/11/2027. |
| Radar após pagar | Conta que já tinha dez eventos abriu o evento 11 pelo acesso anual, sem adicionar consulta gratuita. |
| Portal | Fatura anual paga e próxima data anual visíveis; configuração de troca de plano desativada e cancelamento apenas ao fim do período. |
| Cancelar pelo aplicativo | POST real alterou `cancel_at_period_end=true`; webhook confirmou e o período pago permaneceu ativo. |
| Cartão recusado | Checkout apresentou recusa; a conta continuou sem direito anual. |
| Recuperar na mesma sessão | Trocar pelo cartão de aprovação concluiu uma única assinatura e uma fatura anual para essa conta. Sua renovação também foi cancelada ao final do teste. |
| Renovação paga | Test Clock avançado até a próxima anuidade gerou nova fatura paga, com período anual próprio registrado. |
| Renovação recusada | Após configurar cartão de falha e avançar para a anuidade seguinte, Stripe retornou `past_due`; `invoice.payment_failed` registrou o novo período como `unpaid`. Nenhum período pago foi criado para essa fatura. |
| Reembolso integral | Reembolso de teste `re_3Ubl5CASpZUkiAYG2IoANqD2` concluído; `charge.refunded` marcou a fatura como `refunded`, retirou o direito anual e o evento 11 voltou a apresentar a comunidade. |
| Eventos posteriores | Atualizações reais nas três assinaturas reexecutaram a conciliação. A fatura reembolsada permaneceu reembolsada e não houve duplicação de faturas. Não se trata de reentrega do mesmo ID; a deduplicação do mesmo ID também permanece coberta pelos testes locais. |
| Conta de controle | Permaneceu com dez consultas e sem acesso anual durante toda a validação. |
| Acesso antigo | A conta legada continuou abrindo o evento 11 e terminou com zero consultas gratuitas consumidas, inclusive após o reembolso de outra conta. |

### Limite da simulação temporal

O Test Clock avançou apenas o relógio da Stripe, até novembro de 2028. O relógio do computador/PostgreSQL permaneceu na data real de 2026. Por isso a validação externa confirma a criação e classificação das faturas e seus períodos, sem antecipar acesso a períodos futuros. A expiração em relação ao relógio da aplicação e a preservação do último período pago são cobertas também pelos testes de integração em PostgreSQL.

### Webhooks e registros

Foram recebidos e aceitos **21/21 webhooks reais de teste, todos HTTP 200**:

| Tipo | Quantidade |
| --- | ---: |
| `customer.subscription.created` | 3 |
| `checkout.session.completed` | 2 |
| `invoice.paid` | 4 |
| `customer.subscription.updated` | 9 |
| `charge.refunded` | 1 |
| `invoice.payment_failed` | 1 |
| `customer.subscription.deleted` | 1 |

O ledger terminou com cinco faturas únicas: três `paid`, uma `refunded` e uma `unpaid`. Todas usam BRL 143880. Os IDs enviados pelo CLI coincidiram com os recibos locais, sem duplicação de linhas. A verificação automática dos resultados confirmou essa correspondência.

## Ajustes encontrados durante a validação

1. A tela genérica dizia “pagamento em andamento” após um reembolso já confirmado. A consulta agora retorna a situação da fatura relevante ao período atual e a tela distingue reembolso, análise e pagamento pendente, preservando a mensagem dos direitos antigos. Faturas futuras não escondem a situação do período atual.
2. Mensagens de retorno e cancelamento agora refletem a confirmação quando já disponível e pedem atualização quando ainda pendente.
3. O link para continuar no Radar precisava manter texto branco no botão escuro, sobrepondo a regra genérica de links dos painéis. Ajuste restrito aos links com classe de ação primária.
4. Adicionado roteiro local `/previa/stripe` com guarda de desenvolvimento, chave test e banco em loopback. Em produção essa rota retorna indisponível, e os dados fictícios não são habilitados.

## Evidências e encerramento

Os arquivos entregues em `outputs/validacao-stripe-sandbox` incluem relatório, capturas, `evidence.json`, snapshots de cada etapa, `resultado-verificado.json` e logs sanitizados. Não incluem chave, segredo ou URL de sessão do portal.

As renovações das duas compras Checkout foram canceladas. A assinatura do Test Clock foi encerrada. O servidor/encaminhador do sandbox e seu banco local foram encerrados após registrar as evidências. A prévia comum da porta 3461 é restaurada com pagamentos desativados.

O script `scripts/stripe-annual-sandbox.mjs` fica como ferramenta local explícita, executada pela fila, com IDs de usuário separados por execução para evitar reutilizar clientes entre testes. Exige a conta/credencial de teste, CLI oficial e PostgreSQL nativo. Não deve ser executado contra dados ou chaves de produção.

## Antes de publicar

- Revisão deste resultado e do novo candidato pelo proprietário.
- Confirmar as entregas comerciais de Learn, Perks e atividades antes de abrir vendas.
- Preparar separadamente produto/preço, portal, chaves e webhook de produção; IDs de teste não devem ser reutilizados em live.
- Conferir histórico de migrações, inventário dos acessos antigos, backup restaurável e rollback para a revisão exata aprovada.
- Publicação e ativação das vendas continuam dependendo de autorização própria. Nada desta validação foi publicado.

Referência do método: [Testar integrações de Billing com Test Clocks](https://docs.stripe.com/billing/testing).
