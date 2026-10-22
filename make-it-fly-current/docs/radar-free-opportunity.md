# Radar: uma oportunidade detalhada gratuita por conta

## Regra do produto (APG-85)

- Cards informativos continuam públicos, inclusive na home.
- Ver detalhes exige uma sessão válida e preserva a oportunidade no retorno do login.
- O primeiro detalhe é aberto por uma confirmação explícita com POST. GET, pré-carregamento e navegação pelo catálogo não gastam o acesso.
- A conta escolhe uma única oportunidade, sem prazo de renovação da gratuidade. Reabrir a mesma oportunidade não consome outro acesso enquanto ela estiver vigente no catálogo.
- Uma segunda oportunidade distinta direciona para a compra do pacote vitalício existente: R$ 49,00, pagamento único. O retorno do checkout preserva o detalhe selecionado; só um direito confirmado no servidor libera o conteúdo.
- Direitos Stripe, administrativos e legados existentes continuam válidos. O acesso gratuito não concede direito ilimitado nem muda o papel da conta.
- Uma linha por conta, com chave primária e trava transacional, resolve cliques simultâneos de dispositivos distintos.
- Requisitos, custos, notas e URL oficial ficam fora dos dados enviados aos cards públicos ou ao catálogo de membros. A seleção/filtro ocorre no servidor antes de remover esses campos.

## Arquivos e fluxo

`lib/opportunities/card-data.ts` define a lista explícita de campos públicos; `access.ts` aplica a projeção na home e nos catálogos. `detail-access.ts` autentica, valida a oportunidade vigente e resolve o direito; `detail-store.ts` persiste a escolha. A rota `/membros/oportunidades/[id]` apresenta o detalhe autorizado ou a confirmação gratuita. A server action repete a autorização antes de gravar. A página de compra e a API de checkout aceitam somente retorno interno de detalhe.

## Migração e publicação

Entrega local. Nenhuma autorização de publicação ou alteração de produção foi dada nesta tarefa.

A migração `0007_radar_free_opportunity.sql` deve ser aplicada antes de publicar o código, após backup restaurável e autorização específica para banco e deploy. O script `npm run radar:free:migrate` aceita apenas o histórico exato das migrações 0000 a 0006 ou o estado completo já migrado. Divergência de histórico/esquema aborta a operação. Não execute automaticamente contra produção.

Rollback de código não exige apagar a tabela; preserve as escolhas já registradas. A tabela não altera compras nem permissões existentes.

## Validação

Os testes `radar-detail-access.test.mjs` cobrem login, primeira escolha, reabertura, segunda oportunidade, autorização prévia, dados públicos e retorno seguro. A suíte `radar-billing.integration.mjs` também verifica concorrência real no PostgreSQL, migração idempotente, conta bloqueada, isolamento por usuário e compra posterior. O runner `scripts/test-radar-billing.mjs` cria e encerra seu próprio cluster local, usa dados fictícios e não envia emails ou pagamentos reais.

### Resultado local — 20/10/2026

- Suíte geral: 455/455 testes aprovados, com Node 22 e concorrência de teste igual a 1.
- Integração de billing/PostgreSQL: 19/19 testes aprovados em cluster novo e isolado. Confirmados limite concorrente, reabertura, isolamento por conta, compra posterior, retorno/cancelamento do checkout e migração idempotente. Stripe e email usam provedores fictícios; nenhum envio ou pagamento externo ocorreu.
- Typecheck e build Next.js 16.3.8: aprovados; `/membros/oportunidades/[id]` consta como rota dinâmica.
- Lint: sem erros; permanece o aviso pré-existente de imagem em `components/gallery/gallery-admin.tsx`.
- `git diff --check`: aprovado. Nenhuma alteração em Make It Fly.
- Sem push, PR, CI remoto, migração de produção, deploy ou validação autenticada no site público. A migração e o deploy continuam como gates separados.
