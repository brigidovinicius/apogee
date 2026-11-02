# Fluxo de conta e pagamento do Radar

Regra solicitada em 02/11/2026: cards públicos; conta autenticada para abrir uma oportunidade gratuita; outra oportunidade exige compra vitalícia de R$ 49,00. Reabrir a oportunidade escolhida continua grátis enquanto disponível. Após o ajuste da navegação direta, a primeira abertura é automática por POST ao montar a página; GET e prefetch não consomem a gratuidade.

O Radar usa `requireSignedInMember` para sessão válida, conta não bloqueada e cadastro concluído. A aprovação manual da comunidade continua em `requireMember`; Google Agenda e vínculos protegidos continuam com suas próprias verificações. O checkout exige sessão e origem confiável, preço fixado no servidor e liberação apenas após webhook assinado com pagamento confirmado. Compra por Payment Link continua exigindo comprovação do mesmo e-mail para vincular o direito.

Plano: separar os dois guardas na DAL; atualizar somente catálogo autenticado, detalhe, acesso e checkout do Radar; adaptar os testes dessas fronteiras; executar testes de conta, gratuidade, concorrência, billing, build e percurso compilado; concluir o pagamento fictício em sandbox com webhook real. Sem migração ou configuração de produção. Publicação depende de aprovação específica após os resultados.

O retorno de um pagamento ainda em confirmação oculta a opção de nova compra. A URL de retorno não concede acesso. Ao chegar o webhook, a tela consulta o direito e oferece a continuação para a oportunidade escolhida.

## Navegação direta — ajuste solicitado após a publicação

Foram removidos o aviso da primeira oportunidade e o botão de confirmação. O botão “Ver detalhes” do card aponta diretamente ao detalhe protegido, enquanto o compartilhamento preserva a URL pública. A página abre o primeiro detalhe automaticamente pela Server Action existente. Para outra oportunidade, envia automaticamente um formulário POST ao endpoint de checkout já autenticado, sem apresentar a página de oferta intermediária. O destino da oportunidade é preservado no retorno da Stripe. Sem JavaScript, há um botão de continuação em `noscript`.

A página `/membros/radar/acesso` continua tratando retorno, espera por webhook, cancelamento e comprovação de compras por Payment Link. A navegação normal a partir de um detalhe não passa por essa oferta. O teste `scripts/test-radar-stripe-sandbox.mjs --navigation-only` permite conferir no navegador a primeira abertura sem clique extra e o salto direto à Stripe, sem pagar, expirando a própria sessão de teste ao terminar.

O endpoint de checkout confere também se já existe compra paga por Payment Link aguardando comprovação do mesmo e-mail. Nesse caso, encaminha para a confirmação do e-mail, preservando o detalhe desejado, e não cria outra sessão de pagamento.

### Validação do ajuste de navegação direta

- 621 testes gerais e 19 testes de integração de billing passaram.
- Lint sem erros, mantendo apenas o aviso preexistente de imagem na galeria; tipos e build aprovados.
- Aplicação compilada em PostgreSQL novo: GET e prefetch não consumiram a escolha; Server Action abriu o primeiro detalhe; outra oportunidade entregou formulário automático de POST ao checkout, sem dados privados e sem oferta intermediária. O teste segue o redirecionamento interno de cache `_rsc` do Next 16 antes de conferir o prefetch.
- Navegador, conta nova sem e-mail verificado: o login abriu diretamente o primeiro detalhe, sem confirmação. Voltando ao Radar, um único clique em “Ver detalhes” de outra oportunidade chegou a `checkout.stripe.com`, com BRL 49,00, sem a página de oferta.
- Sessão sandbox `cs_test_a1Tp2OzlTwGjBE5BDKozUHOOsfidTvEjbLHUStXLaqJhRZw8t21XsgVDVY`: criada uma única vez, sem pagamento e expirada pelo próprio roteiro. Nenhuma cobrança real e nenhuma alteração de produção.
- Testes de regressão cobrem troca de oportunidade e mudança de abertura gratuita para compra após concorrência: o componente recebe nova identidade, evitando ficar preso no carregamento.
- Evidências e capturas em `.local/radar-direct-navigation-20261102/` do checkout desta correção.

O código de confirmação por webhook não foi alterado. A compra e liberação completas da integração anterior em sandbox estão registradas abaixo; o novo teste de navegação terminou antes do pagamento. Este ajuste ainda depende de autorização específica para publicação.

## Validação anterior — integração inicial, em 02/11/2026

| Verificação | Resultado |
| --- | --- |
| `npm test` na versão final | 618 passaram, zero falhas |
| `PG_BIN=/opt/homebrew/opt/postgresql@17/bin npm run test:billing` | 19 passaram com Better Auth, PostgreSQL descartável, assinatura real do SDK e transporte Stripe simulado |
| Testes direcionados de conta, detalhes e retorno | 12 passaram |
| `npm run lint` | Sem erros; um aviso preexistente em `components/gallery/gallery-admin.tsx:87` |
| `npm run typecheck` e `npm run build` | Passaram |
| `scripts/radar-member-e2e.mjs` com aplicação compilada e PostgreSQL descartável | Passou com cadastro novo não verificado, primeira escolha por Server Action compilada, reabertura, segunda oportunidade protegida, filtros, paginação e comunidade ainda sujeita à revisão |
| Checkout hospedado real em sandbox e webhook por Stripe CLI | Passou; cartão fictício, nenhum dinheiro real |
| `git diff --check` | Passou |

As tarefas locais de projeto foram executadas sequencialmente pela fila global do Mac. Dependências existentes foram reutilizadas com o mesmo hash de `package-lock.json`; não houve instalação, remoção de projetos ou alteração de dependências.

### Sandbox real

- Conta: `acct_1R7iAjPOeMUj2lOm`; `livemode=false`, BRL 4900.
- Sessão: `cs_test_a11kzzwrdFPX986h8yIG6gf0mYNkGT2E6TCynsaqOK343Yg2hNhWPEp5OR`.
- Evento: `evt_1UXL7MPOeMUj2lOm7yv3C9vU`, entregue às 10h17min46s de Brasília; HTTP 200.
- PaymentIntent: `pi_3UXL7LPOeMUj2lOm01rBcuPY`.
- Conta comum nova, e-mail não verificado, sem revisão manual: catálogo com dados públicos, primeira oportunidade grátis e reabertura grátis; detalhes da segunda protegidos antes de pagar.
- Retorno de cancelamento não concedeu acesso. Checkout vinculou a conta e preservou o destino da segunda oportunidade.
- Após o pagamento: uma compra persistida, acesso vitalício, papel `member` preservado, segunda oportunidade com dados completos no navegador.
- Novo pedido de checkout de quem já pagou retornou ao detalhe sem criar outro checkout. Reentrega assinada retornou 200 e manteve uma compra e um recibo.
- O acesso à comunidade continuou exigindo revisão mesmo após a compra. O calendário pessoal explicou sua condição de verificação sem impedir os detalhes do Radar.

O primeiro ensaio concluiu outro pagamento **fictício**, mas o listener local perdeu a conexão WebSocket antes da entrega. Esse resultado foi registrado como falha; não foi usado como prova de liberação. A execução acima repetiu com conexão nova e passou sem entrega manual ou alteração de direitos no banco. O roteiro agora vincula explicitamente o listener à mesma credencial sandbox usada no SDK. Nenhuma chave foi salva no repositório ou exibida.

Evidências completas, logs e captura estão em `.local/radar-payment-flow-20261102/` neste checkout. Os bancos e servidores eram exclusivos do teste, foram encerrados pelo próprio roteiro e seus arquivos temporários foram preservados. Não houve publicação, migração, configuração de produção ou cobrança real nesta correção.

## Publicação e rollback

A mudança usa o esquema existente e não exige migração ou alteração de segredos. Após aprovação específica, enviar a branch para revisão, integrar o candidato aprovado e reconstruir somente o serviço web Apogee na VPS. Registrar SHA e saúde, então conferir catálogo público, conta nova, primeira escolha, segunda oportunidade e redirecionamento ao checkout real sem concluir cobrança. O teste de pagamento com dinheiro real não está incluído.

Rollback: voltar a revisão do serviço web para o SHA anterior aprovado, preservando banco, seleções gratuitas, compras, eventos, `.env`, volumes e serviços adjacentes. O código anterior volta a exigir revisão da comunidade também no Radar; comunicar esse efeito caso o rollback seja necessário.
