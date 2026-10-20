# Radar vitalício — integração Stripe

## Comportamento e escopo

Um único pacote Apogee: BRL 49,00 (4900 centavos), pagamento avulso,
sem recorrência e sem data de expiração do acesso. A área de membros e
o fórum continuam com sua autenticação atual. O catálogo público mantém
a prévia existente. `/makeitfly` e descendentes não fazem parte da alteração.

O checkout da aplicação exige membro autenticado e origem confiável. Preço,
produto, moeda e quantidade são definidos e conferidos no servidor. A conversão
automática de moeda é desligada no checkout da aplicação. O ID do
membro é gravado na sessão Stripe pelo servidor; o navegador não escolhe o
destinatário. Membros que já têm acesso não são enviados a um novo checkout.

O webhook aceita corpo bruto limitado a 256 KiB/5 segundos, valida a assinatura
Stripe e recupera sessão, itens e PaymentIntent pela API. Só concede com pagamento
efetivado, item único, quantidade 1, produto/preço corretos e total BRL 49,00.
A página de retorno não concede acesso. Eventos repetidos são deduplicados em
transação; uma trava por sessão serializa a consulta atual à Stripe e a gravação,
inclusive quando os eventos chegam fora de ordem.

Payment Links são aceitos para o mesmo preço/produto. A compra permanece sem
destinatário até um membro comprovar o controle do e-mail idêntico no Better Auth.
`client_reference_id` de Payment Link é ignorado. Reembolso integral e disputa
revogam somente o direito daquela compra; uma disputa vencida pelo vendedor pode
restaurá-lo após conciliação. Reembolso parcial mantém o acesso.

## Arquivos e dados

- `lib/billing/*`: configuração privada, SDK, confirmação, armazenamento e acesso.
- `app/api/stripe/webhook`: recepção assinada, sem autenticação por cookie.
- `app/api/radar/checkout` e `verify-email`: ações autenticadas com origem fixa.
- `app/membros/radar/acesso` e `components/members/payment-confirmation`: compra,
  espera pela confirmação e acesso liberado; atualização de tela por até 60 segundos.
- `lib/opportunities/access.ts` e página do Radar: conferem o direito no servidor.
- `lib/members/schema.ts`, migração `0005`: compras, recibos de eventos e acessos
  anteriores. Esses acessos são preservados separadamente, sem receita fictícia.

`radar_purchase` não armazena cartão, chave ou corpo integral dos eventos.
O campo `provider_event_at` é a data informada no evento, não uma data de pagamento
inferida. Acesso não depende dessa data e não expira. Nenhuma compra altera papel
administrativo; contas bloqueadas continuam sem acesso.

## Configuração por ambiente

Use `RADAR_BILLING_ENABLED=false` até completar migração, credenciais e teste.
Configure somente no servidor: `STRIPE_MODE`, `STRIPE_SECRET_KEY`,
`STRIPE_WEBHOOK_SECRET`, `STRIPE_RADAR_PRICE_ID`, `STRIPE_RADAR_PRODUCT_ID`.
Prefira chave restrita com escrita em Checkout Sessions e leitura de Prices,
PaymentIntents, Charges e Disputes. Nenhum segredo usa `NEXT_PUBLIC_`.
Sandbox e produção têm preços, chaves, assinaturas e bancos distintos.

Produto de produção criado nesta conversa: `prod_VTctkygreah2Mu`.
Preço avulso: `price_1USfdJASpZUkiAYG3lMTSOG4`.
Payment Link: `plink_1USfekASpZUkiAYG6i3JW8la`.
Conta de produção: `acct_1R7iASASpZUkiAYG`.
Sandbox utilizado: `acct_1R7iAjPOeMUj2lOm`.
Produto sandbox: `prod_VTcxn4KK0u6RoN`; preço: `price_1USfhEPOeMUj2lOmJKEsaQNi`.
Esses identificadores devem ser verificados novamente na ativação. O teste real
desta implementação está registrado ao final deste documento.

Destino HTTPS previsto: `https://www.apogee.community/api/stripe/webhook`.
Cadastre eventos da própria conta, formato snapshot:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `charge.refunded`
- `charge.dispute.created`
- `charge.dispute.closed`

Para Payment Link, configure retorno para
`https://www.apogee.community/membros/radar/acesso?payment=received`.
Confira também que o link cobra BRL 49,00 sem conversão automática de moeda,
imposto adicional, desconto ou quantidade ajustável.
O retorno é apenas apresentação; o webhook é obrigatório.

## Validação e ativação

Teste local com PostgreSQL descartável e SDK real para assinaturas; transporte
Stripe simulado nos testes automatizados. Verificar acesso negado antes do
pagamento, liberação após evento assinado, duplicação/concorrência, tentativa
de troca de usuário, preço incorreto, pagamento pendente, falha de rede,
rollback, sandbox versus produção, e reembolso/disputa fora de ordem.

O teste real exige autenticação Stripe válida, usar listener local ou destino
HTTPS disponível, pagar com cartão fictício em sandbox e verificar entrega 2xx,
registro no banco e acesso autenticado ao Radar. O clique financeiro fica com
o usuário, conforme o bloqueio de revisão automática desta conversa.

Publicação, migração do banco de produção e gravação de segredos são gates
separados pelo AGENTS.md. Antes de pedir a aprovação final, entregar código,
validações locais e plano de rollback revisáveis. Não publicar endpoint 404
como se estivesse funcional nem ativar o paywall sem o webhook validado.

Ordem de ativação após aprovação: backup restaurável e preflight da VPS;
confirmar SHA e banco de membros corretos; aplicar somente `npm run billing:migrate`;
instalar versão e segredos com billing desativado; cadastrar o destino Stripe;
ativar billing no ambiente de teste e confirmar assinatura, entrega 2xx, persistência
e acesso autenticado; só então ativar a configuração de produção aprovada.

Rollback: interromper novas compras na aplicação desativando billing e desativar
o Payment Link conforme autorização operacional; retornar ao SHA anterior aprovado.
Preservar tabelas, compras, recibos de eventos, acessos anteriores, banco e backup.
Não executar DROP nem apagar dados. Se o código anterior não aceitar o webhook,
as entregas continuarão pendentes na Stripe e deverão ser reenviadas/conferidas após
restaurar o handler. Reativar somente após conciliar os pagamentos do intervalo.

Referências: https://docs.stripe.com/webhooks e
https://docs.stripe.com/checkout/fulfillment.md?payment-ui=stripe-hosted.

## Evidência local — 20/10/2026

Base: `7615c0a` (main obtida diretamente do GitHub); branch isolada
`feat/stripe-radar-lifetime-20261020`.

| Verificação | Resultado |
| --- | --- |
| `npm run test:billing` com PostgreSQL novo, SDK Stripe e Better Auth | 14 testes passaram; transporte Stripe e envio de e-mail simulados, sem rede externa |
| `npm test` | 309 testes do site passaram |
| `npm run lint` | Sem erros; um aviso preexistente de `<img>` em `gallery-admin.tsx` |
| `npm run typecheck` | Passou |
| `npm run build` | Passou e incluiu as quatro novas rotas |
| `npm run typegen` | Passou |
| `git diff --check` | Passou |

O build usou fallback WASM porque a instalação interrompida por falta de disco
havia truncado o SWC nativo. O binário local foi restaurado com a mesma versão
16.3.8 de outra instalação íntegra existente, com hash idêntico entre origem e
destino; `typegen` passou com o binário restaurado. Nenhuma dependência anterior
ou projeto foi apagado.

O CI foi configurado para executar os testes de billing em banco sintético próprio,
após os jobs anteriores; ainda não foi executado remotamente. Nenhum push, PR,
deploy, migração de produção, configuração de segredo de produção ou cadastro de
destino persistente no Dashboard foi realizado nesta implementação. O teste real
abaixo utilizou uma credencial sandbox existente somente em memória/ambiente do
processo e a assinatura temporária do listener, sem gravação em `.env`.

## Teste completo com Stripe sandbox — 20/10/2026, 14:40 BRT

Resultado: **passou**, com Checkout hospedado e evento reais da Stripe, recebidos
pelo listener CLI na aplicação local. O usuário concluiu o pagamento fictício no
Safari; nenhum pagamento de produção foi executado.

- Sessão: `cs_test_a17HoqT0cVZnJW5iFlqFxopiZDhWEgL9e7Pd0x9JoqpvkhblEGsAjExr32`.
- Evento: `evt_1USh1bPOeMUj2lOmsJ5OFRtV`.
- PaymentIntent: `pi_3USh1aPOeMUj2lOm1T7b8NCI`.
- Total confirmado: BRL 4900, `livemode=false`, item único e membro vinculado.
- Antes do pagamento, o novo membro foi redirecionado à compra, sem conteúdo privado.
- Entrega real de `checkout.session.completed`: HTTP 200; compra persistida como
  paga, acesso sem expiração e papel do usuário mantido como `member`.
- Após a confirmação, Radar autenticado respondeu HTTP 200 com a oportunidade
  sintética. O Safari exibiu “Seu acesso ao Radar está liberado” e depois “Radar
  completo” com “TESTE SANDBOX Radar vitalício”.
- Reenvio assinado do mesmo evento: HTTP 200, uma compra e um recibo do evento.

O roteiro reproduzível está em `scripts/test-radar-stripe-sandbox.mjs`. Usa a conta
sandbox identificada acima, PostgreSQL novo e Next em loopback; o feed contém
somente uma oportunidade sintética. Execute via fila npm com `PG_BIN` apontando
para binários PostgreSQL existentes e a CLI autenticada nessa conta. Ele prepara
o checkout, aguarda até 15 minutos pelo pagamento manual, verifica o fluxo e
encerra somente seus próprios serviços. Arquivos e resultado são preservados em
diretório temporário, indicado na saída. Não provisiona endpoint persistente nem
publica a aplicação.

O plugin `stripe@openai-curated` também foi instalado e habilitado; os testes acima
usaram a CLI autenticada e o SDK. A disponibilidade de ferramentas MCP não foi
confirmada nesta sessão.
