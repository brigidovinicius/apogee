# Pesquisas da Apogee

Em **Administração → Pesquisas**, crie um formulário em branco ou abra o modelo do Codex Community Workshop de Florianópolis. É possível editar as perguntas, alterar a ordem, definir obrigatoriedade e escolher entre resposta aberta, nota de 0 a 10 e escolha única.

Salve como rascunho e use **Prévia da última versão salva** para testar as escolhas sem registrar respostas. O modelo do workshop usa 90 dias de retenção. Confira o prazo antes de abrir a pesquisa. Quando o formulário estiver aberto em um ambiente habilitado, o painel mostra o endereço de participação e a área de respostas.

A autorização da pesquisa, o convite para colaborar e a pergunta sobre o Radar são escolhas independentes. Quem recusa a pesquisa pode responder apenas à pergunta do Radar quando ela estiver disponível. O formulário solicita um e-mail extra quando a pessoa escolhe receber um convite. A escolha sobre o Radar fica no envio e a autorização operacional do piloto continua nas preferências da conta.

## Painel de respostas

Use **Ver respostas** na lista de pesquisas para abrir os envios dentro do prazo de retenção. Filtre por participação na pesquisa ou por envios exclusivos do Radar. Abra um envio para conferir a versão do formulário, as perguntas respondidas, as autorizações e a data de vencimento. Os números de progresso por etapa se referem à versão atual do formulário.

O aviso de identificação informa que os envios autorizados da pesquisa ficam vinculados à conta Apogee. O painel consulta o nome e o e-mail atuais da conta. Envios anteriores ao aviso e escolhas exclusivas sobre o Radar ficam sem vínculo. A exclusão da conta remove o vínculo, e o registro de progresso usa somente o código da tentativa.

Depois do prazo, os registros deixam de aparecer no painel. A API remove respostas vencidas do mesmo formulário em novas submissões. Use **Gerenciar retenção → Excluir registros vencidos** para limpar formulários sem novos envios. A limpeza periódica de formulários inativos ainda precisa ser configurada para operação em produção.

As migrações `0028_surveys.sql` e `0029_survey_progress.sql` sustentam o formulário e o progresso. A migração aditiva `0030_survey_respondent.sql` precisa estar aplicada antes da publicação da versão que identifica envios. A rota pública e a API dependem de `APOGEE_SURVEYS_ENABLED` fora da prévia local.

Em 22/11/2026, passaram o ESLint dos arquivos alterados, os 892 testes da suíte e o build com TypeScript. O Chrome, com Next.js e PostgreSQL em loopback, verificou permissões, criação em branco e pelo modelo Codex, edição concorrente, prévia, envio e reenvio sem duplicar, recusa, escolhas opcionais, leitura administrativa, expiração e encerramento. Os dados e o prazo de 30 dias usados nesse ensaio eram sintéticos.

Em 25/11/2026, o ESLint dos arquivos alterados, o build com TypeScript e os 901 testes da suíte passaram. O ensaio local no Chrome com PostgreSQL temporário validou sessão administrativa, envios identificados e legados, escolha exclusiva do Radar, reenvio sem duplicar, progresso, filtros, paginação, uso por teclado, visualização móvel, expiração e retirada do vínculo após excluir a conta sintética. A checagem de produção foi somente leitura e confirmou um envio válido da versão 4, com sete perguntas preenchidas e sem identificação registrada.
