# Apuração e conclusão do lote diário

O leitor podia selecionar um cartão de notícia relacionada da ESA ou apenas um capítulo dos guias Azure, deixando de capturar o contexto necessário à comparação. A revisão v4 identifica esses layouts públicos, conserva a ordem dos capítulos e exclui controles e recomendações. O corpo de suporte público da Intel também passa a ser reconhecido. Não há leitura de conteúdo restrito nem mudança das regras de robots, acesso, independência ou citações literais.

Um excerto explicativo precisa conter pelo menos dois termos da pauta (ou o único termo quando a pauta tem um). Uma página legível redirecionada para um assunto sem relação deixa de consumir comparação. Capturas novas usam uma revisão de extração própria; os snapshots e comparações anteriores permanecem imutáveis.

A biblioteca recebe seis perguntas de assuntos distintos nos tópicos ainda incompletos: tipos de eclipse, riscos de detritos orbitais, escalabilidade da nuvem, classificação binária/multiclasse, consumo e aplicações de GPUs e identificação de público-alvo. São explicativos identificados como tal, com datas originais e consulta separadas. Cada um continua dependendo de comparação factual de pelo menos 90%, confirmação de fatos críticos, texto original, capa creditada e revisão final. A biblioteca é finita; ela amplia alternativas e não garante produção quando fontes ou cotas falham.

Após o horário híbrido, tópicos que já passaram por pesquisa de notícias recebem sua alternativa explicativa antes de outra leitura de previews incompletos. Falha de enriquecimento registra intervalo de espera em vez de repetir a mesma página a cada minuto. Notícias já elegíveis continuam prioritárias na fila de redação.

A atualização 011 acrescenta apenas o host público `support.microsoft.com` à referência Microsoft existente. Não cria acesso, permissões ou tabelas, nem modifica artigos ou avaliações.

## Consumo e segurança operacional

Uma autorização excepcional pode ser registrada em `google_daily_completion`, com data de Brasília, teto de até 60 chamadas e reserva de 30 mil tokens por execução. Ela expira automaticamente à meia-noite. Os tetos de 180 mil tokens/dia, 900 mil/semana, 280 chamadas/semana, dez matérias/dia e uma por tópico continuam ativos. Uso superior à reserva pausa a produção; execução incerta conserva a reserva e impede repetição. A reserva de 20% da cota real Google e a proibição de créditos extras permanecem.

A autorização não é incluída na configuração pública padrão. O operador deve registrá-la apenas para a data e o propósito autorizados. Ela não altera recibos passados, não transforma saldo de API em assinatura e não habilita uma API paga. A disponibilidade da contingência OpenAI exige verificação própria antes de usá-la; nenhuma chamada OpenAI faz parte dos testes.

Os testes automatizados usam fontes, imagens e provedores sintéticos; a leitura dos sites oficiais não usa IA. A validação final da apuração real e da geração deve registrar separadamente os artigos efetivamente completos, a compatibilidade, as fontes, os créditos e o consumo confirmado. Dez testes simulados não significam dez matérias reais criadas.
