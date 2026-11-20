# Página de vendas e checkout antes do cadastro

Base conferida no serviço público em 19/11/2026: `bd69442bf4b07b611df2bfc399849b9e54750ea9`.
Branch local: `feat/vendas-cta-checkout-20261119`. Não publicada.

## Escopo aprovado

O usuário pediu CTA verde com animação/profundidade, redução dos textos da oferta e dos entregáveis e clique direto no checkout. Confirmou expressamente: **checkout primeiro e cadastro depois** para visitantes. Autorizou encerrar apenas a prévia antiga da porta 3512 para liberar a fila local. Essa prévia foi encerrada; a revisão nova é temporária e encerra apenas seus próprios processos.

A oferta conserva R$ 1.438,80/ano, o equivalente mensal de R$ 119,90, cobrança integral, renovação automática, limitações da Trilha, elegibilidade dos benefícios e ausência de licenças/créditos de terceiros.

## Implementação

- CTA compartilhado no topo, oferta, Ferramentas e Trilha. Verde com relevo, um reflexo na entrada, foco visível, 56 px de altura, estados de carregamento e suporte a movimento reduzido. O papel `data-ap-button="checkout"` fica no sistema visual global.
- O formulário envia POST a `/api/comunidade/assinatura/iniciar`. Membros autenticados seguem diretamente ao checkout existente. Visitantes recebem sessão Stripe de assinatura com preço/quantidade fixos, origem verificada, limite de tentativas e cookie HttpOnly de retomada.
- A tabela aditiva `community_guest_checkout` registra a tentativa, cliente/sessão Stripe, e-mail de compra confirmado pela Stripe e eventual vínculo ao membro. A sessão aberta é reutilizada; uma sessão já concluída encaminha à ativação.
- Webhooks registram o e-mail canônico antes do cadastro. Não há concessão de acesso enquanto a compra não pertencer a uma conta.
- Retorno: `/api/comunidade/assinatura/retorno` → `/comunidade/ativar` → cadastro/entrada → `/membros/ativar-assinatura`. O ID da sessão é retirado da URL após o retorno, sem divulgação do e-mail. A página permite recuperação também sem cookie, usando o e-mail verificado da conta.
- A ativação exige sessão autenticada, conta não bloqueada e e-mail confirmado igual ao da compra. Valida novamente sessão, cliente, produto, preço, assinatura e faturas na Stripe. Só a conciliação original de pagamento concede direitos; URL de retorno, cadastro e cookie não concedem acesso.
- Vínculos antigos de cliente permanecem intactos. Cancelamento, portal e conciliação passam a reconhecer também compras feitas antes da conta. Reembolsos, disputas, fraudes e pausa de novas vendas preservam as regras existentes. A verificação exigida para áreas protegidas continua após o pagamento.
- A migração isolada não altera o journal Drizzle, para não conflitar com outras frentes em andamento. A imagem inclui o script e seu SQL.

## Validação local

- Typecheck: aprovado.
- Lint dos arquivos alterados: aprovado.
- 50 testes passaram: desenho da oferta, navegação, isolamento das rotas, assinatura existente e integração nova com PostgreSQL temporário/Stripe sintética.
- Após o último ajuste, repetidos os 28 testes diretamente afetados: aprovados.
- Visual: 320, 390, 768 e 1440 px sem overflow; dois temas; foco visível; movimento reduzido sem animação; nenhum erro JavaScript observado.
- Capturas e registros: `outputs/vendas-cta-20261119/` na raiz do checkout.
- Compilação: aprovada. Resultado final em `outputs/vendas-cta-20261119/final-validation.log`. Executada com orçamento de memória de 2 GB e um trabalhador; nenhuma imagem Docker local.
- Nenhum pagamento real, mensagem real, migração de produção, push ou deploy realizados.

## Publicação — depende de aprovação após a revisão

1. Revalidar SHA e limpeza do checkout remoto, imagem/saúde do serviço atual e mudanças concorrentes. Integrar somente esta alteração à base vigente, se houver avanço.
2. Após autorização, enviar o commit revisado e construir a imagem do serviço web correspondente. Preservar env, certificados, volumes, outros serviços e backups.
3. Conferir backup e executar `node scripts/community-guest-checkout-migrate.mjs` na nova imagem, com o ambiente operacional existente, para preflight. Executar com `--apply` somente após autorização da atualização do banco. Repetir o preflight; deve retornar sem pendência.
4. **A tabela deve existir antes de trocar o serviço web**: a conciliação/cancelamento passa a consultar os vínculos de visitantes. Não ativar código novo com esquema antigo.
5. Habilitar `COMMUNITY_GUEST_CHECKOUT_ENABLED=true`, preservando `COMMUNITY_BILLING_ENABLED` e os valores do produto/preço anual já vigentes. Não alterar preços, eventos externos, dados de membros nem configurações da Stripe.
6. Publicar apenas o serviço web no SHA aprovado. Conferir `/comunidade`, CTA em visitante e membro, destino Stripe com valor anual correto, retorno/cancelamento e saúde. Não confirmar cobrança real.
7. Confirmar que o webhook existente continua recebendo `checkout.session.completed`, `checkout.session.async_payment_succeeded` e os eventos anuais já usados. Conferir sem registrar IDs de sessão, cookies ou e-mails em evidências públicas.

## Recuperação e limites

- Para pausar vendas novas, desabilitar `COMMUNITY_GUEST_CHECKOUT_ENABLED` (visitantes) e/ou `COMMUNITY_BILLING_ENABLED` (todas). Ativação de compras anteriores e processamento de pagamento continuam operacionais.
- Após a primeira compra de visitante, não retornar cegamente à versão anterior: ela não reconhece os vínculos adicionais. Preferir manter a versão nova com vendas pausadas até uma correção.
- A compra pode ser vinculada mesmo se o webhook chegar antes do cadastro ou se o navegador for fechado. E-mail diferente deve ser corrigido entrando na conta do mesmo e-mail; nunca anexar somente por posse do cookie/URL.
- A revisão usou Stripe sintética e PostgreSQL temporário. Validação integrada com checkout Stripe e ambiente público fica para a etapa autorizada de publicação.
- Compras repetidas deliberadamente em navegadores diferentes continuam sujeitas à reconciliação de suporte; a sessão aberta no mesmo navegador é reutilizada, e membros com assinatura/pagamento em andamento não recebem nova compra.

Referências de implementação: [Stripe Checkout](https://docs.stripe.com/payments/checkout), [fluxo para clientes existentes e retorno](https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted). O retorno não substitui o processamento assinado do pagamento.
