# Navegação e compra da Comunidade Apogee

## Percursos para revisão

| Origem | Ação | Resultado esperado |
| --- | --- | --- |
| Página inicial | Conhecer a comunidade | Abre a oferta. Explorar o Radar leva direto à busca. |
| Oferta anual | Ver plano anual | Posiciona o cartão com preço integral, renovação e ação de assinatura no celular. O endereço anterior com `#planos` continua disponível. |
| Loja | Receber aviso de lançamento | Abre o cadastro de interesse no produto selecionado. |
| Radar com filtros | Entrar para salvar | Guarda o item e os filtros durante login, verificação e contratação. A gravação exige confirmação no botão de salvar. |
| Assinatura | Continuar para pagamento | Envia o formulário ao checkout da assinatura anual. A fatura confirmada pelo servidor habilita a volta ao recurso escolhido. |
| Verificação | Voltar ao resumo da assinatura | Retoma o mesmo recurso, incluindo a categoria da Caixa de Ferramentas ou a oportunidade selecionada. |

## Validação local

O build Next.js usa Webpack com `APOGEE_LOCAL_PREVIEW=1`. A suíte usa `node --test --test-concurrency=1 tests/*.test.mjs tests/community-access.integration.mjs tests/member-auth-journey.integration.mjs` dentro de `make-it-fly-current`, pela fila global do projeto. O conjunto executado teve 846 testes aprovados. O build concluiu a checagem de tipos. O ESLint passou nos componentes e rotas TypeScript alterados. As integrações utilizam PostgreSQL descartável, pagamentos sintéticos e e-mail interceptado.

No Chromium, a 390 × 844 px, o caminho Radar → oferta mostrou o preço a 227 px e o botão de assinatura a 452 px do topo do viewport. O botão recebeu o clique no centro. Com uma conta gratuita, o login e o resumo preservaram o item e o filtro. Com uma conta já paga da base sintética, a confirmação voltou ao item, o salvamento persistiu após recarregar e o link de retorno restaurou o catálogo filtrado. Uma conta pendente passou pela verificação com a categoria de ferramenta preservada. O menu da oferta abriu por clique e fechou com a tecla Escape em 360, 768 e 1280 px com preferências de cor clara e escura.

## Medição e publicação

- O painel de comportamento mostra ocorrências consentidas de preço visto, escolha do anual, conta apta, início de checkout e exibição da confirmação, por celular e desktop.
- O painel de assinaturas conta as contas com primeiro período pago elegível nos últimos 30 dias e, nesse grupo, as que salvaram uma oportunidade ou concluíram uma atividade durante um período pago. Reembolsos e disputas afetam a base elegível. A informação financeira é agregada por ambiente.
- A extensão `make-it-fly-current/sql/behavior-annual-funnel.sql` depende de `sql/behavior-daily.sql`. Deve preceder o uso das novas categorias no banco do ambiente de destino. A migração foi exercitada apenas em banco local descartável, inclusive com contagens anteriores.
- O checkout hospedado pela Stripe e os indicadores de conversão em produção exigem validação no respectivo ambiente. Esta entrega cobre a interface da Apogee, as rotas de ida e volta e o processamento sintético.
