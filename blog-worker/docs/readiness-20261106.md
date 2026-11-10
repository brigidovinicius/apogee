# Validação para ativação — 06/11/2026

O worker passou na validação local, mas **não está liberado para ativação**. Geração, coleta recorrente e publicação permanecem desligadas. O relatório inicial `validation.json` descreve o commit `18f1a66`, anterior à seleção do modelo e à correção das tarifas de cache. Esta revisão tem evidência própria em `readiness-validation.json` e `source-probes-20261106.json`.

## Benefício e isolamento

A consulta autenticada confirmou elegibilidade e uma oferta. Não houve vinculação, concessão ou uso de crédito. As condições e os valores da oferta foram registrados apenas no relatório local privado; devem ser consultados novamente antes do resgate. O benefício não compartilha a cota do Codex, mas créditos comprados podem ser consumidos depois dos incluídos. [Documentação oficial](https://developers.openai.com/api/docs/guides/chatgpt-api-credits).

A organização atual tem saldo comprado e método de pagamento; a chave criada está no `Default project`. Portanto, não é possível atestar `no_paid_balance`, `no_paid_billing` ou `dedicated_project`. O usuário autorizou uma organização exclusiva **Apogee**. Nenhuma alteração foi feita nas organizações existentes. O painel observado não ofereceu criação; a documentação informa que uma organização adicional deve ser solicitada ao suporte com nome e e-mail do proprietário. [Procedimento oficial](https://help.openai.com/en/articles/8991840-requesting-an-additional-api-organization).

Destino planejado, ainda inexistente: organização **Apogee**, projeto **Apogee Blog**, residência global, somente tier Standard, sem cartão, saldo comprado, recarga ou outros consumidores. IDs não foram inventados. Depois da criação: conferir cobrança e acesso, criar chave dedicada pelo fluxo seguro, confirmar o destino do benefício, verificar concessão e expiração reais e registrar a comprovação administrativa. A consulta de modelos deverá ser repetida nesse novo escopo.

## Modelo e custo

Selecionado `gpt-6-luna`, Responses, saída estruturada, `reasoning.effort: low`, tier `default`. `GET /v1/models` retornou HTTP 200 e listou Luna e Terra no projeto atual em 06/11 às 15:59 UTC. Isso comprova visibilidade, não qualidade editorial nem acesso futuro no projeto novo. O candidato Luna foi escolhido pelo menor custo para a tarefa curta; não haverá troca automática de modelo.

| Classe | US$ por milhão de tokens |
|---|---:|
| Entrada | 0,10 |
| Leitura de cache | 0,01 |
| Gravação de cache de 30 minutos | 0,125 |
| Saída, incluindo raciocínio | 0,50 |

Preços Standard globais conferidos na [página oficial do modelo](https://developers.openai.com/api/docs/models/gpt-6-luna). A reserva conservadora de 8.000 tokens de entrada a US$ 0,125/M mais 2.000 de saída a US$ 0,50/M é **US$ 0,002 por chamada**; até duas tentativas somam US$ 0,004 por artigo. Essa conta é uma estimativa máxima nos limites e tarifas atuais, não cobrança observada nem garantia de gratuidade. Os tetos de ciclo/dia/artigo e frequência continuam valendo separadamente.

O cálculo anterior não distinguia gravação de cache. Agora a reserva usa a maior tarifa aplicável e a liquidação exige `cached_tokens`, `cache_write_tokens`, entrada, saída e total consistentes. O provedor também exige ID e tier retornados iguais aos solicitados. Falha mantém a reserva e pausa a fila. [Classes de uso documentadas](https://developers.openai.com/api/docs/guides/prompt-caching).

**Pendência de preço:** as páginas oficiais de [contagem](https://developers.openai.com/api/docs/guides/token-counting) e da [referência do endpoint](https://developers.openai.com/api/reference/resources/responses/subresources/input_tokens/methods/count) consultadas não estabeleceram explicitamente ausência de cobrança. `input_counting_free_verified=false` e `approved=false` permanecem. Nenhum POST foi usado para tentar inferir gratuidade.

## Fontes

Os nove endpoints retornaram HTTP 200 e XML legível pela VPS em 06/11 às 16:04 UTC. No Mac, todos passaram pelo downloader real do worker, com DNS fixado e limite de 2 MiB. O probe da VPS usa Python padrão e valida transporte/XML; não equivale à execução do container/Node na VPS. Nenhuma notícia foi importada em banco.

Foi corrigido um bloqueio indevido de toda a faixa `192.0/16`, que impedia NASA/Harvard. Endereços privados e reservados seguem bloqueados. O detalhe por feed, tamanho e hash está no JSON de evidência; contagens abaixo são a amostra dos 20 itens mais recentes e janela de sete dias, usando os hosts atuais.

| Fonte | Itens no RSS | Metadados aceitos | Texto com tamanho elegível* | Encaminhamento |
|---|---:|---:|---:|---|
| NASA Releases | 10 | 5 | 5 | Candidata ao piloto após revisão de direitos do item |
| NASA Technology | 10 | 1 | 1 | Mesmo tratamento; alguns links usam science.nasa.gov |
| NASA JPL via NASA | 10 | 0 | 0 | Feed acessível; sem item elegível na janela observada |
| MIT Research | 50 | 9 | 9 | Adequar atribuição e modalidade de uso antes de redação |
| Harvard Gazette | 50 | 12 | 10 | RSS oficial; permissão editorial não comprovada |
| OpenAI News | 1.366 | 20 | 0 | Descoberta; chamadas curtas insuficientes para dossiê |
| Google Research | 100 | 2 | 0 | Descoberta; exige evidência adicional homologada |
| Google DeepMind | 100 | 2 | 0 | Descoberta; exige evidência adicional homologada |
| Y Combinator | 15 | 8 | 8 | Não aprovar reescrita comercial sem resolver os termos |

\* Apenas o critério técnico de extensão do texto. Não comprova qualidade, completude, licença nem aprovação editorial. O probe simula essa flag somente em memória para medir tamanho; não altera o catálogo nem grava dossiês.

A [NASA](https://www.nasa.gov/nasa-brand-center/images-and-media/) permite usos factuais nas condições publicadas, exige crédito e ressalva conteúdo de terceiros. A política não libera automaticamente toda imagem encontrada no feed. O [MIT](https://news.mit.edu/terms-of-use) prevê condições específicas para republicação, incluindo título, autoria e atribuição; a redação original do worker ainda precisa de enquadramento próprio. [Harvard](https://news.harvard.edu/gazette/rss-feeds/) confirma a disponibilização dos feeds, sem estabelecer ali uma licença geral de adaptação. Os [termos do YC](https://www.ycombinator.com/legal) restringem reprodução e criação de derivados comerciais sem autorização aplicável.

Nenhuma fonte foi marcada como aprovada para geração. A cobertura técnica contempla quatro editorias; **Oportunidades continua pendente**, preferencialmente via contrato interno de leitura do Radar. Os links `science.nasa.gov` foram identificados como oficiais, mas o host ainda não entrou no catálogo: sua inclusão deve vir com a homologação do respectivo conteúdo. Imagens e vídeos ficam para seleção humana com autoria/licença por ativo, sem geração paga.

## Resultado e próximos passos

- 21 testes unitários e 19 verificações com PostgreSQL temporário: aprovados, zero chamadas reais ao provedor.
- Configuração: válida; geração false, fontes habilitadas zero, preços aprovados zero.
- Sem banco de produção, migração remota, deploy, push, PR, publicação ou consumo de Codex pelo worker.
- Ainda falta: organização e projeto isolados; concessão real do benefício; confirmação da tarifa de contagem; fontes/dossiês homologados e piloto editorial; imagem Docker e validação do ambiente no candidato autorizado.

Ativação exige resolver esses pontos, renovar comprovações vencidas e autorizar implantação do SHA final. Sem resposta externa comprovada, o comportamento correto é permanecer desligado.
