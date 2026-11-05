# Login, compra e cards — 05/11/2026

Base: `7fc64958fa20f12560bfe2f29c86cab592176964` (`origin/main`). Branch local: `fix/purchase-login-cards-20261105`.

## Escopo e plano

Percurso: catálogo público → login/cadastro preservando oportunidade → primeira abertura gratuita → outra oportunidade → checkout de R$ 49 → confirmação por webhook → acesso. Cobrir também sessão expirada, erro/cancelamento do Google, popup bloqueado e pagamento pendente. Testes com contas e banco descartáveis, sem cobrança real.

Arquivos: fluxo e conclusão Google (`lib/members/google-login-flow.ts`, `components/members/auth-forms.tsx`, `components/members/google-login-complete.tsx`, página de conclusão); retornos de cadastro (`app/membros/actions.ts`, `app/membros/cadastro/page.tsx`); checkout e página de acesso; componentes/CSS dos cards e destaque da home; largura do detalhe e testes relacionados. Reutilizar guardas e componentes existentes, mantendo autorização e liberação do acesso no servidor. Nenhuma tabela ou dependência nova.

Direção visual: azul Apogee `#07182d`, azul claro `#b9d3ee`, superfície clara `#ffffff`, texto secundário claro `#40566e`, superfície escura `#102a48`, texto escuro `#f4f8fc`. Tipografia Inter existente, título legível sem truncamento no detalhe. Cards com categoria, instituição e título à esquerda; datas separadas das ações; consulta da fonte discreta; botão preenchido “Ver detalhes” e compartilhamento no rodapé. Espaçamento compacto e consistente, duas colunas no desktop e uma no celular. Cards e painel de autenticação acompanham a preferência clara/escura do navegador; shell mantém a marca existente.

Revisão do plano: reutiliza o vocabulário e a identidade do Radar; sem alterar hero, regras de preço, gratuidade ou revisão da comunidade. Botão de navegação mantém link HTML semântico e aparência de botão, com área de toque e foco visível.

## Diagnóstico inicial

- Login público Google com conta existente retornou à oportunidade escolhida, sem erro no console. Esse caminho não reproduziu a falha relatada.
- Checkout usa POST de formulário, mas falhas retornam JSON: expiração da sessão deixa o comprador sem continuidade.
- Callback OAuth apresenta erro apenas na janela auxiliar; a aba original só consulta a sessão e pode aguardar cinco minutos.
- Popup bloqueado encerra a tentativa sem alternativa de mesma aba.
- Cadastro com sessão existente e compra anterior aguardando verificação podem perder o destino original.
- Cards com fundo fixo, textos semitransparentes, rodapé desorganizado e link de detalhes sem tratamento de botão. Detalhe limitado a 30rem e títulos/resumo truncados como catálogo.

## Referências consultadas

- Guias locais Next 16.4.2: CSS Modules e `redirect` (incluindo substituição do histórico).
- [Broadcast Channel API](https://developer.mozilla.org/en-US/docs/Web/API/Broadcast_Channel_API): comunicação entre janelas da mesma origem, sem depender de `opener`.
- [prefers-color-scheme](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/%40media/prefers-color-scheme): preferência clara/escura.

## Validação

| Verificação | Resultado |
| --- | --- |
| Testes gerais pela fila (`npm test`) | 638 passaram, zero falhas |
| Integração (`PG_BIN=/opt/homebrew/opt/postgresql@17/bin … --command node scripts/test-radar-billing.mjs`) | 19 passaram, incluindo banco descartável, Better Auth real, assinatura Stripe, sessão expirada, falha do provedor e reentrega |
| `npm run lint` | Zero erros; aviso já existente de `<img>` em `components/gallery/gallery-admin.tsx:87` |
| Build final (`APOGEE_LOCAL_PREVIEW=1 NODE_OPTIONS=--max-old-space-size=3072 … --command npm run build`) | Compilação e TypeScript passaram |
| `git diff --check` | Passou |
| Navegador local | Senha incorreta explica o erro; login correto preserva o detalhe; primeiro detalhe abre automaticamente; um Voltar restaura o catálogo; segunda oportunidade abre Stripe sem tela intermediária |
| Google em navegador | Login existente no site público funcionou. No candidato, callback de erro e bloqueio de popup foram simulados na fronteira do provedor; UI real recebeu o erro imediatamente e manteve `next`, sem conceder sessão |
| Visual | Capturas em 1280×900 e 390×844, claro e escuro; celular sem overflow horizontal; cores dos cards confirmadas por estilo computado |

As tarefas npm/Node foram executadas sequencialmente pela fila global. Dependências reaproveitadas por link local com `package-lock.json` idêntico; sem instalação ou mudança de dependências. Os serviços e bancos de teste eram exclusivos desta validação e foram encerrados pelo próprio roteiro. Arquivos de evidência foram preservados.

### Compra real em sandbox, aplicação compilada

Conta Stripe `acct_1R7iAjPOeMUj2lOm`, modo `test`, `livemode=false`. Conta sintética nova, sem confirmação de e-mail e sem revisão da comunidade. Proxy local forneceu o cabeçalho de IP confiável, como a borda de produção; PostgreSQL novo e bridge com duas oportunidades sintéticas. Nenhuma credencial de produção foi usada.

- Sessão: `cs_test_a1xk82KXiG9QatHETLtgN1pWQSMHz71UpjekTgW5qVJ45twRhiuVLvQsDw`.
- Valor: BRL 4900, pagamento único com cartão fictício.
- Evento: `evt_1UYRSfPOeMUj2lOmmGjvfDix`, entregue pelo listener Stripe ao webhook com HTTP 200, em 05/11/2026 às 11:16:19 (Brasília).
- PaymentIntent: `pi_3UYRSePOeMUj2lOm1f43QRCy`.
- Retorno no navegador: “Seu acesso ao Radar está liberado”; “Continuar no Radar” abriu a segunda oportunidade com conteúdo protegido.
- Repetir o checkout de quem já pagou retornou ao detalhe. Reentrega assinada: HTTP 200, uma compra e um recibo. Papel continuou `member`; calendário/comunidade mantiveram suas verificações.
- Relatório final: `/var/folders/c4/8pl0mxxs3kq329jkg3n3jr8h0000gn/T/apogee-stripe-real-e2e-yxwW9y/result.json`.

O primeiro ensaio teve pagamento **fictício** e webhook HTTP 200, mas o roteiro local falhou depois por variável ausente na asserção de retorno. Não foi usado como prova de conclusão. Após corrigir o roteiro, uma execução de desenvolvimento encontrou cache/módulo inconsistente do Webpack. A execução compilada acima repetiu o percurso completo e passou. São dois pagamentos fictícios no total, nenhum dinheiro real. Esses ensaios não alteraram contas, compras ou oportunidades de produção.

Evidências locais (ignoradas pelo Git): `.local/purchase-ux-validation/`, com logs gerais, builds e capturas `cards-{light,dark}-{desktop,mobile}.png`, `login-dark-stable.png`, `login-light.png` e `payment-confirmed.png`. O roteiro local deriva do teste sandbox já existente, com navegação feita pelo navegador e proxy exclusivo do teste; não é código da aplicação. A última alteração depois da compra foi apenas a largura do botão de entrada, seguida de novo build com TypeScript aprovado.

## Publicação e rollback

Candidato somente local, sem push, PR, merge ou deploy. `AGENTS.md` exige aprovação separada após revisão: “Pedidos de alterações ou testes não autorizam publicação.” Nenhuma migração, mudança de segredo, preço, regra de gratuidade ou configuração Stripe é necessária.

Após aprovação do candidato, enviar para revisão e cumprir CI e gates de publicação do repositório; implantar somente o web Apogee. Conferir login, cards e redirecionamento público sem concluir cobrança real. Rollback: reconstruir o web no SHA anterior aprovado, preservando banco, `.env`, volumes e serviços adjacentes.
