# Assinatura anual: apresentação e confirmação de pagamento

## Alteração preparada

A página `/membros/assinatura` apresenta as quatro entregas atuais separadamente, destaca R$ 1.438,80 por ano e mantém R$ 119,90 por mês apenas como equivalência. Informa cobrança integral, renovação anual, cancelamento da renovação e limitações da Trilha/benefícios. O direito antigo ao Radar continua independente.

O botão passa a ser “Quero fazer parte da Apogee”. A mensagem do checkout passa a informar que o acesso é liberado automaticamente após a confirmação do pagamento.

No retorno do checkout, a página consulta novamente seu estado no servidor a cada três segundos por até um minuto, somente enquanto visível. A confirmação no servidor substitui a espera pelo acesso ao destino original. Se demorar, a interface oferece consulta manual e suporte, sem incentivar pagamento duplicado. Sair da rota ou receber a confirmação encerra os temporizadores. O parâmetro `payment=received` não concede direitos e não oferece outra cobrança durante a espera.

Nenhuma alteração no handler financeiro, nas permissões, no preço, no ambiente de produção ou no banco foi necessária para essa melhoria.

## Integração em produção conferida em 16/11/2026

- Conta Stripe APOGEE, modo live. Preço ativo de 143880 centavos BRL, recorrência anual, quantidade licenciada: `price_1UcORDASpZUkiAYGoglMqOt4`; produto `prod_VdfmZCuGndzI25`.
- `COMMUNITY_BILLING_ENABLED=true`, produto/preço anuais configurados e segredos presentes. Somente indicadores/IDs foram exibidos; nenhuma credencial foi copiada para esta documentação.
- Webhook `https://www.apogee.community/api/stripe/webhook` habilitado, API `2026-09-30.endive`, com os 13 eventos processados pela integração. Inclui checkout concluído/assíncrono, assinatura criada/atualizada/excluída, fatura paga/falha/anulada/incobrável, reembolso, disputas e alerta de fraude.
- Leituras com a chave efetivamente instalada no web retornaram HTTP 200 para assinaturas, faturas, pagamentos de fatura, PaymentIntents, cobranças, disputas e alertas de fraude.
- Portal `bpc_1UcOX6ASpZUkiAYGGAyBnzwt` ativo: histórico de faturas, atualização do meio de pagamento e cancelamento ao fim do período; troca de plano desabilitada.
- Imagem web observada: `a14eda08634f6b53b019de16302ea0da26ef43d0`, saudável. Os hashes do handler financeiro e da rota do webhook no checkout dessa release coincidem com o código auditado: `235c2f629575829f2c555fca02684ba2dc4bf50ee400cd0abf0c952b0fd5743e` e `0da26b2ce121b80daf87dcf21731bd897b16939853703bb03f646009107c1dd6`.

O handler existente verifica a assinatura do webhook e relê os objetos na Stripe. Confere titular, modo, produto, preço, moeda, valor, período anual e pagamento efetivo. Eventos repetidos são idempotentes, falhas transitórias provocam nova tentativa da Stripe, e o acesso vem da fatura paga no servidor. A liberação funciona sem depender de o comprador retornar ao site. Eventos de renovação e risco mantêm o estado atualizado.

Configuração ativa e permissões de leitura não constituem prova de um pagamento real concluído. Não foi cobrado cartão, criado checkout real nem concedido acesso a contas reais nesta revisão. Não foram alterados Stripe Tax, recuperação de receita, chaves ou configurações comerciais.

Documentação oficial consultada: [Webhooks de assinaturas da Stripe](https://docs.stripe.com/billing/subscriptions/webhooks).

## Validação

- 15 testes da página, destinos de retorno, espera automática e regressão do fluxo anterior do Radar passaram, com dados sintéticos. Cobrem confirmação, retorno sem pagamento, falha, reembolso, disputa, fraude, pausa comercial, verificação da conta, suspensão de consultas em aba oculta, limite de espera e limpeza dos temporizadores.
- 15 testes de integração PostgreSQL passaram em banco descartável. Cobrem assinatura paga, repetição de eventos, assinatura inválida, isolamento entre contas, modos, períodos, falha de renovação, cancelamento, reembolso, disputa, fraude, pausa de vendas e conciliação.
- `next typegen --webpack`, `tsc --noEmit --incremental false`, lint dos dois componentes alterados e `next build --webpack` passaram. Build com perfil local de um worker pela fila global.
- O diff passou em `git diff --check`.
- O componente anterior de confirmação do Radar permanece idêntico à base; a assinatura anual tem seu próprio componente.
- Prévia de revisão: HTML estático gerado do componente real com fontes e estilos do projeto, dados sintéticos e submissão bloqueada. Não é um ambiente autenticado nem uma prova de pagamento live.
- O navegador interno bloqueou a abertura do arquivo local por sua política de URLs. A prévia HTML permanece disponível para revisão pelo proprietário, sem captura ou validação visual em navegador nesta rodada. As regras de responsividade estão implementadas, mas o teste visual no celular permanece pendente.

## Publicação

Base local: `419bfbeabf097533f629577e9b539d04dfadd14a` (`main` consultada nesta revisão). Branch `fix/annual-subscription-experience-20261116`.

O `make-it-fly-current/AGENTS.md` exige: “nenhuma nova versão, inclusive preview hospedado, seja publicada sem sua autorização explícita após revisão”. Por isso a alteração fica local para revisão antes de envio/publicação. Revalidar a revisão em produção e alterações concorrentes antes de uma implantação autorizada. Publicar somente web; nenhuma migração, ajuste da Stripe ou ativação de cobrança faz parte deste diff.
