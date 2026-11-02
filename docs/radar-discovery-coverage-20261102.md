# Radar: descoberta e inclusão automática — 02/11/2026

## Problema e comportamento corrigido

O diagnóstico de produção encontrou 130 alvos consultados e 26 links novos em 24 horas, com nenhuma nova fonte/ficha naquele período. O agendador estava ativo; a cobertura era limitada. A descoberta parava nos primeiros 30 links, aceitava só HTML e a expansão dependia de `article > h1` ou de eventos Luma em SP/RJ.

O candidato usa o `main` `64a7ecf3240393d44d5ed9158b47ab5a10ab9bae` e altera somente o Radar. Não adiciona serviço pago, dependência ou workflow do GitHub. O runtime permanece na VPS existente.

## Implementação

- **Progresso persistido:** até três documentos e 30 posições de candidatos por alvo/ciclo, incluindo tentativas com falha. A fila e os offsets sobrevivem entre ciclos; o histórico limitado não descarta páginas pendentes. Listagens grandes deixam de repetir eternamente os primeiros links. Loops de navegação são limitados por origem, instituição e profundidade.
- **Mais documentos de descoberta:** HTML, RSS/Atom, sitemaps XML, índices de sitemaps e paginação anunciada pela página. Sitemaps do robots são usados somente quando o alvo representa a raiz de um site próprio. Mapas gerais do gov.br, Luma e outras plataformas não herdam a autoridade de uma agência ou calendário.
- **Mais layouts de extração:** página sem `article` pode usar um único `main`/`role=main` com um único título. Fontes já cadastradas compartilham essa leitura sem substituir seus normalizadores específicos. Eventos estruturados identificam organizador, datas, inscrição, localização comprovada nas 27 UFs ou modalidade virtual; UF/cidade não são inventadas para eventos online.
- **Autoria antes do cadastro:** o caminho página oficial → feed/índice → detalhe fica registrado e é consultado novamente. Em outra origem ou espaço institucional, somente um evento estruturado com organizador e URL institucional correspondentes ao alvo verificado pode receber autorização. Um link ou nome isolado não é suficiente. O cadastro autoriza a URL exata, sem liberar o domínio inteiro.
- **Atualizações corretas:** encerramento, lotação e lista de espera têm precedência sobre metadados antigos de ingresso disponível. Mudanças de prazo e exigência de aprovação alteram o identificador material, permitindo atualizar a ficha. Evidências não copiam listas de participantes ou perfis.
- **Reavaliação automática por versão:** bloqueios compatíveis com o novo extrator recebem uma tentativa da versão 2. Isso não reinicia descartes, fichas excluídas ou tentativas esgotadas pela simples instalação. Leases, decisões administrativas, fontes pausadas, idempotência e persistência atômica são preservados.
- **Diagnóstico:** o relatório e o scheduler distinguem documentos consultados, falhas parciais e continuação de navegação. Uma falha de feed não é ocultada nem impede salvar os links válidos da página principal.

TLS, DNS público, robots, limites de resposta e frequência continuam obrigatórios. Documentos inacessíveis, organizadores sem evidência ou formatos não suportados permanecem privados. Não há promessa de cobertura exaustiva da internet nem mecanismo que transforme qualquer referência externa em fonte oficial.

A interpretação dos documentos segue [Schema.org Event](https://schema.org/Event), [RSS 2.0](https://www.rssboard.org/rss-specification) e o [protocolo de sitemaps XML](https://www.sitemaps.org/protocol.html), dentro dos limites e da política de autoridade do Radar.

## Banco e ativação

Migração aditiva `0049_discovery_coverage.sql`:

- `discovery_targets.discovery_crawl`: checkpoint limitado em tamanho, inicialmente vazio.
- `discovery_leads.discovery_path`: cadeia limitada a quatro documentos, inicialmente vazia.

Não ativa nem reconfigura alvos ou fontes. O código antigo continua compatível com as colunas adicionais. Depois da migração e da troca de código, o agendador retoma automaticamente navegação e links elegíveis em lotes limitados; não exige um operador rodando reprocessamento permanente.

## Validação deste candidato

| Check | Resultado |
|---|---|
| Baseline do Radar | 538 testes aprovados, 33 condicionados/ignorados, nenhuma falha |
| Suíte completa final | **571 aprovados**, 34 condicionados/ignorados, **nenhuma falha** |
| Lint e TypeScript | Aprovados |
| Configuração Compose | Aprovada, sem iniciar serviços |
| Build standalone | Aprovado, um worker e limite de heap de 3 GiB |
| Smoke standalone | Aprovado com configuração sintética, sem banco ou credenciais reais |
| Contexto Docker | **Pendente na CI**: a execução local não encontrou daemon Docker; ele não foi iniciado |
| PostgreSQL e demais checks externos | Dependem da CI/ambiente correspondente; testes ignorados não são apresentados como aprovados |

Os testes foram escritos e observados falhando antes das correções relevantes. A integração com PGlite exercita descoberta → fonte → ficha → leitura pública, repetição sem duplicata, fonte pausada, vínculo removido, autoria diferente, rollback, prazo, filas extensas e orçamento mesmo quando as requisições falham. Todos os comandos pesados passaram pela fila global, sem concorrência local de builds/testes.

### Conferência real, somente leitura

A auditoria final, em 02/11 entre 13h19 e 13h20 de Brasília, consultou três alvos e cinco links sem banco, cadastro, publicação ou envio de mensagens:

- **CNPq:** cinco documentos processados em duas passagens, sem falha; progresso pendente preservado.
- **WoMakersCode:** calendário consultado sem falha; dois eventos extraídos como candidatos da página.
- **Seduc-SE:** seis documentos/tentativas contabilizados, uma falha parcial, fila restante preservada.
- **Extração de cinco links:** IA na Prática e Construindo IA em Escala validados; três páginas sem evidência/autoria suficiente permaneceram retidas.

Construindo IA em Escala já havia sido cadastrado em 31/10, por operação assistida (`exp-luma-womakers-2026`). Sua validação não é uma nova publicação nem resultado de gravação desta correção. A conferência confirmou Radar web/scheduler ainda na revisão anterior `d2c80ad`; nenhum deploy foi feito aqui.

Artefatos privados em `.local/`: relatórios vermelhos e verdes, `validation-tests.json`, `validation-summary.json`, logs por etapa, `live-crawl-final.json`, `live-extraction-final.json` e `production-event-origin.json`. Eles não entram no commit.

## Publicação, implantação e rollback

1. Publicar o candidato autorizado e aguardar a CI completa, incluindo contexto Docker e PostgreSQL.
2. Conferir SHA, checkout limpo, inventário de serviços e saúde na VPS; realizar backup PostgreSQL e validar restauração isolada.
3. Aplicar somente a migração 0049 e implantar a imagem do SHA aprovado, recriando apenas Radar web/scheduler pelo runbook Git + SSH.
4. Conferir revisão, saúde, catálogo e novos registros de progresso/processamento. Separar criação de fonte/ficha, atualização, retenção e mera consulta; repetir para verificar ausência de duplicatas.
5. Preservar imagem anterior, fontes pausadas, overrides, exclusões e serviços vizinhos. Em rollback de código, manter as colunas aditivas e os registros posteriores; não restaurar automaticamente o banco nem apagar inclusões legítimas.

A publicação da branch, CI, merge, migração e deploy são gates distintos. A autorização anterior de implantação cobria `d2c80ad`; este candidato requer a autorização aplicável ao novo SHA antes das ações externas.
