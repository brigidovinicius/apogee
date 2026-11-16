# Operação da oferta e futura migração

Worktree: `offer-completion-20261115`, aplicação `make-it-fly-current`. Após a revisão local, o proprietário pediu a execução dos testes e o deploy se validado. A autorização abrange o candidato integrado, as migrações aditivas necessárias e a curadoria privada conferida; não inclui ativação de vendas live, envio real ou publicação do exercício editorial ainda não aprovado. Os resultados efetivos da release serão registrados separadamente.

## Ambientes conferidos

| Ambiente | Banco e serviços | Limites |
| --- | --- | --- |
| Prévia funcional | PostgreSQL nativo novo/resumido somente pelo marcador de propriedade do worktree; loopback; porta web 3472; estado `/private/tmp/apogee-offer-completion-review-state.json` modo 600. | Não lê dotenv; herda apenas variáveis de execução. Chaves Stripe vazias, email/OAuth/analytics desativados. Dados e direitos sintéticos. |
| Integrações | PostgreSQL novo por execução; diretório temporário com marcador; fixtures sintéticas e mocks explícitos de provedor. | Os testes não consultam DATABASE_URL de produção. Backup/restauração usam apenas esse cluster e suas tabelas sintéticas. |
| Stripe em teste | Script `stripe-annual-sandbox.mjs`, conta APOGEE conferida por API, chave test existente da CLI; PostgreSQL próprio e encaminhador local. | Exige flag explícita e `livemode=false`. Cria somente produto/preço/portal/clientes/assinaturas test. Sem email do aplicativo. Não reutilizar IDs de teste em live. |
| Produção observada | Container web `4dfef55`, checkout `b6810ce`, healthy/zero reinícios na conferência inicial; PostgreSQL `apogee_membros` por PgBouncer com CA de TLS montada e legível. | Somente leitura. Cobrança anual false; preço/produto/portal anuais ausentes. Nenhum dado real escrito. |

Na conferência do runtime, URL pública da aplicação corresponde a `https://www.apogee.community`; Google client/secret presentes, mas audiência e callback cadastrados no Google não foram exercitados. Email habilitado, remetente contratado e formato de chave corretos, flag de domínio verificado presente. Isso não comprova entrega na caixa de entrada nem substitui consulta ao provedor. Nenhum segredo ou conteúdo de dotenv foi exportado.

## Prévia local

Sempre consultar a fila global primeiro. A prévia contínua ocupa uma vez até seu encerramento. Não encerrar servidores de outros chats.

```sh
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py status
/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/local-offer-review.mjs
```

Abrir `http://127.0.0.1:3472/previa/validacao` no navegador interno. A página identifica contas/senha exclusivamente sintéticas. Estado persistido pertence apenas a este worktree; o marcador recusa retomar banco de outro trabalho. Antes de nova bateria pesada, encerrar somente a própria prévia, preservando o banco de revisão, e respeitar a fila.

## Curadoria

- Ferramentas: criar categoria, cadastrar ficha e link oficial HTTPS, marcar conferência, publicar e conferir como anual. Categorias vazias não aparecem. Arquivar restringe o catálogo; edições concorrentes usam versão.
- Benefícios: cadastrar como rascunho. Exigir acordo e fonte de comprovação, parceiro, descrição, elegibilidade, disponibilidade/limites, início e fim UTC (fim exclusivo), procedimento real e link opcional. Só então publicar. Fonte de comprovação não aparece ao membro. Não colocar códigos privados ou credenciais em URLs. O resgate inicial segue instruções do acordo, com validação de titularidade pelo parceiro/operador indicado. Não há distribuição de créditos, tickets ou reserva automática; acordos que exijam controle interno de resgate precisam dessa integração antes de anunciados.
- Trilha: criar trilha, módulo com entregável e atividade com instruções completas. Rascunhos ficam ocultos. Módulo em preparação mostra só nome/estado; arquivar pai restringe filhos. Atividades publicadas aceitam conclusão/reabertura exclusivamente do titular com direito vigente. A migração não publica conteúdo automaticamente. Benefícios, trilhas, módulos e atividades exigem a revisão da ficha sob trava; uma edição obsoleta é recusada, preservando os campos locais para conferência.
- Fórum/perfil/calendário/coleções continuam nas rotas existentes. Não prometer cadência, mentores ou agenda além do confirmado.
- Evento: `/admin/comunidade` registra pedidos com finalidade Codex; não confirma titularidade e não envia automaticamente. Usar somente a autorização registrada para orientar acesso. Lead não é conta/assinante. Conferir conteúdo/destino antes de qualquer envio operacional autorizado.
- Drops: `/admin/loja/drops` consulta/busca/CSV protegidos. Finalidade própria; cadastro não é compra, estoque, reserva ou assinatura. Não importar contatos do evento para essa lista.

## Futura migração com autorização própria

1. Confirmar o SHA aprovado e web efetivamente em execução; checkout pode diferir da imagem. Conferir lock de deploy, alterações remotas e serviços vizinhos. Usar o runbook Git/SSH da Apogee, sem pull/reset/clean e sem alterar ALU.
2. Inventariar contagens e fingerprints de `radar_legacy_access`, `radar_purchase`, `radar_free_opportunity`, `radar_free_event`, assinaturas/faturas e journal. Guardar dados privados apenas no ambiente autorizado, com acesso restrito.
3. Fazer backup lógico com papel apropriado e checksum. Restaurar em PostgreSQL isolado com papéis compatíveis; conferir esquema, journal e inventário. Nunca testar a restauração sobre produção.
4. Conferir hashes/ordem do histórico. Runner anual verifica 0017/0018; runner Caixa aplica 0019; runner entregas aplica 0020. São aditivos e não removem direitos. Estado parcial ou hash divergente deve ser investigado, sem forçar journal.
5. Ensaiar preflight, aplicação e repetição no banco restaurado. Comparar o inventário antes/depois. A migração 0020 cria apenas seis tabelas de entregas/progresso/auditoria e dois índices, sem cadastrar aulas ou parceiros.
6. Após o ensaio e a validação do candidato autorizado: aplicar com TLS/CA e papel `apogee_app`, usando a imagem e scripts do SHA validado. Comandos (preflight por padrão):

```sh
node scripts/community-access-migrate.mjs
node scripts/member-toolbox-migrate.mjs
node scripts/member-deliverables-migrate.mjs
# --apply somente no candidato autorizado após ensaio/backup.
```

7. Publicar somente web e validar saúde/rotas sem consumir contas reais para testar. As tabelas aditivas permanecem no rollback de código. Nunca restaurar amplamente o banco por causa de um erro de interface; preservar os novos registros.
8. A curadoria inicial usa `member-toolbox-curate.mjs`, manifesto privado por stdin e fingerprint aprovado. Conferir preflight, aplicação transacional e repetição sem alterações. Não incluir manifesto no Git, na imagem ou em logs públicos; preservar fichas existentes. Ver `toolbox-curation-runbook-20261115.md`. Não executar seed de revisão em produção.

## Cobrança e conciliação

Configuração anual: `STRIPE_MODE`, chave correspondente, webhook assinado, `STRIPE_COMMUNITY_PRODUCT_ID`, `STRIPE_COMMUNITY_ANNUAL_PRICE_ID`, `STRIPE_COMMUNITY_PORTAL_CONFIGURATION_ID`. `COMMUNITY_BILLING_ENABLED=false` permanece até revisão dos entregáveis, configuração e autorização de ativação. Preservar a configuração histórica do Radar para conciliar compras antigas.

Preço exato: 143880 centavos BRL, recurring/year, intervalo 1, quantity 1, sem plano mensal, parcelamento, trial ou preço escolhido pelo navegador. Portal dedicado: mudança de produto/plano desativada e cancelamento ao fim do período. Conta/customer/retorno do checkout não concedem direito; só ledger validado e período pago vigente. Suspensão anual não remove legado do Radar.

Webhook `/api/stripe/webhook`: assinatura do corpo bruto; eventos em `COMMUNITY_STRIPE_EVENTS`; estado Stripe canônico sob trava, recibo idempotente, transação. Falha retorna erro para permitir nova entrega. No Workbench, conferir ambiente e reentregar evento falho depois de corrigir a causa; não forjar assinatura nem marcar manualmente fatura como paga. Ver [documentação oficial de webhooks](https://docs.stripe.com/webhooks).

`/admin/assinaturas` lista apenas o ambiente configurado e oferece conciliação protegida. A operação verifica vínculo customer/conta/ambiente, consulta assinatura e todas as faturas até o limite seguro e usa o mesmo processador canônico. Não cria checkout, fatura nem cobrança; mais de 100 faturas exige revisão adicional. Pode ser repetida após falha parcial. Pausar novas vendas não interrompe webhook, portal, cancelamento nem conciliação de contratos existentes quando o serviço anual está configurado. Configuração parcial devolve erro recuperável ao webhook, sem falso recibo de sucesso. Na ausência de produto/preço anuais, a gestão continua indisponível. Sem assinatura local, reentregar o evento original pelo webhook para estabelecer o vínculo correto.

Expiração é avaliada a cada leitura por período; não precisa de job para retirar acesso. Renovação não paga não cria período. Cancelamento preserva período pago. Reembolso integral/disputa suspendem a origem anual; parcial mantém o período. Alerta de fraude exige revisão operacional documentada; não limpar o marcador de risco apenas para restituir acesso ou testar. Não há job novo nem processo de envio adicionado nesta entrega.

Suporte público em `/membros/suporte` usa `contato@apogee.community`, já informado nos termos, e permanece acessível sem sessão ou durante falha de autenticação. Antes de atender, confirmar titularidade proporcionalmente; nunca solicitar senha, token ou cartão completo. Falha de email deve ser tratada no provedor sem falsa confirmação de entrega. Responsáveis, conteúdos comerciais e acordos ainda precisam de confirmação do proprietário.

## Rollback

Manter imagem anterior e SHA aprovado, voltar somente web conforme `apogee-routine-vps-deploy.md`. Manter 0019/0020 e registros recebidos; nenhuma migração reversa destrutiva está prevista. Se o catálogo precisar sair temporariamente, arquivar seus registros pelo administrador autorizado ou restaurar o código anterior, sem alterar concessões antigas. Cobrança continua em gate separado. Registrar SHA, resultado e limitações.
