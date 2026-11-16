# Rotas e direitos da Comunidade

Base examinada `73b90ff`, com correções isoladas de continuidade de contratos, edição concorrente e suporte público. O estado do candidato não prova publicação. Campos privados são autorizados no servidor antes da consulta/serialização.

## Mapa de continuidade

| Rota/superfície | Público e autorização | Ação/destino | Erro e próximo passo |
| --- | --- | --- | --- |
| `/`, `/blog`, `/blog/[slug]` | Visitante | Descoberta → Comunidade/Radar | Conteúdo existente preservado; indisponibilidade não inicia cobrança. |
| `/oportunidades`, `/oportunidades/[id]` | Prévia pública; detalhe privado exige conta | Escolher ficha → login → detalhe permitido | Ficha ausente/retirada segue política do catálogo; GET não consome. |
| `/comunidade` | Visitante | Conta gratuita ou proposta anual | Checkout depende do gate; nenhuma contratação mensal/avulsa. Retorno usa allowlist do produto. |
| `/evento-openai`, `/gravacao` | Visitante; `/gravacao` redireciona | Pedido de orientações pelo formulário real | Erro preserva campos; confirmação comprova persistência, não envio/vaga/acesso. |
| `/api/comunidade/contatos` | Origem permitida; JSON, limites, consentimento Codex | Persistir pedido separado da conta | 400/403/413/415/429/503; nova tentativa sem converter lead em conta. |
| `/loja`, `/api/loja/novidades` | Visitante; consentimento próprio de drops | Registrar interesse | Sem preço, compra, estoque ou reserva presumidos; não reutilizar leads do evento. |
| `/membros/cadastro` | Visitante | Criar conta → verificações → destino seguro | Conta duplicada/não elegível não recebe direitos; ajuda pública disponível. |
| `/membros/entrar` | Visitante; senha/OAuth existente | Sessão → destino interno permitido | Recusa preserva contexto; `safeNextPath` recusa externos, controles e formulários transitórios que causariam loops. |
| `/api/auth/*`, conclusão Google | Conta e callbacks definidos no provedor | Confirmação/reenvio/OAuth/sessão | Token vencido/usado ou provedor indisponível não concede acesso. Audiência Google e entrega externa ainda exigem conferência proprietária. |
| `/membros/esqueci-senha`, `/membros/redefinir-senha` | Público; token de uso único no fluxo próprio | Solicitar → redefinir → novo login → destino | Resposta não enumera contas; reenvio/ajuda sem login; expiração conforme configuração existente. |
| `/membros/perfil/*`, `/membros/protecao`, logout | Sessão/titular; proteção aplicável | Completar perfil/verificações ou sair | Assinatura não substitui verificações nem concede administração. |
| `/membros` | Conta elegível para convivência | Quatro recursos, fórum e gestão | Avisos de direito/preparação; cada destino repete autorização. |
| `/membros/oportunidades`, `/membros/oportunidades/[id]` | Sessão; direito completo antes da cota | Abertura intencional → transação por conta | 11º evento novo → Comunidade com destino preservado. Reabertura e leitura não cobram nem consomem. |
| `/membros/meu-calendario`, `/membros/colecoes/*` | Titular e escopos próprios | Acompanhamento/coleções | Não amplia direito de catálogo nem acessa outra conta. |
| `/membros/ferramentas` | Anual vigente; prévia administrativa explícita | Categoria → link HTTPS oficial em nova aba | Sem direito, catálogo não consultado/serializado. Categoria vazia/arquivada não aparece. |
| `/membros/beneficios` | Anual vigente | Benefício publicado e vigente → procedimento confirmado | Evidência do acordo fica só na administração. Vazio não comprova entrega comercial. |
| `/membros/trilha` | Anual vigente | Hierarquia publicada → atividade → progresso do titular | Rascunhos ocultos; preparação sem material privado; progresso repetível e sem userId do navegador. |
| `/membros/assinatura` | Sessão/titular | Plano/período → portal/cancelamento/continuação | Retorno do checkout permanece pendente até ledger canônico; atualizar estado não cria cobrança. |
| `/membros/suporte` | **Público**, inclusive falha de autenticação | Contato por email; recuperação/conta | Não depende de login; nenhuma confirmação de envio/cancelamento simulada. Operador real ainda precisa ser confirmado. |
| `/api/comunidade/assinatura/checkout` | POST, sessão, origem, elegibilidade e limite | Stripe test/live conforme ambiente autorizado | Navegador não escolhe preço/customer/quantidade. Novas vendas desligadas → 503. |
| `/api/comunidade/assinatura/{portal,cancelar}` | POST, sessão, origem, titularidade e limite | Gestão do contrato | Funciona durante pausa de novas vendas com configuração preservada; configuração inválida não redireciona arbitrariamente. |
| `/api/stripe/webhook` | Assinatura do corpo bruto e modo correto | Conciliação canônica transacional/idempotente | Falha retorna erro para reentrega; pausa de novas vendas não descarta eventos anuais configurados. |
| `/api/radar/checkout`, `/membros/radar/acesso` | Venda avulsa encerrada; gestão histórica preservada | 410 JSON ou oferta anual/contexto seguro | Não desativa confirmação/conciliação de compras antigas. |
| `/mcp`, ChatGPT/Claude | Token/escopo/titular e mesma regra de direito | Leitura/organização existentes | Listagem não libera evento; nenhuma nova ação de consumo pelo conector. |
| `/admin/comunidade`, `/admin/loja/drops` | Administração no servidor | Consultar pedidos/interesses e finalidade | Não confirma titularidade ou permissão promocional por existência do contato. |
| `/admin/{ferramentas,beneficios,trilha}` | Administração repetida nas mutações | Criar/editar/conferir/publicar/arquivar | Conflito de revisão recusa sobrescrita e preserva formulário. Evidência privada não sai na área do membro. |
| `/admin/assinaturas` | Administração; ambiente e vínculo verificados | Faturas → conciliação canônica | Sem cobrança/fatura manual; pausa de vendas não impede recuperação de contratos configurados. |
| `/previa/*` | Desenvolvimento explícito, modo test, banco loopback próprio | Revisão sintética | Guarda recusa produção, mesmo com flags de prévia. Nenhuma conta/fixture deve ser migrada. |

Nenhum fluxo leva email, telefone ou tokens de pagamento no parâmetro `next`. O token de redefinição existe apenas no fluxo específico protegido e não vira destino de retorno. O formulário de interesse não verifica identidade de conta.

## Matriz de direitos

| Perfil | Radar | Novos catálogos | Contratação/gestão |
| --- | --- | --- | --- |
| Visitante | Descoberta pública; conta para liberar | Sem conteúdo privado | Oferta e suporte públicos. |
| Lead do evento/drop | Igual a visitante, salvo conta independente | Nenhum direito automático | Pedido não é conta, assinatura ou ingresso. |
| Conta bloqueada | Sem acesso autenticado válido | Bloqueados | Ajuda pública; não alterar direito para testar. |
| Conta não verificada/sem proteção exigida | Regras de conta/participação existentes | Não contornar verificação para acessar | Não contratar antes da elegibilidade; reenvio e ajuda. |
| Gratuita 0 eventos | Dez liberações distintas disponíveis | Restritos | Sem cartão, cobrança por limite ou checkout automático. |
| Gratuita 9 eventos | Uma nova liberação; duas concorrentes permitem só uma | Restritos | Repetição não duplica consumo. |
| Gratuita 10 eventos | Reabre os dez; 11º novo apresenta oferta | Restritos | Retorno seguro ao recurso após contratação válida. |
| Seleção anterior em outra categoria | Mantém escolha única anterior, separada dos dez eventos | Restritos | Sem inventar taxonomia nem estender cota às outras categorias. |
| Seleção anterior comprovadamente evento | Conta como primeira consulta; acesso preservado | Restritos | Ausência de classificação não revoga escolha. |
| Legado/concessão administrativa/compra histórica válidos | Direito original preservado antes de aplicar cota | Legado do Radar não libera catálogos anuais | Sem recompra ou renovação imposta. |
| Anual pago vigente | Completo, sem consumo de cota | Publicados/permitidos por hierarquia e vigência | Sem papel administrativo automático. |
| Renovação cancelada no período pago | Completo até fim pago | Até fim pago | Pode consultar faturas e suporte. |
| Renovação recusada | Somente período anterior ainda vigente; depois direitos independentes | Sem extensão inventada | Portal e orientação de pendência; não criar segunda assinatura. |
| Anual expirado | Mantém liberações e legado; cota não reinicia | Restritos | Suporte/gestão disponíveis. |
| Reembolso integral/disputa/risco | Suspende origem anual conforme regra; legado permanece | Restritos quando não há outro período anual elegível | Revisão operacional de risco; não limpar marcador para testar. |
| Reembolso parcial | Período anual pago preservado | Mantidos enquanto elegível | Caixa recebido exige conciliação financeira; não usar valor cheio como líquido. |
| Administrador | Papel administrativo independente | Caixa permite prévia explícita; Benefícios/Trilha requerem direito anual para leitura como membro | Mutações administrativas protegidas. |
| Outra conta | Sem ler saldo, progresso, fatura ou contato alheio | Sem mutação por userId fornecido | Vínculo de sessão/customer/admin verificado no servidor. |

Fontes: `lib/opportunities/detail-{access,store}.ts`, `lib/billing/community-*.ts`, `lib/toolbox/*`, `lib/deliverables/*`, DAL/proxy e integrações correspondentes. Evidências por revisão no relatório final; esta tabela é especificação do comportamento, não alegação de teste de produção.
