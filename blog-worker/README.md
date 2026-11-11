# Blog editorial Apogee

O worker monitora RSS aprovados e importa artigos e capas como rascunhos privados. O painel `/admin/posts/pipeline` reúne fontes, pautas, comandos, evidências, consumo e revisão SEO/GEO. Publicar ou agendar usa o editor existente e exige administrador.

A geração usa o cliente oficial Antigravity com Google OAuth e assinatura elegível. `useG1Credits=false`, sem Gemini API, OpenAI API ou Codex como runtime. Código de API legado existe somente para testes e auditoria; o CLI operacional recusa esse provedor. A distribuição mantém fontes e geração desligadas; a conta real fica em configuração privada do ambiente.

Limites: dez artigos/dia e setenta/semana, no máximo um por tópico/dia e sete/semana; trinta chamadas/dia e duzentas e dez/semana; concorrência um; duas tentativas textuais no máximo e uma capa. Cada execução tem uma invocação do modelo, até 45 segundos para texto e 150 para imagem. Reserva conservadora de 60 mil tokens por chamada, 180 mil/dia e 900 mil/semana. Bloqueio prévio se alguma cota Google estiver abaixo de 20%. Não são garantias de limite rígido da cota do provedor.

RSS, leitura de páginas públicas e deduplicação não usam IA. Texto e metadados saem juntos; o cliente recebe somente fatos necessários, sem campos contábeis repetidos. Capas são lidas do artefato nativo da mesma conversa, validadas e normalizadas para WebP. Timeout, uso desconhecido e excesso de reserva bloqueiam o fluxo sem repetição automática nem fallback pago.

## VPS

O perfil Compose `blog` contém worker e proxy de banco exclusivo, com TLS, sem portas públicas e sem reconfigurar o PgBouncer compartilhado. O worker executa como usuário não privilegiado. D-Bus e GNOME Keyring ficam dentro do contêiner; o diretório pessoal persiste em `/opt/apogee-blog/home`, com chaveiro criptografado. A senha de desbloqueio fica em arquivo privado montado apenas para a inicialização. Não copiar tokens do Mac nem colocar credenciais no Git.

Procedimento: backup e restauração isolada; migrações sequenciais `001` a `007`; papel de worker sem escrita direta nas tabelas públicas; grants mínimos para o papel web; cliente Linux oficial com checksum verificado; login oficial no contêiner; conferência de conta/plano/cota e atestado com validade operacional de até 24 horas; habilitação somente de fontes homologadas e da política autorizada. Com a checagem automática habilitada, o prazo do atestado inicial não interrompe a operação: um diagnóstico novo do cliente oficial renova a autorização de acesso, enquanto a captação pode continuar.

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
