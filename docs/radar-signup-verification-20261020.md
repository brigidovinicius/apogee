# Confirmação automática após compra do Radar

Branch: `feat/radar-signup-verification-20261020`.
Tracker: [APG-83](https://linear.app/vinicusspace/issue/APG-83/publicar-acesso-vitalicio-ao-radar-por-rdollar-4900-com-stripe).

## Comportamento

Quando uma compra paga do Payment Link já foi registrada pelo webhook, o cadastro posterior com o mesmo e-mail envia automaticamente a confirmação. O envio acontece no hook de cadastro concluído do Better Auth, tanto pela API quanto pela Server Action. Não depende de parâmetros enviados pelo navegador para identificar a compra.

A conta pode entrar na comunidade, mas o Radar continua bloqueado enquanto o e-mail não for confirmado. O formulário explica a condição. Depois do cadastro, o comprador é direcionado à orientação de confirmação, com reenvio disponível e sem outro botão de compra. O link de confirmação volta à página de acesso, que vincula a compra ao e-mail confirmado e libera o Radar.

O envio automático é restrito a uma compra `paid`, sem usuário vinculado e do mesmo modo Stripe. Não envia automaticamente para contas sem compra, compras reembolsadas ou compras de outro modo. A verificação manual existente permanece disponível. Se o provedor falhar, o cadastro e a sessão são preservados; o usuário pode solicitar reenvio. Nenhum erro imprime e-mail, token ou segredo.

Não há migração, novos segredos ou mudanças na Stripe. O preço permanece R$ 49,00, avulso e vitalício.

## Validação

Testes executados em containers internos sem acesso à rede externa na VPS. Código fonte desta branch e dependências locais foram usados em snapshot separado, sem servidor HTTP público ou publicação. PostgreSQL novo; nenhum dado de produção. O transporte Resend e as consultas Stripe são interceptados por fixtures. Better Auth, tokens, banco e regras de acesso são reais.

- `node --test --test-concurrency=1 tests/radar-billing.integration.mjs`: 18 testes passaram (17 cenários e a suíte).
- Cadastro pela API: um envio automático, destinatário correto, callback para acesso ao Radar; acesso negado antes do token e liberado após confirmação, persistindo no novo login.
- Cadastro pela Server Action: mesmo envio e redirecionamento à orientação, inclusive sem `next` do Radar.
- Falha do provedor: conta criada e Radar negado; reenvio e confirmação recuperam o acesso.
- Reembolso, modo diferente e conta sem compra: nenhum envio automático. Proteções existentes de outro e-mail, duplicação, reembolso e disputa passaram.
- Interface renderizada: exige confirmação, oferece reenvio e omite nova compra enquanto há pagamento pendente de vínculo.
- `tsc --noEmit --incremental false`: passou. ESLint dos cinco arquivos de produção alterados: passou.
- `node --test --test-concurrency=1 tests/members-google-oauth.test.mjs tests/members-validation.test.mjs tests/members-radar-entry.test.mjs`: 16 testes passaram.

Logs locais sem segredos: `/private/tmp/apogee-signup-checks-r2.log`, `/private/tmp/apogee-signup-static-checks.log` e `/private/tmp/apogee-signup-member-checks.log`. Os dois primeiros também preservam os diagnósticos corrigidos da infraestrutura de teste: arquivo de entrada do TypeScript, limite de heap e arquivo de exemplo ausente no snapshot. A suíte de integração foi executada novamente apenas após corrigir o mock de banco da Server Action; os arquivos de produção não precisaram de reparo após essa validação.
Snapshot remoto de teste: `/tmp/apogee-signup-validation-20261020`. Banco sintético preservado, containers de integração parados; containers temporários das verificações removidos. Serviços de produção preservados.

Nenhuma cobrança, pagamento novo ou e-mail externo. Entrega à caixa de e-mail não foi testada.

## Publicação

Em 20/10/2026, o usuário autorizou explicitamente push, PR, merge após CI e deploy desta confirmação automática. O resultado da publicação e a revisão exata serão registrados na APG-83 e no runbook da VPS `/opt/apogee-site/releases/20261020-signup-verification.md`. A validação remota acima foi somente teste interno do snapshot, anterior à publicação.
