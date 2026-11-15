# Oferta Apogee — candidato isolado para revisão

Estado: implementação em validação. Este documento será fechado com resultados reais; itens pendentes não contam como aprovação. Sem deploy, migração real, email a contatos reais ou cobrança live.

## Alterações e limites

- Base conferida no início: imagem web `4dfef55`, checkout VPS `b6810ce`; design completo aprovado preservado. Main `4f1d6ad` integrada sem substituir a página de vendas pela versão simplificada.
- Caixa de Ferramentas integrada de `b2f63d7`, com 0019, categorias/fichas/curadoria e acesso anual no servidor. O lote de origem tinha 786 testes gerais, 10 integrações próprias, 12 anuais e build aprovados; isso é evidência do lote anterior, não substitui a validação integrada atual.
- Benefícios, Trilha parcial, progresso privado e curadoria adicionados com 0020. Nenhum parceiro, crédito, cupom ou aula fictícia. Exercício original de três atividades disponível apenas no banco de revisão, pendente de aprovação editorial para publicar.
- Área interna tem quatro destinos reais, mantendo fórum, perfil, Radar, calendário, coleções e assinatura. Suporte reutiliza o canal informado nos termos.
- Operação anual lista o ambiente configurado e permite conciliação protegida por consulta canônica de assinatura/faturas. Não cria cobranças. Vendas e conciliação continuam desligadas na prévia comum e na produção observada.
- Funil mantém finalidade e consentimento separados de evento e drops. A confirmação do evento distingue persistência de envio manual. A prévia funcional deixou de simular sucesso do formulário público.
- Retorno permitido entre oferta/login/assinatura/recursos preservado sem open redirect ou query arbitrária. Pequenas mudanças de texto/navegação funcional; Home, estilos globais, fotos da Loja e composição pública aprovada preservados.

## Mapa de rotas

| Rota | Público/ação | Autorização e estado |
| --- | --- | --- |
| `/`, `/blog`, `/oportunidades` | Descoberta e conteúdo. | Público; descoberta/lista/prefetch não consomem a cota. |
| `/oportunidades/[slug]` | Contexto e login/retorno. | DTO público; detalhe privado depende do servidor. |
| `/comunidade` | Oferta anual e entrada gratuita. | Público; R$ 1.438,80/ano, R$ 119,90 somente equivalente. Billing false não abre venda. |
| `/evento-openai`, `/gravacao` | Pedido de orientações do Codex Community; redirect 308. | Consentimento específico; lead não vira conta ou assinante. |
| `/api/comunidade/contatos` | Gravar lead. | Origem, limite, payload e consentimento validados; duplicidade preserva evidência original. |
| `/loja`, `/api/loja/novidades` | Peça indisponível/interesse no drop. | Finalidade própria; sem compra, reserva, estoque ou prazo inventado. |
| `/membros/cadastro`, `/membros/entrar` | Conta e sessão. | Autenticação/proteção existentes; retorno interno validado. |
| `/membros/esqueci-senha`, `/membros/redefinir-senha` | Recuperação transacional. | Token temporário protegido, sem analytics/log de token; envio de teste interceptado. |
| `/membros` | Quatro recursos e fórum. | Conta elegível; papéis e direito anual separados. |
| `/membros/oportunidades`, `/membros/oportunidades/[id]` | Radar e ação explícita de liberar. | Cota transacional, legado/admin/compra histórica/anual preservados. |
| `/membros/ferramentas` | Catálogo por categoria. | Anual vigente ou prévia administrativa explícita; gratuito/legado não recebem DTO privado. |
| `/membros/beneficios` | Condições e resgate externo/instruções. | Anual vigente; somente publicados na vigência. Sem acordo há estado indisponível honesto. |
| `/membros/trilha` | Módulos/atividades e progresso. | Anual vigente; publicação em toda a hierarquia; mutação só do titular. |
| `/membros/assinatura` | Situação, período, faturas e cancelamento. | Conta autenticada; pagamento só por confirmação canônica. |
| `/membros/suporte` | Canal e orientação de conta. | Conta autenticada; sem prometer SLA não confirmado. |
| `/api/comunidade/assinatura/{checkout,portal,cancelar}` | Intenções de cobrança/gestão. | POST, sessão, origem, elegibilidade, limites e configuração correspondente ao ambiente. |
| `/api/stripe/webhook` | Conciliação de eventos assinados. | Corpo bruto, assinatura, modo, preço/produto/vínculo/período; idempotência e estado canônico. |
| `/api/radar/checkout` | Nova compra avulsa encerrada. | 410 JSON ou encaminhamento seguro à comunidade; histórico preservado. |
| `/mcp`, integrações ChatGPT/Claude | Leitura conforme escopo e direito. | Sem liberação/consumo por listagem; mesma decisão de acesso do Radar. |
| `/admin/{ferramentas,beneficios,trilha}` | Curadoria e publicação. | Administração no servidor, repetida na mutação; assinatura não concede papel. |
| `/admin/assinaturas` | Períodos, faturas e conciliação. | Administração, ambiente/vínculo verificados; bloqueada pela configuração anual desativada. |
| `/admin/comunidade`, `/admin/loja/drops` | Operação dos interesses. | Contatos somente para administrador; finalidade e evidências preservadas. |
| `/previa/validacao` | Roteiro e contas sintéticas. | Apenas revisão explícita em desenvolvimento e banco loopback; não exposta em produção. |

## Matriz e resultados

| Perfil/cenário | Esperado | Resultado atual |
| --- | --- | --- |
| Visitante | Login antes de dados privados; descoberta sem consumo. | Pendente no candidato integrado. |
| Lead do evento | Persistência e finalidade; nenhuma conta ou assinatura criada. | Pendente no candidato integrado. |
| Gratuita 0/9/10 | Saldo próprio, décima permitida, décima primeira nova bloqueada; reabrir sem consumo. | Pendente no candidato integrado. |
| Nove + duas abas | Apenas uma décima liberação. | Pendente no candidato integrado. |
| Legado | Radar preservado; outros catálogos não concedidos. | Pendente no candidato integrado. |
| Anual ativo | Radar e novos recursos, sem consumir saldo. | Pendente no candidato integrado. |
| Renovação cancelada | Manter recursos até fim pago. | Pendente no candidato integrado. |
| Expirado/reembolsado/risco | Retirar somente origem anual; preservar legado. | Pendente no candidato integrado. |
| Administrador | Gestão e prévia permitidas; assinatura não cria papel. | Pendente no candidato integrado. |
| Outra conta/bloqueado | Sem ler/gravar progresso, histórico ou contatos alheios. | Pendente no candidato integrado. |
| Catálogo/Trilha | Rascunhos ocultos, vigência/hierarquia, erros recuperáveis e progresso idempotente. | Pendente no candidato integrado. |
| Pagamento | Checkout sandbox, assinatura correta, pending, webhook, renovação, recusa, cancelamento e conciliação. | Histórico validado em 14/11; repetição atual pendente. |
| Migração/restore | Preflight/apply/repeat, recusar deriva e preservar inventário. | Pendente no candidato integrado. |
| UI/acessibilidade | Desktop/celular/teclado, overflow, foco, movimento reduzido e estados vazios. | Pendente no candidato integrado. |
| Lint/tipos/build/CI | Aprovação da revisão final exata. | Pendente no candidato integrado. |

## Pendências concretas para produção

1. Proprietário revisar o exercício inicial e definir próximos conteúdos autorizados, sem apresentar formação completa.
2. Acordos reais de benefícios com condições e capacidade de resgate; sem eles não publicar créditos/ingressos/cupons nem prometer entrega. Integração interna de resgate somente se exigida pelo acordo confirmado.
3. Designar responsáveis por curadoria, conteúdo, moderação, suporte e envio das orientações do evento; confirmar capacidade/cadência antes de prometer.
4. Verificar no provedor o domínio/entrega transacional e, no Google, audiência/callback. Os testes locais usam destinatários sintéticos/interceptação; presença no runtime não comprova entrega nem login OAuth real.
5. Configurar e validar produto/preço/portal/webhook anuais live no ambiente proprietário, sob autorização própria. Hoje estão ausentes e a flag está false.
6. Backup/inventário reais, restauração isolada, migrações 0019/0020 e deploy do SHA aprovado, cada qual com autorização. Este trabalho não altera produção.

Métodos: [runbook da oferta](offer-completion-runbook-20261115.md), [plano por arquivos](offer-completion-plan-20261115.md), [validação Stripe histórica](stripe-annual-sandbox-validation-20261114.md). Fontes oficiais conferidas: [Google Flow](https://labs.google/fx/tools/flow), [webhooks Stripe](https://docs.stripe.com/webhooks), [testes Billing](https://docs.stripe.com/billing/testing), [portal](https://docs.stripe.com/customer-management/configure-portal).


## Ponto de retomada da validação

- Código do candidato: `78a25ade3ca868a8450ae1bbd498eac8b420c7ed`. Caixa integrada em `db41538` a partir de `b2f63d7`. Nenhum push/PR novo foi feito ainda.
- O teste `member-deliverables.integration.mjs` está aguardando a fila FIFO, ordem 2097; ainda não há resultado de teste integrado, lint, tipos, build ou UI desta revisão. O supervisor da própria tarefa é 11501. Não terminar processos sem resolver a autorização indicada pela revisão automática.
- A fila está ocupada pela prévia 3461 de outro chat (supervisor 10836, ordem 2095), seguida por um trabalho do Radar. O chat proprietário foi avisado e prepara um commit posterior de correção da key dos formulários administrativos. A última informação foi que sua revisão no navegador aguardava aprovação.
- Foi solicitada autorização explícita ao usuário para encerrar temporariamente essa prévia, preservando seu banco. Não foi recebido nesta execução um texto de resposta que autorize essa ação.
- A tentativa de retirar somente o próprio teste aguardando foi rejeitada pela revisão automática, que interpretou a regra de encerramento de processos como exigência de autorização também nesse caso. Nenhum processo foi encerrado. Uma alternativa é deixar o teste terminar normalmente após a fila ser liberada.
- Disco medido em aproximadamente 134 MiB livres. Não foram apagados projetos, caches, dependências, bancos, worktrees ou históricos. Preferir build final no CI e reavaliar espaço antes de criar o cluster de testes e a prévia.
- Credencial Stripe test existente autenticou por GET somente leitura na conta esperada. CLI instalada 1.34.0, script adaptado para detectar suporte ao argumento events-from. Nenhum recurso Stripe novo foi criado nesta execução.
- Próximos passos: integrar a correção posterior da Caixa, executar teste novo/anuais/caixa/unidade/tipos/lint em sequência, resolver falhas, ensaiar sandbox de cobrança, validar UI desktop/celular/teclado no navegador interno, completar matriz, abrir PR e conferir CI do SHA final. Somente então apresentar como versão pronta para revisão.
