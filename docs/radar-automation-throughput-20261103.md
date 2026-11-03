# Automação do Radar — seleção, fila e destaques

## Escopo e causas

Base `1ce5394`, branch `fix/radar-automation-throughput-20261103`. A consulta somente leitura de 03/11 às 10h56 encontrou 1.466 links pendentes, entrada de 1.418 links/24h e zero fichas novas/24h. O processador consumia dois links por ciclo. A descoberta aceitava mídia e relevância herdada de diretórios; um alvo concentrava 753 links. O extrator genérico não reconhecia olimpíadas e descartava páginas com título no `main` e conteúdo em um `article` interno.

Publicação automática já está habilitada: somente candidatos com autoria, evidência, inscrição e prazo válidos entram no catálogo. Retenção não implica necessidade de aprovação humana. Preservar exclusões, overrides, fontes pausadas, leases, idempotência, robots, TLS e limites por domínio.

## Plano por comportamento

1. `discovery/documents.ts` e nova política comum: rejeitar mídia/navegação, não herdar relevância de diretórios ancestrais; priorizar inscrições e chamadas. Aplicar a seleção também aos links antigos antes de qualquer HTTP.
2. `discovery/process-leads.ts`: até 24 candidatos sequenciais por execução, prazo de rede compartilhado de 90 segundos, claim individual, alternância de alvos, prioridade para chamadas e envelhecimento em 48 horas. A cada quatro posições, priorizar uma reavaliação da versão anterior, se existir, sem retirar as validações. Não deixar leases de candidatos ainda não iniciados. Nenhuma concorrência de requisições adicionada.
3. `ingestion/discovered-page.ts` e `normalize-opportunity.ts`: reconhecer títulos de olimpíadas e o layout semântico com título externo ao article, sem aceitar listagens ambíguas.
4. `opportunities/ranking.ts`: rotação diária determinística com peso inferior a um ponto, preservando prioridades editoriais, benefícios, urgência e diversidade. Home e Radar usam a mesma ordenação do servidor.
5. `components/home/home-radar.tsx`: reutilizar a atualização de catálogo já existente no Radar, inclusive com a página aberta. Remover eventos iniciados na prévia.

## Validação e implantação

Testes de regressão antes das correções: documentos ruidosos; fila superior a dois; alternância de alvos; mídia antiga sem HTTP; publicação de olimpíada até o catálogo público; limite de tempo; rotação estável no mesmo dia e variável entre dias; renovação e expiração de destaques. Suítes completas do Radar e site, lint, tipos e builds sequenciais pela fila global. Sem migração ou dependência nova prevista.

Referências: [Next.js router.refresh](https://nextjs.org/docs/app/api-reference/functions/use-router), documentação instalada Next.js 16.4.2 de cache e [PostgreSQL SELECT / SKIP LOCKED](https://www.postgresql.org/docs/17/sql-select.html).

Publicação e deploy exigem autorização explícita após revisão, conforme `make-it-fly-current/AGENTS.md`. Antes disso, preparar o candidato validado e o procedimento de implantação.

## Correções após a revisão

- Coleções específicas como `/editais/2026/001` conservam seu contexto; uma raiz genérica como `/olimpiada/001` não dá relevância sozinha.
- PDFs continuam descobertos, mas só seguem à leitura quando a URL exata é o suplemento de um adaptador já cadastrado e autorizado. Outros PDFs ficam retidos sem HTTP, assim como imagens. A ingestão regular desses adaptadores permanece preservada.
- A versão 3 de extração recebe tentativas limitadas para bloqueios compatíveis; não reinicia descartes, fontes pausadas, tentativas esgotadas ou decisões administrativas.
- O prazo absoluto acompanha robots, redirecionamentos, esperas por domínio e os documentos da cadeia via contexto assíncrono. Cada requisição mantém também o timeout anterior de 15 segundos. Timeout mantém a retentativa com backoff; nenhum lease de candidato não iniciado é criado.
- Categorias vêm dos tópicos verificados do monitor, são verificadas novamente antes da gravação e são preservadas no cadastro da fonte. Não se inventam prazos, localidades ou premiações.
- A rotação adiciona menos de um ponto apenas às atividades de evento/competição. Prioridades editoriais maiores e faixas de urgência continuam prevalecendo. Dentro da mesma faixa, a rotação pode alterar a ordem antes do desempate por data. Busca textual, área ou modalidade explícita não recebem rotação. A data de referência usa São Paulo.
- Home e Radar renovam o catálogo a cada minuto com a página visível; a home também pode se recuperar de indisponibilidade temporária. Eventos deixam a prévia no início confirmado ou no começo do dia em Brasília quando só há data.

## Evidências locais

- Testes observados falhando antes das respectivas correções: imagem/contexto genérico, mais de dois links, olimpíada e layout, rotação diária, expiração na home, categoria persistida, coleção numérica, fila de reavaliação e prazo de rede.
- Radar final: **581 aprovados, 34 condicionados/ignorados**, nenhuma falha. Inclui PostgreSQL embutido descartável com descoberta → cadastro de fonte → publicação → leitura pública, idempotência e rollback.
- Site: **634 aprovados**, nenhuma falha.
- Teste de fila com 25 imagens antigas e uma chamada de outro alvo: 24 avaliações, uma publicação válida, 23 retenções, dois links ainda pendentes e nenhum lease de trabalho não iniciado.
- Teste de reavaliação com 26 pendentes no mesmo alvo: o candidato anteriormente bloqueado foi reavaliado e publicado no mesmo ciclo limitado.
- Lint, geração de tipos, TypeScript e builds finais aprovados nos dois projetos, incluindo novo build do Radar após as correções do transporte. O site mantém um aviso anterior de `<img>` na galeria.
- Navegador com Next.js compilado e catálogo sintético em loopback: a ficha antiga saiu e a nova apareceu automaticamente nas abas já abertas da home e do Radar, sem reload manual; o filtro `categoria=competicoes` foi preservado. A conferência usou IAB porque o perfil do MCP Playwright estava ocupado por outra sessão, que foi preservada. Servidor e abas temporários encerrados. Evidências em `.local/ui-report.json` e `.local/ui-radar-refreshed.jpg`.
- Toda execução npm/node pesada passou pela fila global. A revisão independente foi somente leitura, sem builds ou testes simultâneos. Nenhuma gravação, reprocessamento, migração ou publicação em produção foi acionada.

Logs e resultados privados em `.local/` não entram no Git. Testes de ambientes externos ignorados não são apresentados como aprovados. Não há promessa de quantidade de novas publicações reais: candidatos ainda precisam passar pelos requisitos oficiais.

## Procedimento de publicação, após autorização

1. Enviar o commit revisado, abrir PR e aguardar CI completa, inclusive PostgreSQL e contexto Docker. Verificar alterações concorrentes no `main` antes da integração.
2. Inventariar as revisões e a saúde atuais na VPS por SSH, conferir checkouts limpos e fazer backup com checksum e restauração isolada. Nenhuma migração nova é necessária.
3. Construir as imagens do SHA aprovado e trocar somente Radar web/scheduler e Apogee web. Preservar `.env`, volumes, redes, certificados, serviços de calendário, autenticação e os demais projetos.
4. A rotina nativa retoma a fila automaticamente; observar redução dos pendentes, retenções, reavaliações e publicações separadamente. Conferir as novas fichas na API e no site. Não contar atualizações ou links encontrados como fichas novas.
5. Conferir a renovação dos destaques na home e no Radar e preservar a imagem anterior para rollback. Reverter código não deve apagar fichas, auditorias ou fontes criadas legitimamente após a ativação.
