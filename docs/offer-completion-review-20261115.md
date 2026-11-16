# Oferta Apogee — candidato isolado para revisão

Estado: candidato funcional isolado para revisão, com prévia persistente em http://127.0.0.1:3472/previa/validacao. Sem deploy, migração real, email a contatos reais ou cobrança live. Os checks do PR são o gate da revisão final; resultados locais e sandbox estão discriminados abaixo.

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

| Perfil/cenário | Resultado observado e método |
| --- | --- |
| Visitante | Sete rotas privadas/admin encaminham para login. HTML/RSC não entregam catálogos. |
| Lead do evento e drop | Submissões reais no navegador interno; PostgreSQL confirmou um registro de cada finalidade, zero contas e zero assinaturas criadas. Painéis administrativos mostram os registros e suas datas. Falha de origem manteve os campos; nova tentativa persistiu somente após a correção local. |
| Gratuita 0/9/10 | UI mostrou saldo zero antes da abertura explícita, um após abrir o evento 01 e o mesmo um após recarregar. Conta com dez recebeu oferta no evento 11 com contexto preservado, sem checkout automático. Integração cobre décima permitida, repetição e histórico. |
| Nove + duas abas/requisições | Integração PostgreSQL concorrente permite somente uma décima liberação. |
| Legado | Integração e HTML/RSC preservam Radar, sem entregar novos catálogos. No sandbox o legado permaneceu íntegro após reembolso de outra conta. |
| Anual ativo | Sandbox real test, UI, API e banco: só a conta paga recebeu recursos; uso da Caixa/Trilha não consumiu consultas. |
| Renovação cancelada | UI real e Stripe test confirmaram cancelamento da renovação e continuidade até o fim do período pago. |
| Expirado/reembolsado/risco | Perfis de integração e HTML/RSC restritos. Reembolso integral Stripe test retirou o anual e bloqueou o catálogo por URL direta. Legado independente. |
| Administrador | UI de gestão protegida, erro de publicação sem acordo preservou o formulário e não publicou benefício. Anual não concede papel. Admin sozinho não recebe Benefícios/Trilha privados; Caixa tem prévia administrativa explicitada. |
| Outra conta/bloqueado | Integração recusa leitura/mutação alheia e payload com userId; progresso idempotente é vinculado à sessão. Contatos/admin restritos. |
| Catálogo/Trilha | Integrações reais cobrem criação, ordem, atualização, rascunho/arquivo, vigência/hierarquia, links e auditoria. UI mostrou conteúdo original longo, módulo em preparação, próximo passo e progresso 1/3 persistido em nova aba. |
| Pagamento | Compra, recusa/nova tentativa na mesma sessão, portal, cancelamento, renovação paga/falha, reembolso e eventos posteriores passaram em Stripe test. Ver relatório específico; duplicação do mesmo ID e fora de ordem são testes locais com provedor simulado. |
| Autenticação e email | Seis checks com Better Auth real, PostgreSQL próprio e toda rede de email interceptada: maioridade, cadastro sem autopromoção, verificação, origem segura, resposta indistinguível para desconhecido, expiração/uso único, hash do token, senha atualizada, revogação de sessões e logout. OAuth Google real/entrega externa permanecem gates. |
| Migração/restore | Preflight/apply/repeat, recusa de deriva/papel incorreto, backup e restauração em outro banco sintético, com contagens de direitos/progresso/auditoria preservadas. Não é ensaio sobre cópia de produção. |
| UI/acessibilidade | Navegador interno, 1440/1280 e 390 px; sem transbordamento nas telas exercitadas. Trilha longa, benefícios vazios, carregamento, erro recuperável, suporte, modal da Loja/Escape com foco de volta à peça, filtro Vídeo por teclado e conclusão/reabertura por Space. Movimento reduzido ativado e confirmado. Foco do progresso retornou ao botão visível (406–454 px no viewport 844) após ajuste. |
| Checks de código | 791 testes gerais e 39 checks de integração aprovados localmente; tipos, lint e build aprovados antes dos ajustes finais de origem/data/foco. A suíte final inclui mais duas regressões gerais e uma integração de data; CI do SHA final deve repetir todos os checks, tipos, lint e build. Lint local tem só o aviso anterior de img em gallery-admin.tsx:87. |

A matriz HTTP/RSC executou **123/123 verificações** sobre nove perfis mais visitante (`/private/tmp/apogee-offer-http-results.json`). O sandbox terminou com **20 recibos de webhook aceitos**. Não houve coleta/envio de dados de pessoas reais. Capturas mostram a UI real; a comprovação de persistência vem dos registros e testes de banco.

## Evidências e revisão

- Implementação: `78a25ad`; correções de curadoria/ordem: `949a5fe`; sandbox e autenticação: `6bf2d5e`. Caixa integrada em `db41538` e `5bc697c`, a partir dos commits do chat proprietário. Main atual `aad6704` integrada sem conflitos em `c5e48c4`; sua correção de blog foi preservada.
- Revisão estática sequencial encontrou retenção de formulário após erro e ordenação entre trilhas; corrigidas. Testes por UI localizaram e corrigiram origem localhost/127 na revisão, normalização da data dos contatos e foco do progresso.
- O aceite da origem adicional exige desenvolvimento, flag de revisão, modo test e banco loopback. Produção mantém somente os dois domínios Apogee. Não usa o Host recebido para ampliar a origem em produção.
- Prévia comum persistente, pela fila global, PostgreSQL com marcador do próprio worktree e email/pagamentos bloqueados. O dev server pode reiniciar automaticamente ao atingir seu limite de memória; o banco e a sessão permanecem. Não são necessários Docker, chave live ou dados reais para revisar.
- Durante o teste de Enter, a automação do navegador perdeu o contexto e repetiu submissões sintéticas; não se tomou isso como prova de acessibilidade. A verificação foi retomada em aba nova com Space, confirmação de persistência e foco. Limites/idempotência mantiveram um único progresso do titular. Um reinício automático de dev interrompeu uma navegação; a rota voltou e foi conferida em nova aba.
- Artefatos locais: `/private/tmp/apogee-offer-integrated-{unit,typegen,types,lint,build}.log`, `/private/tmp/apogee-offer-auth-journey.log`, `/private/tmp/apogee-offer-lead-proof.json` e relatório Stripe abaixo. Dados sintéticos e senha da prévia constam apenas na página explicitamente local.

## Pendências concretas para produção

1. Proprietário revisar o exercício inicial e definir próximos conteúdos autorizados, sem apresentar formação completa.
2. Acordos reais de benefícios com condições e capacidade de resgate; sem eles não publicar créditos/ingressos/cupons nem prometer entrega. Integração interna de resgate somente se exigida pelo acordo confirmado.
3. Designar responsáveis por curadoria, conteúdo, moderação, suporte e envio das orientações do evento; confirmar capacidade/cadência antes de prometer.
4. Verificar no provedor o domínio/entrega transacional e, no Google, audiência/callback. Os testes locais usam destinatários sintéticos/interceptação; presença no runtime não comprova entrega nem login OAuth real.
5. Configurar e validar produto/preço/portal/webhook anuais live no ambiente proprietário, sob autorização própria. Hoje estão ausentes e a flag está false.
6. Backup/inventário reais, restauração isolada, migrações 0019/0020 e deploy do SHA aprovado, cada qual com autorização. Este trabalho não altera produção.

Métodos: [runbook da oferta](offer-completion-runbook-20261115.md), [plano por arquivos](offer-completion-plan-20261115.md), [validação Stripe desta execução](stripe-annual-offer-validation-20261115.md) e [histórico anterior](stripe-annual-sandbox-validation-20261114.md). Fontes oficiais conferidas: [Google Flow](https://labs.google/fx/tools/flow), [webhooks Stripe](https://docs.stripe.com/webhooks), [testes Billing](https://docs.stripe.com/billing/testing), [portal](https://docs.stripe.com/customer-management/configure-portal).

