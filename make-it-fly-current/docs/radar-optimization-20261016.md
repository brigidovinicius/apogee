# Otimização do Radar — 16/10/2026

Estado: implementação local em worktree isolado, sem push, migração, ativação de fontes ou deploy por este chat. Base: `fd2f189`; branch: `feat/radar-optimization-20261016`.

## Diagnóstico inicial

A captura HTTP pública de `/oportunidades` confirmou os números informados: 1.082 oportunidades agrupadas; formação 984, bolsas 87, pesquisa 83, intercâmbios 7, competições 3, carreira 3 e eventos 7. São contagens sobrepostas.

O HTML/RSC contém **1.180 registros individuais**, com IDs únicos. IFSC tem 59 opções por prova; IFC tem 41. Agrupar essas 100 opções em dois processos explica a diferença de 98 entre registros e oportunidades. A categoria formação tem 1.082 registros individuais, que viram 984 entradas agrupadas; esses dois números coincidentes não devem ser confundidos com o total geral agrupado de 1.082.

**817 registros individuais vêm da EV.G**. Há 1.082 registros do tipo Curso, 100 opções de vestibular e somente sete registros marcados como eventos. O desequilíbrio resulta principalmente da cobertura de catálogos de cursos, agravado pela ordenação pública por prazo e pelo bloco de vestibulares colocado antes do catálogo. Contagens e opções eram calculadas sobre o conjunto completo e não acompanhavam todos os filtros. Não se encontrou justificativa para excluir cursos legítimos.

O HTML inicial tinha aproximadamente 2,54 MB; continha detalhes de todo o catálogo mesmo renderizando 24 cards convencionais. As listas de vestibular ficavam fora dessa paginação. Havia texto como `seleção por prova:.` nos requisitos.

Frontend: Next.js App Router, React/TypeScript, CSS Modules, fontes locais. Backend independente: Next.js, PostgreSQL/RLS, registro de fontes oficiais, ingestão e rechecagem programadas, evidências, identidade canônica, tombstones e overrides administrativos. A Apogee acessa uma ponte privada autenticada, versão 3. Nenhuma credencial é enviada ao cliente.

## Plano e implementação

1. Cabeçalho menor, remoção dos dois textos pedidos e um H1 descritivo. Inter no corpo e componentes; Instrument Serif nos títulos, ambas já usadas pela home e carregadas no layout. Navegação global preservada; nenhuma fonte/biblioteca instalada.
2. `categoria=vestibular` é a única seleção que permite processos por prova no feed público e de membros. Todas, modalidade, educação, busca e localização não ativam vestibular. A mesma função de filtro é executada no servidor e no cliente. O catálogo administrativo conserva acesso integral.
3. Cada processo permanece um card, agrupado por identidade auditada depois de filtrar os cursos. Prévia com até quatro nomes distintos, lista completa via `<details>` nativo e lista interna com rolagem limitada; requisitos, campus/localização, oferta/vagas e modalidade permanecem nos textos oficiais quando disponíveis. Nada é inferido para campos ausentes.
4. Paginação no servidor, 24 entradas por página, com `pagina` na URL. O servidor filtra/rankeia/agrupa antes de recortar. Navegação por links reais. Busca e filtros removem a página anterior. Só os detalhes da página atual são enviados ao navegador, junto com metadados de filtros/contagens.
5. Busca acima das categorias, prioridade visual para eventos e competições, cards com requisitos e condições em divulgação progressiva. Links oficiais e acesso à área de membros preservados.
6. Categorias contam processos/entradas de acordo com palavra-chave, local, formação, formato, benefício, abrangência e prazo; o filtro da própria categoria é substituído ao calcular cada alternativa. Vestibular tem contagem própria. Categorias continuam sobrepostas.
7. Filtros combináveis e compartilháveis: categoria, busca sem acentos, modalidade, formação, UF, cidade, online/presencial/híbrido confirmados, nacional, benefício financeiro, premiação financeira, gratuidade, não remunerado explicitamente informado, inscrições abertas, 7/30 dias, contínuo e prazo não informado. Inscrição pela internet não comprova atividade online; falta de dinheiro informado não significa atividade não remunerada. Campos ausentes permanecem desconhecidos.
8. Ranking compartilhado, modular, configurável e determinístico. Adesão temática e elegibilidade são filtros obrigatórios; não se inventa histórico de interação/interesses. Dinheiro confirmado é um sinal pequeno. Diversidade considera organizador (incluindo agrupamento dos provedores EV.G) e categoria editorial principal. Nenhum registro é removido para diversificar.
9. Normalização conservadora de pontuação na apresentação e correção do extrator IFSC para não produzir novamente `prova:.`. Evidências e texto armazenado não são reescritos em lote. O hash de extração muda na rechecagem normal; identidade e edições administrativas são preservadas.
10. Coleta: adicionados termos de eventos, workshops, conferências, seminários, extensão e empreendedorismo ao filtro de descoberta de links. Classificação genérica combina intenção do título, contexto de participação e tópicos da fonte auditada. Curso sobre hackathons não vira hackathon; prêmio genérico não comprova competição. Limites, robots, allowlists, verificações e publicação existentes são preservados.
11. Countdown e formatação monetária existentes preservados. A interface explicita quando o horário final não foi informado. Canonical, título, descrição, Open Graph, Twitter, estados de loading/erro e autenticação de membros preservados/atualizados conforme o escopo.

## Pesos iniciais

`lib/opportunities/ranking.ts` define e documenta:

| Sinal | Peso |
| --- | ---: |
| Evento/competição ou projeto extracurricular explícito | 400 |
| Outra experiência extracurricular confirmada | 300 |
| Natureza não classificada | 100 |
| Ingresso acadêmico formal | 0 |
| Benefício financeiro confirmado | +6 |
| Inscrição aberta | +4 |
| Prazo útil até 30 dias | +3 |
| Verificação nos últimos 7 dias | +2 |
| Repetição do organizador | -4 por ocorrência, máximo -40 |
| Repetição da categoria principal | -1 por ocorrência, máximo -12 |

Os intervalos entre naturezas superam todos os sinais secundários e penalidades. Dinheiro ou urgência não promovem ingresso formal acima de experiências extracurriculares no feed padrão. Categoria/modalidade/busca explícitas desativam a preferência de natureza para respeitar o assunto escolhido. UF e formação apenas restringem elegibilidade. Empates usam prazo e ID. O algoritmo recebe configuração e relógio para testes; não há pesos em JSX. Não há modelo de recomendação personalizado nem captura adicional de comportamento.

## Antes/depois e evidência

A medição reproduzível usa apenas a captura pública salva, sem banco de produção. `scripts/audit-radar-catalogue.mjs` compara a aplicação das novas regras sobre o mesmo conjunto de IDs; os resultados ficam em `docs/radar-optimization-snapshot-20261016.json`.

- Antes: vestibulares apareciam automaticamente, em seção antes dos resultados; depois: exigem `categoria=vestibular` e participam da mesma paginação.
- Antes: todos os 1.180 detalhes enviados; depois: até 24 entradas por página. Um processo selecionado pode levar suas múltiplas opções no mesmo card; opções individuais não contam como 59 cards.
- Antes: prazo dominava a página pública; depois: natureza, benefício limitado, atualidade e diversidade se combinam no servidor.
- Antes: busca e localização não restringiam contagens de categorias; depois: metadados seguem o mesmo escopo de consulta.
- Antes: requisitos longos dominavam cards; depois: informações completas acessíveis sob divulgação progressiva.

A categoria formação permanece volumosa, pois cursos legítimos continuam consultáveis. A otimização de interface/ranking não cria oportunidades extracurriculares que as fontes ainda não cobrem.

## Validação

Apogee: **292 testes aprovados**, lint e typecheck aprovados. O backend passou com **244 testes**, lint e typecheck aprovados. O **build final de produção local foi aprovado**, incluindo os últimos ajustes de performance, contraste e espaçamento. Suítes cobrem acesso, autenticação, filtros, preservação de cursos e IDs administrativos, janela de inscrição, BRL, custos/benefícios, diversidade, agrupamento antes da paginação, nacional com endereço nulo e classificação ambígua.

### Resultados da captura pública com as regras novas

| Medida | Antes | Depois local, mesma captura |
| --- | ---: | ---: |
| IDs individuais preservados | 1.180 | 1.180 |
| Entradas no feed padrão | 1.082 | 1.080, com os dois vestibulares acessíveis pelo filtro |
| Registros detalhados no pacote inicial | 1.180 | 24 |
| JSON do catálogo/dados iniciais | 2.102.122 bytes | 38.584 bytes com facetas e paginação |
| Filtro vestibular | automático no início | 2 cards, 59 + 41 opções |
| Vestibular + SC + Gaspar | não havia seleção explícita | 1 card, 2 cursos |

A redução aproximada de **98,2%** refere-se aos dados JSON serializados, não ao total de recursos da página nem a Core Web Vitals. O HTML HTTP completo medido no build final local foi de **175.464 bytes**, comparado a **2.539.367 bytes** da captura pública anterior; as duas medições usam a mesma captura de oportunidades, mas os ambientes são diferentes. Não se deve interpretar essa comparação como resultado de produção. O ranking original por varredura teve custo de 4.910 ms para seis consultas da auditoria; a versão por grupos executou as mesmas seis consultas em 85 ms nesta máquina. São medições locais pontuais, não um benchmark de produção. Um teste compara integralmente as duas estratégias em um catálogo variado e garante os mesmos resultados.

### Navegador local

Build de produção local, ponte temporária reconstruída a partir do DTO público salvo. Confirmados:

- 24 cards iniciais, sem vestibular; primeiros resultados com TRT-SC/UDESC, NASA Space Apps, StartTech NIAVI, Startup Weekend e ACATE.
- Dois cards ao escolher vestibular; listas fechadas inicialmente, com 59 e 41 opções. A lista expandida de 59 cursos tem área de rolagem de 352 px, preservando todo o conteúdo.
- Seleção de SC e Gaspar pelos controles reduz para Química e Informática em um processo; limpar a categoria retorna a 24 cards.
- Busca de Química funciona sem habilitar vestibulares implicitamente. Página 2 traz 24 cards e nenhum título repetido em relação à primeira página no cenário testado.
- Escape fecha os filtros e retorna foco ao botão. Nenhum erro de console observado.
- Sem overflow horizontal em 1440, 390 e 320 px. O relógio avançou durante o teste, sem alteração de seu componente. A família calculada dos títulos é Instrument Serif local. O H1 final visível é Radar de oportunidades; os textos removidos não aparecem no conteúdo final.
- A captura de imagem falhou por timeout em duas tentativas. A inspeção foi funcional e por DOM/geometria, sem aprovação visual por screenshot. Login real de membros e métricas de campo de produção permanecem pendentes.

## Lacunas e próxima iteração

- Auditar individualmente URLs oficiais de edições de hackathons, competições, eventos universitários, extensão, incubadoras e aceleradoras, usando o watchlist/discovery já existente. Priorizar qualidade e variedade por organizador e monitorar distribuição por natureza. Não ativar listas genéricas ou páginas bloqueadas; não tratar descoberta como publicação.
- Cadastro de fontes e alterações de dados/rechecagens em produção dependem de revisão e autorização específica. Nenhuma fonte foi adicionada ou ativada aqui. As mudanças no coletor só afetam coletas futuras quando houver release autorizado.
- A ponte ainda consulta o conjunto publicado completo no servidor. Paginação SQL e agregação de facetas na ponte são uma próxima evolução do contrato, com testes de paridade/RLS e métricas reais antes de mudar a API. Esta etapa elimina o envio de centenas de detalhes ao navegador.
- Formato, área e requisitos têm cobertura desigual. Os novos filtros não completam dados ausentes; muitas oportunidades podem ficar de fora de filtros específicos até que a fonte informe dados claros. Vagas/campus/modalidade continuam acessíveis no texto de requisitos, sem um schema inventado.
- A evidência do navegador local usa a captura pública reconstruída no formato da ponte, sem consultar banco remoto. Não prova login autenticado de membros nem Core Web Vitals de produção. Ambas as rotas compartilham o mesmo seletor e os gates de sessão são testados.
- Outro chat alterou a prioridade pública no branch original durante esta execução. Este trabalho foi isolado para preservar aquele deploy. A integração das branches e a validação de CI do SHA final precisam ocorrer antes de qualquer publicação desta otimização.
- Priorizar medição de cliques e conversão consentida, completude de fontes, p95 da consulta e dados de campo de performance antes de personalizar pesos ou criar histórico comportamental.

## Arquivos

Frontend: `app/oportunidades/page.tsx`, `app/membros/oportunidades/page.tsx`; componentes `opportunities-board.tsx`, `admission-process-card.tsx`, `opportunities.module.css`; biblioteca `access.ts`, `types.ts`, `radar-client.ts`, `member-feed.ts`, novos `catalogue.ts` e `ranking.ts`; testes e script de auditoria.

Backend: `src/lib/ingestion/categories.ts`, `normalize-opportunity.ts`, `normalize-ifsc-technical.ts`, `index.ts`; `src/lib/discovery/daily-discovery.ts`; testes de classificação contextual. Não há migração.


## Resultado de entrega

Implementação validada localmente: **536 testes aprovados** (292 Apogee + 244 Radar), lint e tipos dos dois projetos, build de produção local, `git diff --check` e testes funcionais/responsivos no navegador. O relatório estruturado está em `docs/radar-optimization-validation-20261016.json`.

Sem push, PR, merge, ativação de fontes, alteração de banco, DNS ou deploy por este chat. A branch original e o trabalho do outro chat foram preservados. Antes do release, integrar esta branch ao estado atual, executar CI sobre o SHA integrado e validar a rota de membros com autenticação real. A revisão visual por screenshot não foi concluída devido ao timeout informado.
