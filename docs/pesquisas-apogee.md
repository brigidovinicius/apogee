# Pesquisas da Apogee

Em **Administração → Pesquisas**, crie um formulário em branco ou abra o modelo do Codex Community Workshop de Florianópolis. É possível editar as perguntas, alterar a ordem, definir obrigatoriedade e escolher entre resposta aberta, nota de 0 a 10 e escolha única.

Salve como rascunho e use **Prévia da última versão salva** para testar as escolhas sem registrar respostas. O modelo do workshop começa com o prazo de retenção em branco. Defina o prazo real antes de abrir a pesquisa. Quando o formulário estiver aberto em um ambiente habilitado, o painel mostra o endereço de participação e a área de respostas.

A autorização da pesquisa, o convite para colaborar e a pergunta sobre o Radar são escolhas independentes. Quem recusa a pesquisa pode responder apenas à pergunta do Radar quando ela estiver disponível. O e-mail só é solicitado para o convite escolhido. A escolha sobre o Radar fica na resposta da pesquisa e a autorização operacional do piloto continua nas preferências da conta.

As respostas registram a versão do formulário, as perguntas exibidas e os textos das autorizações correspondentes. Depois do prazo, deixam de aparecer no painel. A API remove respostas vencidas do mesmo formulário em novas submissões. Use **Excluir respostas vencidas** no painel para limpar formulários sem novos envios. A limpeza periódica de formulários inativos ainda precisa ser configurada para operação em produção.

A implementação usa a migração `0028_surveys.sql`. A rota pública e a API ficam indisponíveis fora da prévia local até que `APOGEE_SURVEYS_ENABLED` seja habilitada. A instalação em produção, a habilitação pública e o convite a participantes aguardam revisão própria.

Em 22/11/2026, passaram o ESLint dos arquivos alterados, os 892 testes da suíte e o build com TypeScript. O Chrome, com Next.js e PostgreSQL em loopback, verificou permissões, criação em branco e pelo modelo Codex, edição concorrente, prévia, envio e reenvio sem duplicar, recusa, escolhas opcionais, leitura administrativa, expiração e encerramento. Os dados e o prazo de 30 dias usados nesse ensaio eram sintéticos.
