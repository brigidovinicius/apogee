# Prompt para o próximo chat — concluir a oferta e a jornada Apogee

Copie o texto abaixo para um novo chat de implementação.

---

Quero que você conclua a implementação necessária para a oferta da Apogee funcionar de ponta a ponta: visitante → lead → conta gratuita → cliente anual → uso dos recursos → renovação/cancelamento/suporte. Não quero apenas um diagnóstico ou um plano: investigue o estado atual, prepare um plano concreto por arquivos e execute o trabalho autorizado em ambiente isolado até termos uma versão funcional, testada e pronta para revisão. Não publique nem ative cobranças reais sem minha aprovação da versão final.

## 1. Fontes e estado que você deve verificar primeiro

- Repositório: `https://github.com/brigidovinicius/apogee`.
- Workspace no Mac: `/Users/viniciusbrigido/.cline/worktrees/04981/Apogee - Site Interativo`.
- Aplicação principal: `make-it-fly-current/`.
- Leia integralmente `AGENTS.md`, `make-it-fly-current/AGENTS.md`, `docs/apogee-prd.md` e `docs/members-area-prd.md` na revisão atual.
- Leia também `docs/community-annual-access-review-20261114.md`, `docs/stripe-annual-sandbox-validation-20261114.md`, `docs/releases/community-annual-web-20261115.md`, `docs/apogee-routine-vps-deploy.md` e o relatório mais recente de Comunidade/Loja.
- Em 15/11/2026, o web publicado examinado estava em `47564aa939af063b5aaaf37bae432ca2899271af`, com cota de dez eventos e preservação de direitos antigos. A assinatura anual estava desativada. Isso é uma referência histórica: confira o SHA e a configuração atuais, sem imprimir segredos.
- A Caixa de Ferramentas já consta no PRD, mas estava apenas especificada, sem catálogo/rota no código publicado examinado. Não confunda planejamento com funcionalidade entregue.
- Existe um release de design separado neste chat, branch `release/community-store-design-20261115`, worktree `community-store-release-20261115`. Ele aplica somente o visual de Comunidade e Loja e recupera a página de vendas completa. Verifique seu resultado e SHA antes de começar; não publique sobre um deploy em andamento nem reintroduza a página de vendas simplificada do protótipo.
- A prévia antiga em `design-evolution-20261115/design-review/` era um estudo visual; o Radar dela usa dados fictícios. Ela não é backend nem fonte dos direitos ou preços.

Diferencie sempre o que existe no código, o que foi testado localmente e o que está realmente publicado. Releia os relatórios atuais antes de reutilizar conclusões antigas. Crie um worktree próprio a partir de uma base conferida, preservando alterações de outros chats.

## 2. Regras de trabalho

- Use sempre o navegador interno do Codex.
- Respeite a fila global `/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py`: uma tarefa local de projeto npm/npx/pnpm/yarn por vez. Consulte o status antes de trabalho pesado; comandos pesados via Node também entram nela. Não rode builds, testes pesados, Docker ou subagentes em paralelo e não encerre servidores de outros trabalhos sem autorização.
- Não confunda localhost com ambiente de teste: comprove a origem do banco e isole credenciais, pagamentos, emails e webhooks antes de qualquer escrita. Use contas sintéticas e banco próprio para testes.
- Não altere dados reais, direitos antigos, DNS, Caddy, configurações live da Stripe ou segredos como forma de testar.
- Preserve o visual aprovado da Apogee, sobretudo Home, Comunidade, Loja e captura do evento. Reaproveite os componentes existentes; não faça outro redesign geral. Ajustes funcionais/copy necessários devem ser pequenos e explicitados. Não mude a Home ou o restante do site por conveniência.
- Fonte de verdade de autorização e acesso é o servidor; não use flags do frontend, retorno do checkout ou armazenamento local para conceder direitos.
- Planeje arquivos, comportamentos, dados e aceite de cada lote. Execute sequencialmente, com commits claros e validação proporcional. Não adicione bibliotecas ou infraestrutura sem necessidade demonstrada.
- Faça perguntas apenas para decisões que não estejam resolvidas no PRD ou no código. Agrupe dependências reais de conteúdo e operação. Continue o trabalho independente enquanto aguarda respostas.

## 3. Oferta confirmada

1. Entrada gratuita sem cartão e sem assinatura/cobrança automática.
2. Até dez eventos distintos do Radar por conta, sem renovação automática da cota. Reabrir um evento já liberado não consome outra consulta. Listagem, busca, filtros, paginação, prefetch e leitura pelo conector não consomem consultas.
3. Acessos antigos válidos do Radar são preservados. O acesso legado ao Radar não concede automaticamente Caixa de Ferramentas, Benefícios ou Trilha.
4. Não oferecer uma nova compra avulsa do Radar. Manter histórico e conciliação das compras antigas.
5. Comunidade com contratação exclusivamente anual. Referência já aprovada na oferta: R$ 1.438,80 por ano, equivalente a R$ 119,90 por mês; não é um plano mensal nem autorização para inventar parcelamento. Reconfira condições e configuração atuais antes de ativar vendas.
6. Entregáveis: **Radar, Caixa de Ferramentas, Benefícios e Trilha**. Community é o ambiente de convivência, orientação e experiências. A trilha começa parcial; não a apresente como formação completa.
7. Caixa de Ferramentas exclusiva do direito anual vigente, organizada por categorias. Exemplo: Vídeo → Google Flow, com descrição breve e link oficial. Não inclui contas, licenças, créditos ou acesso pago de terceiros automaticamente.
8. Benefícios dependem de comprovação do acordo, elegibilidade, disponibilidade, vigência e resgate. Não crie parceiros, ingressos, valores ou créditos fictícios.
9. `/comunidade` é a página de vendas. `/evento-openai` é a captura do evento gratuito Codex Community; `/gravacao` redireciona para ela. Lead, conta gratuita, participação no evento e assinatura são estados diferentes.

## 4. Percursos públicos e de lead

Conclua e teste os percursos a partir dos componentes reais, sem duplicar formulários:

- Conteúdo/Radar → contexto do evento/oportunidade → oferta da comunidade → cadastro/login → retorno ao destino permitido.
- Evento gratuito → formulário com finalidade e consentimento claros → validação no servidor → persistência real no ambiente de teste → confirmação honesta → orientações de acesso/contato → convite opcional para conhecer a comunidade.
- O lead do evento não deve virar conta ou assinante automaticamente; não inscreva silenciosamente em outra lista. Reutilize consentimentos e registros de finalidade já existentes.
- Cadastro e login, confirmação de email, recuperação de senha, sessão e logout, com os tratamentos atuais de proteção/maioridade e de responsáveis preservados.
- Preserve a origem e o próximo passo com parâmetros seguros. Bloqueie open redirects e não coloque dados pessoais, tokens ou segredos em URLs, logs ou analytics.
- Estados de carregamento, sucesso real, erro recuperável, duplicidade, timeout e tentativa repetida devem manter o formulário utilizável e não gerar falsa confirmação.
- Emails transacionais precisam de configuração validada, conteúdo e destino corretos; use destinatários sintéticos/sandbox nesta etapa. Não envie mensagens a contatos reais para testar.

## 5. Conta gratuita, Radar e direitos

Reaproveite e confira a implementação existente antes de mudar:

- Liberação explícita no servidor e contagem transacional por conta, resistente a duas abas/requisições simultâneas, repetição e múltiplos dispositivos.
- Com nove eventos abertos e duas solicitações de novos eventos, somente uma deve completar a décima liberação.
- A décima primeira nova abertura apresenta oferta da comunidade e preserva o contexto, sem iniciar checkout/cobrança automaticamente.
- Mostrar saldo e eventos já liberados apenas ao titular. Preservar a oportunidade gratuita anterior conforme a migração documentada, sem inventar classificação para ficha ausente.
- Aplicar a mesma decisão de direitos em páginas, API/RSC e conectores ChatGPT/Claude. Listar não libera acesso e não consome saldo.
- Direitos legados e administrativos continuam independentes de assinatura; não converter contas antigas em assinantes nem exigir recompra do que já possuem.

## 6. Assinatura e jornada do cliente

Conclua o que faltar no fluxo existente, sem reescrevê-lo sem motivo:

- Oferta clara → conta autenticada e elegível → checkout anual de teste → retorno com estado pendente até confirmação confiável no servidor → conciliação → área do assinante.
- Autorizar acesso somente por fatura/assinatura válida do produto/preço corretos, vinculada à conta, no ambiente correto e no período pago. Voltar de um checkout ou ter customer não basta.
- Tratar webhooks assinados, idempotência, duplicação, eventos fora de ordem, pagamento recusado, tentativa novamente e conciliação após falha de entrega.
- Renovação paga estende o período correspondente; falha não inventa novo período. Cancelar renovação mantém o acesso até o fim do período pago. Expiração, reembolso integral, disputa e revisão de fraude seguem as regras documentadas e não retiram direitos legados do Radar. Reembolso parcial segue a regra aprovada existente.
- Área de assinatura mostra plano anual, situação, período, próximos passos e acesso ao portal correto. Não permita troca silenciosa para plano mensal ou produto diferente.
- Não crie produtos/preços live nem habilite `COMMUNITY_BILLING_ENABLED` antes de concluir os entregáveis, validar a configuração e apresentar a revisão final.

## 7. Área do membro e entregáveis reais

Organize a navegação inicial com os quatro acessos e um próximo passo útil. Confirme rotas já existentes antes de escolher nomes. Propostas, se ainda faltarem: `/membros/ferramentas`, `/membros/beneficios`, `/membros/trilha` e respectivas áreas administrativas. Preserve `/membros/assinatura`, Radar, calendário, coleções e fórum.

### Caixa de Ferramentas

- Implemente F01–F10 de `docs/members-area-prd.md`.
- Categorias e fichas com nome, descrição, URL HTTPS oficial, estado editorial e ordenação. Só publicar categorias com conteúdo publicado.
- Curadoria administrativa protegida: criar, editar, ordenar, publicar e arquivar, com validação de destino e rastreabilidade mínima.
- Links externos em nova aba, com proteção da aba de origem e sem transmitir credenciais da Apogee. Não coletar credenciais de fornecedores nem embutir execução de terceiros.
- Acesso ao catálogo e aos dados protegido no servidor, inclusive por URL direta, API e RSC. Conta gratuita ou legado apenas do Radar não recebem o catálogo privado.
- Cancelamento mantém o período pago; expiração ou suspensão do direito anual restringe o catálogo. Seu uso não altera a cota do Radar.
- Cadastre apenas ferramentas com fonte oficial conferida. Google Flow é uma referência inicial; custos/limites desconhecidos não viram rótulo de gratuidade.

### Benefícios

- Catálogo e gestão mínimos com estado, parceiro comprovado, descrição, disponibilidade, elegibilidade, vigência e procedimento real de resgate.
- Não anunciar benefício sem confirmação. Se eu ainda precisar fornecer acordos e materiais, implemente o fluxo e deixe registros não publicados/estados honestos; liste a dependência concreta para abrir vendas.
- Resgates, quando necessários à oferta confirmada, devem respeitar titularidade, limite, validade e repetição. Não invente distribuição de créditos ou integrações de parceiros.

### Trilha inicial parcial

- Estrutura mínima de trilha/módulo/atividade e gestão protegida, com conteúdo real, publicação, ordem, instruções e entregável por módulo.
- Progresso privado básico e próximo passo; links diretos devem respeitar o mesmo direito de acesso.
- Mostrar claramente módulos disponíveis, em preparação e concluídos. Não criar um LMS completo, certificação ou aulas fictícias.
- Se faltarem vídeos, textos ou materiais meus, prepare a estrutura revisável e relacione exatamente o que falta. Só use conteúdo/fonte que tenha autorização e direitos adequados.

### Convivência e suporte

- Reaproveitar fórum/canais, orientações iniciais, agenda confirmada e perfil. Identificar caminhos reais de suporte e gestão da conta.
- Não prometer mentores, encontros ou cadência ainda não confirmados. Conta paga não recebe administração automaticamente.

## 8. Ambientes, dados e operação

- Mapeie ambiente local, teste/sandbox e produção. Confirme banco, Stripe, email, callback OAuth, domínio de aplicação e segredos por presença/validade, sem exibir valores privados.
- Use banco isolado e fixtures sintéticas; migrações aditivas, repetíveis e compatíveis com o histórico real. Atualize o runner/Docker e os scripts de migração quando necessário.
- Prepare backup, ensaio de restauração e inventário de direitos para a futura migração. Não execute a migração de produção nesta autorização de implementação.
- Consumo da cota é dado funcional privado e independe de analytics. Medição de aquisição/ativação/retorno respeita consentimento e evita dados sensíveis.
- Não mudar DNS, Caddy, portas públicas, certificados, workers ou outros sistemas para viabilizar testes. `/opt/sistema-de-locacao` está fora do escopo.
- Documente configuração necessária, flags, jobs, reenvios/conciliação e suporte. Não configure envs só no código local e declare produção pronta sem verificar o ambiente proprietário.

## 9. Validação e definição de pronto

Monte uma matriz cobrindo visitante, lead do evento, conta gratuita com 0/9/10 consultas, usuário legado, assinante ativo, renovação cancelada dentro do período, expirado, reembolsado e administrador. Teste também tentativa de acesso a dados de outra conta.

- Testes de unidade/integração proporcionais, concorrência da cota, autorizações diretas, persistência real no banco isolado e eventos de cobrança em sandbox.
- Percursos no navegador interno em desktop/celular e por teclado: links/destinos, formulários, erros, retorno após login/checkout, recurso restrito, cancelamento e suporte.
- Estados vazios, conteúdo longo, carregamento, indisponibilidade e movimento reduzido; sem rolagem horizontal ou foco encoberto.
- Lint, tipos e build do SHA final; CI e revisão do diff. Não usar screenshots de mockup como prova do backend.
- Não realizar compras reais, enviar emails reais, consumir cota de contas reais nem alterar concessões para testar.

O trabalho só está completo quando os fluxos necessários funcionam no ambiente validado, os entregáveis anunciados existem ou têm sua limitação claramente tratada e a equipe consegue operar o produto. Uma estrutura vazia com CTA quebrado ou cobrança ativada antes de entregar não atende.

## 10. Como começar e o que entregar

1. Faça um diagnóstico breve com evidências: pronto e verificado / existe mas falta validar / falta implementar / depende de conteúdo ou configuração do proprietário.
2. Liste as rotas, estados de usuário, tabelas/migrações, componentes e integrações afetadas. Mostre as lacunas concretas da jornada e a ordem de implementação.
3. Execute lotes completos e revisáveis; não pare depois de apresentar o plano. Se uma dependência bloquear uma parte, continue as partes independentes.
4. Ao final, entregue a prévia funcional no navegador interno, matriz de testes com resultados, commits/PRs, PRD atualizado, mapa final das rotas e runbook de configuração/migração/rollback. Separe claramente a prontidão local das pendências de produção.
5. Apresente a versão concreta para minha revisão. Aguarde autorização explícita antes de deploy, migração com dados reais, configuração live de pagamentos ou ativação de cobrança. Não reaproveite a autorização deste chat de design para publicar o restante da plataforma.

---

Referências de 15/11/2026 são pistas para iniciar a investigação; o estado atual deve ser conferido no começo da execução.
