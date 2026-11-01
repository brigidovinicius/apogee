# Cadastro dos eventos das imagens e destaques — 01/11/2026

O usuário autorizou explicitamente o cadastro dos 11 eventos ausentes e a publicação dos destaques, priorizando tecnologia, negócios e hackathons com premiação confirmada.

## Lote e preservação

`research/tech-business-events-20261101/publication-batch.json` contém 11 fichas e suas referências oficiais: Convergência Summit, Bootcamp Deep Tech, DCD Connect Brasil, HSM+, Semana de IA Serpro, Sebrae Rio Summit, Red Hat Connect São Paulo, Congresso de IA da PUC-SP, TDC Recife, Brasil Global Summit e CASE. Datas de realização, formatos, condições, custos e modalidades estão separados. Não são reutilizados lotes vencidos nem seleções de startups, mentorias ou projetos já encerradas.

TDC aparece na fonte oficial como **TDC Stage at REC’n’Play**, no festival em 11–12/11. A inscrição de público do festival não garante vaga em cada atividade. A página de inscrições genérica do TDC apontava Floripa; essa rota não foi usada como inscrição de Recife. Bootcamp oferece participação geral gratuita pelo Sympla; mentorias tiveram seleção separada. Todos os prazos finais não divulgados permanecem nulos.

As fontes novas são `reference_only`, com escopo limitado às páginas verificadas e **sem coleta automática**. Não há alteração de coletores, agendador, normalizadores, migrações, código ou revisão do backend. A tarefa paralela foi consultada e estava concluída/ociosa; backend observado em `d2c80ad`, site em `ccdbffe`. Nenhuma mensagem foi enviada ao outro chat.

O executor `scripts/publish-image-events-20261101.py` apenas planeja por padrão. `--apply` exige backup verificado, revisões esperadas e usa o papel limitado `radar_editor`. Verifica fontes existentes, identidades e exclusões; publica fichas pela API editorial existente, com suas validações e trilha de auditoria. Repetição preserva as identidades criadas. Os três ajustes editoriais existentes são deltas estreitos com locks por fonte, versões e histórico: áreas de Enap/REC’n’Play e áreas/classificação de prêmio do Builders Day. Campos e evidências anteriores permanecem intactos, inclusive a descrição de que natureza e divisão dos R$ 25 mil dependem das regras.

## Ranking

Premiações classificadas e auditadas como `Prêmio` recebem prioridade mesmo quando consistem em produtos/serviços. Isso não cria benefício financeiro, valor em dinheiro nem direito a prêmio para ouvintes. Os benefícios financeiros continuam sujeitos ao parser conservador, agora também excluindo totais cuja natureza é explicitamente incerta, como a ficha do Builders Day. Temas estruturados de tecnologia e negócios recebem um desempate adicional, abaixo do peso de premiações confirmadas. Entre eventos com pontuação e prazo iguais, a realização mais próxima desempata antes do ID aleatório, considerando fuso.

Publicar primeiro o site com essa proteção, depois executar o lote com `--apply --site-sha=<merge-exato>`. O executor confirma o SHA da imagem antes de classificar o Builders Day como premiação. Assim o total anunciado não recebe rótulo financeiro durante a transição.

A home mantém seis destaques e as categorias horizontais existentes. Os demais eventos permanecem acessíveis no Radar e pelos filtros. Não há promessa de mostrar todos os 11 simultaneamente nos seis espaços da home.

## Validação e operação

Validação local: 601/601 testes antes do rebase; 611/611 após incorporar a publicação concorrente da Agenda Google e cobrir o lote inteiro contra rótulos financeiros indevidos, com lint e TypeScript aprovados. Inclui a regressão com o texto real do Builders Day e a preservação de premiação em dinheiro explicitamente confirmada. A validação final, CI, cadastro efetivo e deploy serão registrados após execução. Backup restrito anterior ao lote criado em `/opt/apogee-backups/image-events-20261101/radar-before.dump`, legível pelo `pg_restore` e com checksum confirmado. Identidades históricas foram consultadas antes de preparar o lote; os 11 eventos não estavam publicados nem encontrados entre exclusões.

Não houve cadastro de Front in Floripa, que informa ingressos esgotados. Não houve inscrição em evento, compra, aceitação de termos ou envio de mensagens.

## Publicação concorrente preservada

O PR #109 da Agenda Google entrou em `main` durante a preparação. O primeiro preflight parou antes de alterar o checkout ou aplicar dados, pois a revisão de produção havia mudado. O lote foi rebased em `6f92cca`, preservando as 29 alterações daquele PR. A imagem observada em produção era o head testado `3859a86`. O corte deste lote aguardará a conclusão operacional do outro chat e usará snapshot atualizado do ambiente e dos containers, incluindo eventual worker de calendário.

A simulação anterior à gravação identificou que frases negativas com a palavra “prêmio” no singular escapavam de uma regra legada. A negação foi corrigida e as 11 fichas reais do lote foram adicionadas à regressão. Não houve aplicação de cadastros antes dessa correção.

Seleção simulada com os dados reais e o lote proposto: GovTech Cianorte, Builders Day, Wolfram Brasil, Bootcamp Deep Tech, Convergência Summit e DCD Connect Brasil. Os três primeiros têm premiações confirmadas ou anunciadas nas fontes, com natureza preservada; nenhum ganhou benefício financeiro inventado. A conferência pública após a aplicação determinará a seleção efetivamente exibida.
