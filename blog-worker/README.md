# Blog editorial Apogee

O worker monitora RSS aprovados e importa artigos e capas como rascunhos privados. O painel `/admin/posts/pipeline` reúne fontes, pautas, comandos, evidências, consumo e revisão SEO/GEO. Publicar ou agendar usa o editor existente e exige administrador.

A geração usa o cliente oficial Antigravity com Google OAuth e assinatura elegível. `useG1Credits=false`, sem Gemini API, OpenAI API ou Codex como runtime. Código de API legado existe somente para testes e auditoria; o CLI operacional recusa esse provedor. A distribuição mantém fontes e geração desligadas; a conta real fica em configuração privada do ambiente.

Limites: dez artigos/dia e setenta/semana, no máximo um por tópico/dia e sete/semana; quarenta chamadas/dia e duzentas e oitenta/semana; concorrência um; até três tentativas de comparação/texto e uma capa. Cada execução tem uma invocação do modelo, até 45 segundos para texto e 150 para imagem. Reserva conservadora de 60 mil tokens por chamada, 180 mil/dia e 900 mil/semana. Bloqueio prévio se alguma cota Google estiver abaixo de 20%. Não são garantias de limite rígido da cota do provedor.

RSS, leitura de páginas públicas e deduplicação não usam IA. Texto e metadados saem juntos; o cliente recebe somente fatos necessários, sem campos contábeis repetidos. Capas são lidas do artefato nativo da mesma conversa, validadas e normalizadas para WebP. Timeout, uso desconhecido e excesso de reserva bloqueiam o fluxo sem repetição automática nem fallback pago.

## VPS

O perfil Compose `blog` contém worker e proxy de banco exclusivo, com TLS, sem portas públicas e sem reconfigurar o PgBouncer compartilhado. O worker executa como usuário não privilegiado. D-Bus e GNOME Keyring ficam dentro do contêiner; o diretório pessoal persiste em `/opt/apogee-blog/home`, com chaveiro criptografado. A senha de desbloqueio fica em arquivo privado montado apenas para a inicialização. Não copiar tokens do Mac nem colocar credenciais no Git.

Procedimento: backup e restauração isolada; migrações sequenciais `001` a `009`; papel de worker sem escrita direta nas tabelas públicas; grants mínimos para o papel web; cliente Linux oficial com checksum verificado; login oficial no contêiner; conferência de conta/plano/cota e atestado com validade operacional de até 24 horas; habilitação somente de fontes homologadas e da política autorizada. Com a checagem automática habilitada, o prazo do atestado inicial não interrompe a operação: um diagnóstico novo do cliente oficial renova a autorização de acesso, enquanto a captação pode continuar.

Configuração privada deve preencher `google_account_email`. O atestado precisa coincidir com essa conta. `attest-subscription`, `migrate`, `reconcile` e `resume` exigem `--execute` e credencial operacional separada. A credencial de migração não é montada no worker contínuo.

Revisão obrigatória: fatos, limitações, originalidade, fontes, legenda de IA e indexação. Rascunhos nascem com `seo_noindex=true`. O worker não publica.

## Validação

```sh
npm test
BLOG_TEST_PG_BIN=/caminho/bin/postgresql npm run test:integration
node src/cli.mjs check
```

Integração usa PostgreSQL descartável e DDL real do CMS, sem chamadas de IA. No Mac, respeitar a fila global do AGENTS. Registros privados dos pilotos permanecem fora da release pública.

## Rotina automática multifonte

Com `operator_commands_only=false`, a captação aprovada prepara dossiês a partir de DOI compartilhado ou referência explícita entre artigos, dentro de sete dias. Exige uma origem institucional ou apuração de primeira mão identificada e outro veículo distinto, sem duplicar republicações idênticas. Snapshots integrais ficam preservados; a comparação recebe excertos contíguos declarados, limitados pelo orçamento de entrada.

A pesquisa começa sem aprovação. A comparação Google verifica trechos literais e calcula a convergência por fato, com mínimo exato de 90%, confirmação de fatos críticos e diversidade de origens. Uma reprodução de release não comprova apuração independente. A porcentagem não representa probabilidade de verdade. Sem evidência suficiente a fila retorna `waiting_for_evidence` sem consultar o modelo. Não há garantia de dez notícias elegíveis por dia nem de capacidade ilimitada da assinatura.

Comparação, texto/metadados e capa usam reservas separadas no mesmo ledger. Capas automáticas têm aparência fotográfica e contexto material ligado à pauta, com legenda explícita de geração por IA, sem apresentar protótipos fictícios como fotografias. Não copiar fotos ou marcas de um site apenas por atribuir crédito: uso de terceiros exige condição de licença ou permissão conferida por arquivo. Uma substituição solicitada pelo editor exige autorização registrada, preserva a mídia antiga e todos os recibos, usa os mesmos tetos e nunca vira repetição automática. Todo novo artigo permanece rascunho privado; revisão factual vinculada ao texto e à imagem é obrigatória antes de publicação manual. O lote histórico só pode ser importado com seus recibos originais, sem registrar novo consumo ou apagar tentativas anteriores.

A comprovação inicial de conta/plano continua preservada e somente o operador pode alterá-la. Com `google_automatic_access_validation_enabled=true`, o worker renova uma autorização operacional separada a cada hora, válida por até seis horas, usando `/usage` do cliente oficial no perfil homologado. Essa consulta atualiza o acesso/cota; não atesta cobrança ou renovação financeira do Google AI Pro. O vencimento antigo de 24h não bloqueia um acesso revalidado.

Os diagnósticos usam `useG1Credits=false`, ambiente sem chaves de API, checksum fixo, zero turnos e zero tokens de modelo. Hooks recusam qualquer invocação de modelo ou ferramenta. Uma checagem concorrente é deduplicada; falhas bloqueiam geração e têm nova tentativa após cinco minutos, com intervalo crescente até uma hora. Não removem pausa manual ou circuito de consumo incerto. A reserva de conteúdo exige uma autorização vigente vinculada ao atestado original; uma troca de conta exige nova homologação pelo operador. A cota disponível continua conferida antes de gerar, com reserva mínima de 20%.

O painel distingue o registro original do plano, o último acesso confirmado e a próxima checagem. Não há automação do Codex, navegador agendado, nova assinatura, leitura/exportação de tokens ou API paga. O controle de revisão factual antes de publicar permanece independente. Sem a opção automática, o fluxo legado de atestado manual de 24h continua disponível para rollback.


A pesquisa de páginas usa o cadastro separado `research_reference` (somente leitura pelo worker), sem transformar referências em canais RSS nem alterar a configuração privada de fontes. Parte de pautas jornalísticas, lê apenas texto público visível e segue referências explícitas para fontes primárias cadastradas, inclusive DOI com destino validado. Respeita robots.txt e restrições de excerto/acesso, limita cada rodada a oito requisições e trinta segundos, com páginas de até 3 MiB e três tentativas de pesquisa por pauta/dia com intervalo mínimo de uma hora. Não há busca paga, contorno de paywall ou coleta autenticada.

A seleção é distribuída entre os sete subtópicos e as três categorias gerais. Um mesmo evento não pode ocupar duas vagas. Comparações rejeitadas continuam no ledger de consumo, mas não ocupam a vaga diária de produção; textos reservados/incertos e matérias importadas ocupam essa vaga. O painel mostra os dez tópicos, textos criados, capas concluídas e apuração pendente em horário de Brasília. Uma matéria só conta como completa com a capa anexada. A rotina executa uma etapa de IA por ciclo e prioriza concluir capas antes de iniciar novos artigos. Tetos de chamadas/tokens e revisão antes da publicação permanecem iguais.

Os vínculos por DOI incluem URLs explícitas dos documentos, inclusive o alias dx.doi.org, com destino resolvido apenas para uma referência primária cadastrada. Datas originais permanecem preservadas: documento conhecido fora da janela de sete dias não vira notícia atual por estar citado em uma pauta nova. A extração prioriza o bloco principal do artigo para evitar cartões de matérias relacionadas. As referências incluem Caltech, artigos de pesquisa da Nature e o domínio exato JPL dentro da NASA; não autorizam subdomínios arbitrários.

Meio & Mensagem e Propmark ampliam Marketing; Startups.com.br amplia Empreendedorismo e Startups, conforme autorização editorial de 12/11/2026. Os três feeds públicos homologados são configurados desativados na release e precisam de aprovação na configuração operacional. Cadastro, captura e enquadramento não aprovam fontes como independentes nem dispensam comparação factual, licença específica para imagens ou revisão humana. A migração `009` acrescenta apenas essas referências, sem sobrescrever registros ou ampliar privilégios.

A descoberta reconhece o corpo principal Elementor/ScienceDaily e DOI HTTP apenas nos resolvedores oficiais, convertidos para HTTPS. Duas coberturas que citam exatamente o mesmo documento primário específico podem formar um dossiê; isso não confirma independência nem fatos. Declarações explícitas de entrevista/apuração pelo próprio veículo são reconhecidas, enquanto menções genéricas continuam insuficientes. Capturas novas podem destravar uma correspondência em cache durante o intervalo de espera, sem repetir acessos de rede.

A comparação recebe o número e os IDs exatos dos documentos e limites de campos no schema. Uma única reparação de formato/citação inválidos usa o mesmo teto de três tentativas de comparação/texto e os limites diários existentes. Reprovações factuais, consumo desconhecido e uma segunda resposta inválida não geram nova repetição automática. O painel detalha retenções por tópico e preserva a distinção entre cada categoria geral e seus subtópicos.

O mesmo documento de apoio não pode alimentar uma segunda matéria por outra URL primária ou tópico: a checagem de duplicidade ocorre antes da comparação e novamente antes da reserva. Classificações de histórico operacional não prevalecem sobre uma manchete explícita; a promoção para a fonte primária reconfere o tema. Extrações públicas têm versão e as versões antigas são relidas dentro do orçamento, preservando snapshots e dossiês já usados. A data estruturada deve pertencer à própria página, sem usar datas de recomendações ou horários fora do corpo.


### Publicação horária autorizada na VPS

A migração `013-hourly-publication.sql` instala uma política desativada por padrão. Somente o proprietário do banco pode definir o início, o corte de entrada de artigos e a autorização; o runtime recebe apenas leitura e execução da função restrita. A configuração de produção autorizada inicia em 16/11/2026, aceita artigos novos criados a partir de 00h de Brasília e reserva dez horários, das 10h às 19h, uma publicação por hora. As metas são quatro Tecnologia, três IA e três Negócios, até setenta por semana. Os artigos antigos permanecem fora dessa autorização.

Cada ciclo pode agendar um artigo após a geração, sem chamar um modelo. Exige comparação Google confirmada, pelo menos 90%, fatos críticos confirmados pelo procedimento nativo, recibos conhecidos de texto e capa, crédito de imagem gerada, conteúdo idêntico ao payload validado e ausência de edição posterior. Fontes ou capas alteradas, tentativas incertas, divergências, fotos externas sem recibo de geração e conteúdo anterior ao corte continuam em rascunho. O recibo automático é separado de `post_review`; não representa revisão humana.

Os horários são persistidos em `scheduled_at`. Site, artigo, imagem e sitemap usam consultas dinâmicas e só ficam públicos quando chega o horário, independentemente do computador do administrador. Dois workers compartilham o bloqueio transacional e não conseguem reservar o mesmo horário. Horários passados não são compensados por várias publicações simultâneas; um artigo pronto fora da janela pode ocupar um horário disponível do dia seguinte. Ausência de evidências ou de cota mantém a matéria retida, sem baixar a exigência para preencher a meta.

A geração e a revalidação Google continuam no container Linux com `restart: unless-stopped`, volumes persistentes e limites de consumo. Para preparar a janela de publicação, a configuração privada pode antecipar o complemento por explicativos para as 6h. A exceção de consumo de 15/11 expira normalmente; a publicação não acrescenta chamadas de IA.

Pausar a geração impede novos agendamentos pelo publisher; agendamentos já gravados continuam válidos. Para interromper também publicações futuras, desative a política e devolva explicitamente os agendamentos futuros dessa política para rascunho. Em rollback, preserve recibos e a migração, desative a política e restaure somente as imagens de serviço/configuração anteriores; não remova artigos nem histórico.

### Pauta de escrita técnica aeronáutica e IA

A biblioteca inclui a pauta solicitada pelo titular a partir da Plustag em 16/11/2026. O FAQ da ASD é a fonte primária; a TechScribe oferece análise própria; a repercussão da Plustag conserva a origem comum dos fatos sobre a norma e o papel de fonte derivada. A matriz recebe essas informações de procedência e mantém todos os fatos críticos e o mínimo de 90%. A comparação real continua obrigatória.

A leitura adicional se limita aos contêineres públicos verificados de duas páginas, incluindo todos os painéis do FAQ e as ressalvas do artigo técnico. Robots, controles de acesso, nosnippet, limites de entrada e snapshots permanecem aplicáveis. A atualização 014 acrescenta três referências sem ativar RSS, conceder escrita ao runtime ou mudar publicação e cobrança. O artigo ocupa uma vaga de IA e utiliza os limites existentes da assinatura Google; capas externas não são licenciadas por esse cadastro.
