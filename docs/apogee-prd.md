# Apogee — PRD geral da plataforma

- **Versão:** 0.6 · 15 de novembro de 2026
- **Estado:** deploy das alterações anteriores autorizado, sujeito ao preflight operacional; caixa de ferramentas incluída no planejamento e aguardando revisão antes de implementar.
- **Horizonte:** novembro de 2026 a março de 2027.
- **Responsável pela decisão de produto:** Vinicius.
- **Base técnica examinada:** `d6a422d8207cb04eefe9819c082f948dc5a4de30`, branch principal em 14/11/2026.

Este PRD consolida a oferta, as jornadas e as prioridades gerais da Apogee. O PRD do Radar permanece como especificação especializada do catálogo e da coleta. O [PRD da área interna de membros](members-area-prd.md) detalha a nova caixa de ferramentas. O documento distingue decisões confirmadas, propostas para revisão e dependências. Em 15/11/2026 o proprietário autorizou o deploy das alterações anteriores e pediu planejamento da caixa de ferramentas antes de implementá-la. Autorização e publicação concluída são estados distintos.

## 1. Decisões confirmadas em 14/11/2026

| ID | Decisão do proprietário | Consequência para o produto |
| --- | --- | --- |
| D01 | Manter a entrada gratuita. | Descoberta e primeiro contato com a Apogee continuam acessíveis sem assinatura. |
| D02 | Preservar os acessos antigos do Radar. | A nova oferta não reduz direitos existentes nem exige nova compra para mantê-los. |
| D03 | Retirar, por ora, o valor avulso do Radar. | A comunicação e os novos percursos comerciais deixam de oferecer o Radar como compra separada. |
| D04 | Fazer o CTA para a comunidade, com o Radar incluído. | A comunidade é o destino comercial da jornada. O Radar completo integra a assinatura, respeitando também direitos antigos. |
| D05 | Oferecer até 10 consultas gratuitas de eventos. | A conta gratuita pode liberar os detalhes de até 10 eventos distintos. |
| D06 | Contar eventos distintos por conta, sem renovação automática; reabrir o mesmo evento não consome outra consulta. | A cota é compartilhada entre dispositivos e não se reinicia a cada mês, dia ou sessão. |
| D07 | Apresentar primeiro o PRD para revisão. | As páginas e regras de produção entram na etapa posterior à revisão deste documento. |
| D08 | Disponibilizar a assinatura da comunidade somente anualmente. | Retirar a opção mensal da oferta e da prévia; manter a entrada gratuita. Esta decisão substitui a periodicidade mensal do planejamento estratégico. |
| D09 | Incluir uma caixa de ferramentas dentro da área de membros, com links por categorias, como Vídeo > Google Flow. | Especificação detalhada no PRD da área interna; apresentar planejamento antes de implementar. Decisão de 15/11/2026. |
| D10 | Disponibilizar a caixa de ferramentas somente para assinantes anuais. | Exigir direito anual vigente no servidor; o acesso antigo ao Radar permanece independente. Decisão de 15/11/2026. |
| D11 | Oferecer Radar, Caixa de ferramentas, Benefícios e Trilha; a trilha ainda não estará completa. | A área interna deve identificar os módulos já disponíveis e o estado parcial da trilha. Benefícios e conteúdos concretos ainda precisam ser informados; não apresentar o planejamento como entrega concluída. Decisão de 15/11/2026. |

Os demais preços, eventos e benefícios do documento estratégico permanecem como referências de planejamento, nas condições indicadas neste PRD.

## 2. Problema, visão e proposta de valor

Pessoas interessadas em IA, carreira e projetos encontram informações, ferramentas e oportunidades em muitos canais, mas precisam de ajuda para escolher um próximo passo e colocá-lo em prática. A comunicação atual da Apogee distribui comunidade gratuita, cursos separados e acesso próprio ao Radar em percursos diferentes, dificultando entender a oferta integrada.

A Apogee conecta pessoas a conhecimento, ferramentas, networking e oportunidades para que consigam construir mais. O produto principal pretendido é uma comunidade por assinatura dentro de uma plataforma, com entrada gratuita e quatro pilares: **Radar, Learn, Perks e Community**.

**Proposta de valor:** acesso contínuo a conhecimento aplicável, oportunidades relevantes e pessoas com quem construir projetos, melhorar a rotina e avançar na carreira ou nos negócios.

**Princípio de experiência:** ajudar a pessoa a fazer algo novo nos primeiros sete dias e encontrar um motivo concreto para voltar na semana seguinte.

## 3. Público inicial

O recorte inicial proposto atende adultos que querem aplicar IA em tarefas reais e conectar o aprendizado a projetos, carreira ou pequenos negócios. O segmento prioritário de aquisição ainda deve ser validado com clientes. O recorte comercial preserva a abrangência do Radar e as regras de conta, proteção e participação existentes.

| Perfil | Necessidade | Primeiro resultado pretendido |
| --- | --- | --- |
| Pessoa começando com IA | Encontrar um uso acessível e relevante. | Concluir uma tarefa real com apoio de IA. |
| Profissional, criador ou empreendedor | Transformar uma ideia em entrega. | Criar material, processo ou protótipo utilizável. |
| Pessoa buscando oportunidades | Entender elegibilidade, prazo e próximo passo. | Identificar um evento ou oportunidade e saber como agir. |
| Membro atual do Radar | Entender a nova oferta e manter seus direitos. | Continuar usando o acesso adquirido e conhecer os demais pilares. |

Pagamento ou assinatura não substituem verificações de conta, maioridade ou permissões de participação. Este PRD não modifica automaticamente o tratamento de menores e responsáveis.

## 4. Objetivos e limites

### Objetivos

1. Apresentar uma oferta compreensível de comunidade com os quatro pilares e condições coerentes em toda a jornada.
2. Permitir a descoberta gratuita e até 10 consultas de eventos distintos por conta, com contagem confiável e visível.
3. Preservar os acessos antigos válidos do Radar durante a transição, com zero perda de direito causada pela migração.
4. Entregar um primeiro resultado prático em sete dias e medir o retorno na semana seguinte.
5. Buscar 50 assinantes pagantes até 30/11/2026 e 2.000 até 31/03/2027, como metas estratégicas sujeitas à validação do produto e da aquisição.

### Limites desta entrega documental

A revisão documental, a prévia das páginas e a validação Stripe de teste foram apresentadas. O proprietário autorizou em 15/11/2026 o deploy das alterações anteriores. A execução continua dependente da conferência da revisão, histórico de migrações, preservação de direitos, backup e configuração correta de produção. A caixa de ferramentas entra somente como planejamento nesta versão; sua implementação aguarda revisão.

### Fora do primeiro lançamento proposto

- Marketplace de parceiros, carteira própria de créditos e distribuição de credenciais de ferramentas.
- LMS completo, certificação, gamificação e recomendação avançada por IA.
- Garantia de emprego, bolsa, aprovação, renda ou resultado de candidatura.
- Reestruturação de loja, Make It Fly ou coletor do Radar sem requisito específico.
- Divulgação de benefícios, datas, locais, mentores ou parcerias ainda não confirmados.

## 5. Arquitetura da oferta

### Entrada gratuita

- Conteúdo público, blog e descoberta do catálogo.
- Entrada gratuita da comunidade, com canal e instruções efetivamente disponíveis.
- Até 10 eventos distintos consultados em detalhe por conta, conforme a seção 6.
- Experiências gratuitas de campanhas próprias, segundo suas condições, como o evento Codex Community.
- Convite para conhecer a assinatura da comunidade em momentos apropriados da jornada.

O cadastro gratuito não cria assinatura paga, não exige cartão para usar a cota e não gera cobrança ao atingir o limite. Participação em grupo, conta na plataforma e inscrição em evento devem ser explicadas como ações com finalidades e permissões próprias.

### Comunidade por assinatura

Uma assinatura reúne os quatro pilares e inclui acesso completo ao Radar. A oferta deve identificar as trilhas, os recursos e as atividades disponíveis na contratação. Benefícios de parceiros e experiências presenciais têm disponibilidade e condições específicas.

| Condição comercial | Estado nesta revisão |
| --- | --- |
| Comunidade: contratação exclusivamente anual. | Periodicidade confirmada pelo proprietário em D08. |
| Preço anual proposto: R$ 1.438,80/ano, equivalente a R$ 119,90/mês. | Mantém a referência já apresentada; valor mantido na prévia aprovada. A implementação local prevê cobrança integral anual, renovação automática e cancelamento da renovação ao final do período pago; estas condições operacionais entram na validação antes de vender. Não foi implementado parcelamento. O equivalente mensal não constitui uma opção de contratação mensal. |
| Valor avulso do Radar. | Retirado da nova oferta por D03; nenhum novo preço avulso é definido. |
| Cursos adicionais vendidos à parte. | Pendente. As trilhas incluídas na assinatura e eventuais ofertas adicionais precisam ser identificadas. |
| Ingressos de experiências para assinantes. | Inclusão, capacidade, reserva, prioridade e eventuais custos pendentes. |

O cenário estratégico de 2.000 membros a R$ 119,90 corresponde a R$ 239.800 mensais normalizados, antes de deduções. É uma hipótese de composição de receita, não receita atual, previsão de caixa ou resultado comprovado.

## 6. Radar: regra confirmada das 10 consultas gratuitas

### Unidade, período e acesso

1. Cada conta gratuita pode liberar detalhes de até **10 eventos distintos**, sem renovação automática da cota.
2. O evento corresponde à ficha/edição estável do catálogo. Atualizar a mesma ficha não cria nova consulta; uma edição realmente distinta é outro evento.
3. Reabrir um evento já liberado não consome consulta, inclusive em outro dispositivo ou sessão.
4. A décima consulta distinta é permitida. A tentativa de liberar o décimo primeiro evento apresenta o CTA da comunidade.
5. Sair da conta, trocar de navegador ou limpar armazenamento local não reinicia o saldo.
6. A regra confirmada refere-se a eventos. Esta cota não se estende a bolsas, cursos, editais e carreira. Para preservar o comportamento anterior, essas categorias continuam com a escolha gratuita única existente, separada dos 10 eventos; eventual ampliação depende de decisão própria.

### Comportamento funcional proposto

- Listar, pesquisar, filtrar, paginar e visualizar prévias não consome cota.
- O consumo acontece quando uma ação intencional libera os detalhes de um evento válido e o servidor confirma a liberação. Login e retorno preservam o destino escolhido.
- Pré-carregamento de links, rastreadores e solicitações que falham antes da liberação não consomem consulta.
- Saldo e liberação usam uma regra consistente no servidor. Solicitações simultâneas não excedem 10 eventos nem contam duas vezes o mesmo evento.
- Atingir a cota não retira acesso aos eventos já liberados, respeitando o estado e a disponibilidade do catálogo.
- Encerramento ou retirada posterior de uma ficha segue a política do catálogo, sem reposição automática de cota ou promessa de histórico permanente.
- Uma ficha em várias categorias conta uma única vez. A classificação como evento deve usar a taxonomia validada, com tratamento explícito para competições que também sejam eventos.
- A interface mostra o saldo, por exemplo: “Você consultou 3 de 10 eventos gratuitos”, sem expor o histórico de outra conta.
- Conectores ChatGPT/Claude respeitam os mesmos direitos. Listagens e prévias não liberam novas consultas automaticamente. Eventos já liberados podem ser lidos conforme as permissões existentes; eventual liberação pelo conector exige desenho e revisão próprios.

### Depois do limite

O próximo passo comercial é **“Conhecer a Comunidade Apogee”**, com destino à oferta que explica a entrada gratuita e a assinatura com Radar incluído. A jornada preserva o evento de interesse para permitir retorno após a liberação do acesso.

O bloqueio não abre checkout automaticamente, não vende o Radar avulso e não cobra excedentes. Entrar no grupo gratuito não elimina o limite; o Radar completo depende de direito antigo válido ou assinatura elegível.

## 7. Matriz de acesso e preservação dos direitos antigos

| Situação | Descoberta pública | Detalhes de eventos | Radar completo | Demais pilares pagos |
| --- | --- | --- | --- | --- |
| Visitante sem conta | Disponível. | Cadastro/login para usar a cota proposta. | Oferta da comunidade. | Prévia e condições da oferta. |
| Conta gratuita, sem direito completo antigo | Disponível. | Até 10 eventos distintos; reabertura dos já liberados. | Pela assinatura elegível. | Apenas entregas explicitamente gratuitas. |
| Acesso antigo válido ao Radar | Disponível. | Conforme o direito existente, sem impor a nova cota. | Preservado conforme a concessão original. | O acesso antigo ao Radar não concede automaticamente novos pilares pagos. |
| Assinatura elegível e ativa | Disponível. | Incluídos no Radar completo. | Incluído. | Conforme o pacote e as condições de cada entrega. |
| Assinatura encerrada e direito antigo válido | Disponível. | Mantém o direito antigo. | Preservado conforme a concessão original. | Conforme o término efetivo das condições da assinatura. |

Requisitos da transição:

- Verificar direitos antigos antes de aplicar a cota ou oferecer assinatura para liberar o Radar.
- Manter separadas as origens de direito: concessão anterior, compra histórica, liberação gratuita e assinatura.
- Preservar a ficha gratuita já liberada na regra anterior. Definir antes da migração sua participação na contagem, sem revogar esse acesso.
- Retirar a venda avulsa dos novos percursos na implementação posterior e conservar histórico, conciliação e tratamento de compras anteriores ou em processamento.
- Não converter compradores antigos em assinantes nem criar renovação ou cobranças futuras automaticamente.
- Manter regras vigentes de segurança, bloqueio, reembolso e contestação aplicáveis à origem de cada direito. A mudança de posicionamento não revoga acesso.
- Separar papel de membro/administrador dos direitos de produto. Comprar assinatura não concede administração nem substitui verificações de conta.

## 8. Os quatro pilares

| Pilar | Entrega inicial proposta | Condição para anunciar como disponível | Evolução |
| --- | --- | --- | --- |
| **Apogee Radar** | Catálogo atualizado, busca, filtros e detalhes; acompanhamento conforme condições da conta e do pacote. | Serviço e permissões operacionais; cota, direitos antigos e assinatura coerentes. | Alertas por perfil e recomendações mais relevantes. |
| **Apogee Learn** | Trilha de IA aplicada, inicialmente parcial, com módulos e entregáveis efetivamente disponíveis identificados. | Conteúdo acessível e revisado; estado parcial claramente informado. A decisão D11 substitui a hipótese anterior de três trilhas completas no lançamento. | Progresso, novos módulos e desafios por área. |
| **Apogee Perks** | Catálogo simples dos benefícios formalizados, com regras e acesso ao resgate. | Acordo válido, elegibilidade, disponibilidade, vigência e procedimento comprovados. | Novos parceiros e acompanhamento de resgates. |
| **Apogee Community** | Espaço de interação, orientação inicial e agenda confirmada. | Canal funcional, regras, moderação, responsável e cadência definidos. | Projetos coletivos, desafios, mentores e experiências. |

Proposta de trilhas iniciais, sujeita à revisão: IA para pesquisar e escrever; IA para organizar trabalho e rotina; construção de um primeiro projeto ou protótipo. A escolha de ferramentas depende do uso e das condições reais de acesso. Citar GPT, Codex, Claude, Manus ou Higgsfield não cria parceria nem entrega de créditos.

A ambição estratégica de superar R$ 10 mil em valor potencial agregado de benefícios só poderá aparecer na oferta com acordos e método de cálculo comprovados. Benefícios mutuamente excludentes não devem ser apresentados como valor garantido para todo assinante.

## 9. Jornadas e histórias de usuário

| ID | História | Resultado esperado |
| --- | --- | --- |
| U01 | Como visitante, quero entender o que posso experimentar gratuitamente para começar sem contratar. | Entrada gratuita, cadastro e condições do Radar compreensíveis. |
| U02 | Como conta gratuita, quero consultar um evento e acompanhar meu saldo. | Detalhe liberado e contador atualizado uma única vez. |
| U03 | Como conta que atingiu 10 eventos, quero conhecer a comunidade para decidir sobre acesso completo. | Oferta integrada, sem checkout automático, com retorno ao evento. |
| U04 | Como pessoa com acesso antigo, quero continuar usando o Radar que já adquiri. | Direito reconhecido sem nova cobrança ou limite indevido. |
| U05 | Como assinante, quero saber por onde começar para produzir um resultado na primeira semana. | Próxima atividade, trilha e recurso relevantes na área de membros. |
| U06 | Como assinante, quero entender cobrança e cancelamento para administrar a contratação. | Plano, situação, período e atendimento claros. |
| U07 | Como responsável pela operação, quero manter entregas e benefícios atualizados. | Gestão protegida com status e responsáveis. |
| U08 | Como assinante anual, quero encontrar ferramentas úteis por categoria para escolher o recurso adequado à minha tarefa. | Caixa de ferramentas, por exemplo Vídeo > Google Flow, com descrição e link oficial. Planejamento detalhado no PRD da área interna. |

Aquisição: conteúdo ou evento → experiência gratuita → conta e primeira consulta/atividade → apresentação da comunidade → contratação voluntária → primeiro resultado → retorno semanal.

Acesso antigo: autenticação → reconhecimento do direito → Radar liberado → apresentação opcional dos demais pilares. A assinatura não se torna etapa obrigatória para manter esse acesso.

## 10. Requisitos e critérios de aceite

### P0 — antes de lançar a nova oferta

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| R01 | Oferta integrada e entrada gratuita. | Home, comunidade, evento e Radar descrevem a mesma relação entre entrada gratuita e assinatura. Experimentar a entrada gratuita não exige checkout. |
| R02 | Cota por conta. | As primeiras 10 liberações distintas válidas são permitidas; a 11ª nova liberação apresenta o CTA. Reabertura e troca de dispositivo não gastam outra consulta. |
| R03 | Contagem confiável. | Com nove eventos liberados e duas solicitações simultâneas de novos eventos, apenas um novo evento é liberado. Repetição da operação não duplica o consumo. |
| R04 | Leitura sem consumo acidental. | Pesquisa, filtros, paginação, pré-carregamento e falha anterior à liberação mantêm o saldo. |
| R05 | Direitos antigos. | Conta com direito antigo válido mantém o Radar completo após a transição ou término de eventual assinatura e não recebe cobrança automática. |
| R06 | Retirada da nova venda avulsa. | O percurso público não exibe preço avulso nem inicia essa compra. Destinos comerciais antigos conduzem à comunidade; histórico e conciliação permanecem operacionais. |
| R07 | Assinatura e permissões. | Acesso pago depende de confirmação no servidor. Eventos duplicados ou fora de ordem não concedem direitos incorretos. Falhas e término respeitam a política aprovada e direitos antigos. |
| R08 | Entrega Learn e Community. | Trilhas e atividades anunciadas estão acessíveis com instruções, responsável e condições. O membro encontra um próximo passo para os primeiros sete dias. |
| R09 | Benefícios comprovados. | Cada perk disponível possui descrição, elegibilidade, validade e resgate verificados. Benefício não formalizado não vira promessa. |
| R10 | Administração e suporte. | Equipe autorizada consulta direitos e mantém entregas. Usuário comum não acessa contatos, dados financeiros ou funções administrativas. |
| R11 | Medição e finalidade. | Há métricas para aquisição, ativação e recorrência. A cota funciona independentemente da opção de analytics; medição de comportamento preserva a escolha do visitante. |
| R12 | Revisão e publicação. | Percursos em celular e teclado apresentam saldo, limite, erros e direitos antigos com clareza. A publicação depende de revisão da versão concreta. |

### P1 — após o núcleo funcionar

- Progresso básico, histórico privado dos eventos liberados e orientação de próximos passos.
- Desafios, sessões com mentores e agenda integrada de atividades confirmadas.
- Gestão e acompanhamento de resgates de benefícios.
- Alertas e relevância conforme interesses escolhidos pela pessoa.
- Painel de ativação e retenção com cobertura e definições documentadas.

### P2 — expansão a validar

- Recomendações avançadas de trilhas, pessoas e oportunidades.
- Projetos coletivos estruturados e novas experiências presenciais.
- Integrações automatizadas com parceiros conforme acordos e volume comprovados.

## 11. Adequação das páginas — somente após revisão

| Superfície | Mudança planejada |
| --- | --- |
| Home | Preservar identidade e composição editorial; explicar pilares, orientar o CTA à comunidade e substituir a oferta avulsa do Radar. |
| `/comunidade` | Apresentar entrada gratuita, assinatura, entregas disponíveis, planos confirmados, condições e dúvidas. Cada ação deve ter destino real. |
| `/evento-openai` | Manter a oferta gratuita da campanha e apresentar o próximo passo para conhecer a comunidade, respeitando a finalidade do cadastro. |
| Radar e detalhes | Explicar descoberta, cota, saldo e assinatura; preservar contexto e direitos antigos. |
| `/membros/radar/acesso` | Apresentar direito vigente, saldo e comunidade. Retirar o percurso de nova compra avulsa. |
| Área de membros | Organizar acesso aos pilares, próximos passos e gestão da assinatura. Planejar Caixa de ferramentas com categorias e links, exclusiva de assinantes anuais; implementação posterior à revisão específica. |
| Learn e Perks | Criar as páginas mínimas necessárias para entregar conteúdos e benefícios disponíveis. |
| Administração | Incorporar gestão das entregas e leitura dos direitos; distinguir lead, conta, participação gratuita e assinatura. |
| Navegação, metadados e documentos comerciais | Alinhar rótulos, descrições, links e condições à versão aprovada. |

Textos indicativos para revisão: “Conhecer a Comunidade Apogee”; “Começar gratuitamente”; “Radar completo incluído na assinatura da comunidade”; “Você consultou X de 10 eventos gratuitos”. Os textos devem distinguir entrada gratuita de contratação e refletir o destino real da ação.

## 12. Dependências técnicas e migração

Base a reaproveitar: autenticação, perfis e verificações; catálogo e filtros do Radar; fórum; captura do evento e administração de contatos; registro de pagamentos e origens de acesso; estrutura editorial e medição agregada condicionada à escolha do visitante.

Lacunas observadas na revisão examinada:

- O controle gratuito atual registra uma oportunidade por conta; precisa evoluir para múltiplos eventos e cota de 10.
- O detalhe bloqueado pode iniciar checkout avulso; precisa passar a apresentar a comunidade.
- A cobrança atual trata compra única; assinatura exige ciclo de vida e permissões próprias.
- Não foram encontrados módulos prontos de trilhas e catálogo/resgate de perks na aplicação examinada.
- A área de membros começa pelo fórum e precisa orientar o acesso integrado.
- A cobertura de medição precisa contemplar o novo percurso de comunidade e recorrência.

A decisão de acesso deve ficar no servidor e ser compartilhada entre páginas e conectores. O saldo é dado funcional privado necessário ao serviço; não depende de cookie de analytics nem fica exposto publicamente.

Antes de migrar: inventariar direitos sem alterá-los, definir o tratamento da oportunidade gratuita anterior, validar a transformação em ambiente isolado e conferir preservação. O inventário de produção e a migração não são executados por esta entrega documental.

## 13. Operação recorrente

| Frente | Responsabilidade a designar | Cadência proposta |
| --- | --- | --- |
| Radar | Qualidade, validade, links e relevância. | Coletores contínuos e revisão periódica dos indicadores. |
| Learn | Produzir, revisar e manter conteúdos com entregáveis. | Três trilhas iniciais; calendário de atualização a aprovar. |
| Community | Orientação, moderação, atividades e suporte. | Valor semanal e agenda mensal a confirmar. |
| Perks | Formalização, elegibilidade, vigência e uso. | Verificar antes de divulgar e a cada alteração relevante. |
| Experiências | Produção, capacidade, orçamento, reservas e atendimento. | Meta estratégica de um destaque mensal e encontros menores. |

Cada entrega anunciada exige capacidade operacional de sustentá-la. Patrocínios, créditos e logos adicionais entram na comunicação segundo acordos aplicáveis; este PRD não executa prospecção.

## 14. Métricas de sucesso

| Métrica | Definição e janela | Meta ou estado |
| --- | --- | --- |
| Assinantes pagantes | Contas com contratação paga e vigente; excluir contas gratuitas, testes e direitos antigos sem assinatura. | 50 até 30/11/2026; 2.000 até 31/03/2027. Metas estratégicas. |
| Primeira consulta | Contas gratuitas que liberam primeiro evento / contas gratuitas elegíveis da mesma semana. | Formar linha de base na primeira semana do piloto. |
| Conversão | Novos assinantes / contas gratuitas da mesma coorte, em 30 dias. | Instrumentar antes do lançamento; meta percentual após linha de base. |
| Ativação em sete dias | Novo assinante conclui entregável ou registra próximo passo concreto a partir de uma oportunidade em até sete dias. | Hipótese de 60%, para aprovação e validação no piloto. |
| Retorno na semana seguinte | Ativados na primeira semana com nova ação de valor entre dias 8 e 14 / ativados elegíveis. | Hipótese de 40%, para aprovação e validação. |
| Uso recorrente | Ações de valor semanais por pilar; visita isolada não comprova resultado. | Acompanhar semanalmente com definições aprovadas. |
| Cota e preservação | Liberações acima de 10 sem outro direito válido; direitos antigos perdidos por migração. | Zero ocorrências; critérios obrigatórios. |
| Receita e cancelamento | Receita recorrente normalizada, recebimentos, cancelamentos e churn, com bases e períodos separados. | Medir após ativar assinatura; cadastro não comprova receita. |
| Aquisição | Origens permitidas, cadastros, campanhas e custo de aquisição por assinante pago. | Medir conforme cobertura e consentimento, com lacunas documentadas. |

As taxas de ativação e retorno são hipóteses deste PRD, não resultados históricos ou benchmarks. A medição individual de resultado exige definição operacional aprovada; a análise de comportamento existente é agregada e depende da escolha do visitante. Indicadores de pagamento usam registros transacionais autorizados.

## 15. Cronograma e pontos de revisão

| Fase | Entrega e dependência | Marco |
| --- | --- | --- |
| 0 — revisão atual | PRD, decisões confirmadas e pendências. | Apresentar antes de alterar páginas. |
| 1 — especificação final | Resolver bloqueios; revisar jornadas, matriz e conteúdo incluído. | Escopo concreto aprovado. |
| 2 — versão para revisão | Implementar experiência mínima, cota, preservação, assinatura e entregas; validar migrações em ambiente isolado. | Demonstração dos percursos e evidências de validação. |
| 3 — lançamento controlado | Publicar versão revisada e autorizada, com atendimento e acompanhamento. | Buscar primeiras 50 assinaturas em novembro, conforme prontidão. |
| Dezembro/2026 | Melhorar retenção e entregas; evento previsto e cowork dependem de confirmação. | Aprender com o uso antes de ampliar aquisição. |
| Janeiro/2027 | Campanha e experiência de construção; Desert é local desejado, a confirmar. | Aprovar orçamento, capacidade, mentores e patrocínio antes da oferta. |
| Fevereiro–março/2027 | Experiências, desafios, conteúdo e melhoria de conversão/retenção. | Perseguir 2.000 membros com indicadores. |

Os eventos com OpenAI de novembro/dezembro constam como previstos no documento estratégico; este PRD não confirma novas datas, formato ou vínculos. Make It Fly segue sem data confirmada. O calendário comercial deve refletir capacidade de entrega e marcos efetivamente confirmados.

## 16. Decisões pendentes

| ID | Questão | Responsável | Quando resolver |
| --- | --- | --- | --- |
| Q01 | Qual o acesso gratuito às categorias que não são eventos? Manter a amostra atual ou definir regra própria? | Produto/proprietário. | Antes do novo bloqueio de detalhes. |
| Q02 | A oportunidade gratuita anterior, quando for evento, compõe a cota de 10 ou fica como direito adicional? | Produto e análise técnica. | Antes da migração; preservar seu acesso em qualquer escolha. |
| Q03 | Confirmar o preço anual, a forma de pagamento, eventual parcelamento, renovação, cancelamento e tratamento de falhas. A contratação exclusivamente anual já está definida. | Proprietário e operação comercial. | Antes de configurar ou ativar assinatura. |
| Q04 | Quais trilhas, atividades e recursos estão incluídos no primeiro pacote? Haverá cursos adicionais? | Produto e conteúdo. | Antes da oferta final e venda. |
| Q05 | Qual canal gratuito e ação real de entrada serão utilizados? Como se relacionam à conta e aos espaços pagos? | Proprietário e comunidade. | Antes dos CTAs de entrada. |
| Q06 | Quais perks estão formalizados e quais regras de ingresso, reserva e capacidade valem por experiência? | Parcerias e produção. | Antes de anunciar cada entrega. |
| Q07 | Quem responde por conteúdo, comunidade, suporte e indicadores? Adotar as hipóteses de ativação e retorno? | Proprietário e operação. | Antes do piloto pago. |

A contagem de eventos está resolvida em D05/D06. As pendências não reabrem a preservação dos acessos antigos nem a retirada da nova oferta avulsa do Radar.

## 17. Rastreabilidade

- Documento fornecido: `Apogee_Estrategia_e_Cronograma_2026_2027_ATUALIZADO.docx`, planejamento interno de 13/11/2026.
- Planejamento aprovado e instruções do proprietário nesta conversa em 14/11/2026: atualizar primeiro o PRD, manter entrada gratuita, preservar acessos e retirar a oferta avulsa do Radar.
- Confirmação específica: 10 eventos distintos por conta, sem renovação automática e sem novo consumo ao reabrir.
- [PRD especializado do Radar](https://github.com/brigidovinicius/apogee/blob/d6a422d8207cb04eefe9819c082f948dc5a4de30/docs/radar-prd.md), referência do catálogo e da coleta.
- Base técnica: `make-it-fly-current/lib/opportunities/detail-access.ts`, `detail-store.ts`, `lib/billing/`, `lib/members/schema.ts`, `lib/mcp/radar.ts`, `content/community.ts` e páginas relacionadas, na revisão indicada no início.

**Histórico v0.1 — 14/11/2026:** criação do PRD geral com oferta integrada, entrada gratuita, direitos antigos preservados, retirada da nova oferta avulsa e cota de 10 eventos distintos por conta.

**Histórico v0.2 — 14/11/2026:** assinatura da comunidade exclusivamente anual por decisão do proprietário; opção mensal retirada da oferta e da prévia. Mantidos o preço anual como referência proposta, a entrada gratuita e os direitos antigos do Radar.

**Histórico v0.5 — 15/11/2026:** autorização de deploy das alterações já revisadas e inclusão do PRD da área interna com caixa de ferramentas por categoria. Exclusividade anual confirmada; nenhuma implementação da caixa de ferramentas nesta entrega documental.

**Aprovação em 14/11/2026:** o proprietário aprovou o PRD e autorizou a adequação das páginas com apresentação de prévia local antes de publicar. As decisões pendentes da seção 16 continuam registradas.

**Próxima entrega:** revisão da prévia local das páginas. A ativação da assinatura e a migração da cota do Radar exigem a conclusão das dependências funcionais.

## 18. Implementação funcional local para validação — 14/11/2026

- A cota grava até dez IDs distintos classificados em `eventos`, com trava por conta, posições de 1 a 10 e unicidade no PostgreSQL. Somente a ação de abertura consome; GET, listagem, busca e conector não consomem.
- A escolha gratuita anterior permanece legível. Quando comprovadamente classificada como evento no catálogo, conta como a primeira das dez; uma escolha anterior de outra categoria não consome a cota de eventos. Não se inventa classificação para ficha ausente do catálogo. Nenhum direito anterior é removido.
- Assinatura e faturas anuais possuem registros próprios. Acesso exige fatura paga do produto e preço anual exatos, vinculados à conta, no ambiente correto e dentro do período pago. Retorno do checkout e assinatura pendente não concedem acesso.
- Renovação paga adiciona o respectivo período. Falha de renovação não estende o período anterior. Cancelar a renovação mantém o período já pago. Reembolso integral ou disputa suspende o direito anual da fatura; reembolso parcial mantém o período. Alerta de fraude exige revisão operacional. Estas regras operacionais são apresentadas para validação.
- Direitos administrativos, legados e compras antigas válidas do Radar têm precedência sobre a assinatura. Encerrar ou reembolsar a comunidade não remove esses direitos.
- A venda avulsa pelo endpoint do Radar foi encerrada; a conciliação das compras antigas e a confirmação de e-mail continuam disponíveis. O portal anual não permite trocar para mensalidade ou outro plano.
- Prévia funcional: contas sintéticas, autenticação real e PostgreSQL exclusivo no computador. Operações de pagamento são bloqueadas nessa prévia. Os testes de integração isolados usam respostas sintéticas. Em 14/11/2026 o checkout e os webhooks foram também validados no ambiente de teste da Stripe, conforme o relatório `docs/stripe-annual-sandbox-validation-20261114.md`. A configuração e ativação de produção continuam pendentes.
- Learn e Perks continuam sujeitos à especificação e confirmação das entregas antes da venda. Esta implementação não cria LMS, benefícios ou parcerias fictícios.

O detalhamento técnico e os critérios de liberação estão em `docs/community-annual-access-review-20261114.md`. A publicação exige nova autorização após a revisão deste candidato.

## 19. Resultado da validação Stripe — 14/11/2026

O proprietário aprovou a prévia funcional e autorizou a validação em teste, mantendo a revisão antes de publicar. Dois checkouts anuais foram concluídos no modo test da APOGEE, um após tentativa recusada. Compra, portal, cancelamento, renovação paga e recusada com Test Clock, reembolso integral e conciliação posterior foram conferidos com 21 webhooks reais de teste aceitos. A conta de controle permaneceu limitada e o acesso legado foi preservado.

A tela foi ajustada para identificar corretamente reembolso e pendência financeira, com preservação dos direitos antigos. O relatório de evidências distingue fatos observados na Stripe, verificações locais e limites do avanço temporal. Essa validação não criou ou ativou oferta live, não alterou banco/segredos de produção e não autorizou publicação.

## 20. Área interna e caixa de ferramentas — planejamento de 15/11/2026

A área de membros já era contemplada neste PRD em nível geral. O novo [PRD da área interna](members-area-prd.md) detalha a caixa de ferramentas: catálogo curado com categorias, descrição breve e links oficiais, começando pelo exemplo Vídeo > Google Flow. O acesso é exclusivo de assinantes anuais com direito vigente; cancelamento mantém o período pago e o direito antigo do Radar não é alterado nem convertido em acesso aos novos recursos.

O planejamento propõe catálogo e curadoria administrativa mínimos, integração à navegação interna, validação dos perfis de acesso e prévia local antes de publicar. O pedido atual autoriza a documentação e a apresentação do plano, sem implementar a caixa de ferramentas. O deploy autorizado das alterações anteriores é acompanhado separadamente.

O proprietário definiu os recursos da assinatura como Radar, Caixa de ferramentas, Benefícios e Trilha, esta última inicialmente parcial. A lista concreta de benefícios e módulos ainda não foi fornecida. Como a caixa de ferramentas permanece em planejamento, a publicação das páginas e da cota pode ocorrer com contratação anual desativada, sem declarar esses recursos como já entregues. A abertura de cobranças depende de especificar e disponibilizar as entregas anunciadas.


## 21. Entregáveis e jornada completa — revisão de 15/11/2026

O proprietário pediu a conferência dos entregáveis, a inclusão explícita da Caixa de Ferramentas na página de vendas e um prompt para concluir a jornada de lead a cliente em outro chat. A Caixa de Ferramentas já está especificada nas decisões D09/D10/D11 e no PRD da área interna. No código publicado examinado nesta revisão, não há catálogo nem rota implementados; ela permanece em preparação, sem anunciar acesso imediato.

| Entregável da assinatura | Definição e estado verificado | Condição de liberação |
| --- | --- | --- |
| Radar | Descoberta, filtros e catálogo; entrada gratuita com dez eventos distintos e direitos antigos preservados. | Direito vigente conferido no servidor; Radar completo por assinatura elegível ou direito anterior válido. |
| Caixa de Ferramentas | Catálogo curado por categoria, descrição breve e link oficial; exemplo Vídeo → Google Flow. Especificado, ainda não implementado na revisão publicada. | Exclusivo do direito anual vigente. O catálogo não inclui contas, licenças ou créditos dos fornecedores. |
| Benefícios / Perks | Ofertas e experiências com acordos, disponibilidade, elegibilidade, vigência e instruções comprovados. | Publicar e anunciar somente benefícios efetivamente conferidos; não inventar parceiros, valores ou resgates. |
| Trilha / Learn | IA aplicada com lançamento inicial parcial e entregáveis identificados por módulo. | Módulos reais, acessíveis e revisados; informar claramente o que está disponível e o que está em preparação. |

Community permanece o ambiente de convivência, orientação e experiências da oferta. Esses quatro acessos internos não transformam catálogo planejado ou módulo futuro em entrega disponível. A contratação anual continua desativada até a prontidão das entregas e a validação da configuração de produção.

A página `/comunidade` vende e explica a oferta. A página `/evento-openai` captura inscrições do evento gratuito Codex Community; `/gravacao` redireciona para ela. São percursos distintos: lead do evento não vira conta, participante de grupo ou assinante automaticamente. Cada uso dos dados respeita a finalidade e o consentimento próprios.

O deploy de apresentação autorizado neste chat abrange somente Comunidade e Loja, preservando a Home e as demais rotas, inclusive a captura do evento. Não inclui implementação da área interna, ativação Stripe ou migração de banco. O plano de execução da jornada completa está em [prompt para o próximo chat](handoffs/apogee-offer-complete-prompt-20261115.md).
