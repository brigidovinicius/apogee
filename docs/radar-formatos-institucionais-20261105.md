# Radar: falsos bloqueios em formatos institucionais

## Auditoria de produção e páginas públicas

Em 05/11/2026 às 11h03 (Brasília), Radar web/agendador executavam `ce9fb64`, sem reinícios. A leitura limitada desde a implantação encontrou 12 URLs distintas retidas por `detail_layout_unrecognized` ou `invalid_deadline`, sem exportar identificadores internos ou alterar registros.

Doze páginas foram consultadas com o transporte protegido, em dois lotes de seis. Nove HTMLs puderam ser analisados; três notícias antigas do Brazilian Brain Bee foram recusadas pelo limite/formato de resposta. Os mesmos bytes das páginas capturadas foram reutilizados na análise posterior.

### Falso bloqueio comprovado

A [notícia do ICMC/USP sobre o curso de probabilidade e estatística](https://www.icmc.usp.br/noticias/7746-icmc-abre-inscricoes-para-curso-on-line-de-probabilidade-e-estatistica-aplicado-a-ciencia-de-dados) usa `.com-content-article.item-page`, com o título fora de `.com-content-article__body`. Não há `main` ou `article`; o leitor anterior descartava o conteúdo.

O texto do corpo confirma inscrições abertas e encerramento em **8 de novembro de 2026**, pelo Sistema Apolo. A extração corrigida aceita esse prazo sem inferir o ano de metadados ou da data das aulas. Trata-se de um curso pago: a notícia informa R$ 690 para as vagas pagantes e bolsas selecionadas em etapa anterior. A correção não o transforma em bolsa aberta ou curso gratuito.

### Retenções mantidas

- A página de inscrições da IlustraCiência/UFV tem um título institucional externo e um bloco próprio de conteúdo WordPress. O formato foi reconhecido, mas o texto confirma inscrições encerradas; não foi habilitada publicação dessa edição.
- `noticias.ufsc.br/` é uma listagem, com múltiplas notícias. Continua sem extração como oportunidade individual.
- As cinco páginas classificadas com prazo inválido na amostra tratam de resultados, projetos contemplados, convocação com prazo já passado ou matéria sem prazo completo. Não foi comprovado falso bloqueio de prazo nesses cinco casos. Nenhum prazo foi completado com ano presumido.
- A página geral Bolsa IHS/OBMEP não comprova uma chamada atual com candidatura e prazo. Continua retida.
- As três respostas recusadas no transporte não foram liberadas por exceção.

## Alteração

O leitor aceita um único artigo Joomla com um único título e corpo, ou o bloco institucional WordPress `body.wp-singular #conteudo > #artigos > .artigo`. Conteúdos múltiplos permanecem recusados. Módulos, cabeçalhos institucionais e datas de publicação ficam fora do corpo Joomla usado como evidência.

Títulos explícitos como “Instituto abre inscrições para curso” passam a receber `isCourse=true` e categoria `formacao`. A versão do hash da normalização foi incrementada para que correções de classificação não sejam ocultadas por conteúdo idêntico.

A versão 6 permite uma reavaliação de `detail_layout_unrecognized` já examinado pela versão 5. Não reabre seus demais bloqueios, nem ignora quatro tentativas máximas. Dentro da cota de reavaliação existente, os bloqueios específicos de formato têm prioridade sobre os motivos genéricos antigos. A leitura da fila encontrou 595 reavaliações elegíveis e o candidato real da USP na posição 88 antes dessa correção; uma consulta somente leitura com a nova ordenação o colocou na posição 3. Uma regressão reproduziu a falta de publicação no primeiro lote com uma fila antiga à frente do formato corrigido. Não há seleção por URL, instituição ou oportunidade específica. São preservados os critérios anteriores de autoridade, rota de inscrição, prazo, origem exata, leases, exclusões e campos gerenciados pelo administrador. Não há migração ou dependência nova.

## Validação e estado da entrega

Duas regressões reproduziram o descarte dos formatos antes da alteração. Os testes também cobrem módulos externos com outros prazos, ambiguidade de títulos/corpos, edição encerrada, publicação automática em PostgreSQL isolado, classificação persistida, idempotência e preservação de bloqueios/tentativas.

Validação final local concluída: **605 testes aprovados, 35 condicionados/ignorados**, lint, typegen, TypeScript e build standalone aprovados, incluindo o ajuste de prioridade. A análise dos bytes reais da USP passou sem nova consulta de rede. A entrega ainda está em andamento. O aceite de uma página real na extração local e os testes com banco isolado **não comprovam publicação em produção**. Essa confirmação exige um ciclo nativo, registro criado/publicado e novo ID no catálogo público.

Evidências privadas ignoradas: `.local/retentions-20261105/`. A outra sessão de compra/login e o candidato regional permanecem em worktrees próprios. Esta alteração se limita aos arquivos do coletor e seus testes/documentação; os comandos npm respeitam a fila global.

## Publicação nativa e correção de classificação

O PR #122 foi integrado e `597cd29` implantado apenas no Radar às 11h45 de 05/11. O segundo ciclo nativo cadastrou uma fonte e criou/publicou a notícia do ICMC/USP, sem processamento manual de links. A API passou de 1.036 para 1.037 IDs; o novo ID público é `d5589ae9-0644-41c7-96a1-6867445c9a5f`, com prazo 08/11/2026 e verificação automática. A busca pública respondeu HTTP 200 com a nova ficha.

A conferência dessa ficha revelou um defeito adicional: menções a pesquisa e a bolsas em outras etapas faziam o classificador genérico atribuir `research_scholarship` ao curso pago. O ramo genérico de cursos deixa de inferir bolsa por palavras sobre o conteúdo das aulas. Usa benefício `other` e categoria `formacao`, preservando auxílio financeiro explicitamente oferecido aos estudantes/participantes; concessões específicas de bolsas exigem uma oportunidade própria ou um adaptador específico. O hash da normalização é revisado para atualizar a classificação de conteúdo já conhecido. Valores ou gratuidade não são preenchidos por presunção.

A regressão do corpo Joomla foi ampliada com menções incidentais a pesquisa/bolsas e reproduziu o rótulo errado antes da correção. A publicação nativa acima é evidência preservada; uma eventual atualização posterior da classificação da ficha existente deve ser registrada separadamente de criação/publicação de uma oportunidade nova.
