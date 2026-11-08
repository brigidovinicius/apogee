# Evolução diária e comparativo semanal do comportamento

Escopo: ampliar o painel administrativo com os agregados existentes. Sem nova coleta, campos pessoais, identificadores, APIs públicas, dependências ou migração. A autorização administrativa permanece antes de qualquer leitura.

Contrato de períodos: últimos 30 dias incluindo hoje (parcial), a partir da data do PostgreSQL no fuso America/Sao_Paulo. Comparativo entre os últimos sete dias completos, excluindo hoje, e os sete anteriores. Datas são calculadas como datas de calendário, sem depender do fuso do navegador.

Histórico: usar a primeira data com registro ainda disponível como referência, sem tratá-la como prova de cobertura contínua. Antes dela, exibir sem histórico. Depois dela, uma data sem registros significa zero eventos registrados, sem afirmar ausência de visitantes. Comparações percentuais exigem que ambos os períodos comecem depois do primeiro registro. Base anterior zero não produz infinito ou crescimento de 100%; exibir sem base percentual e diferença absoluta.

Interface: manter as cores e a tipografia existentes da administração (navy #06162c, superfície #102a48, sutil #173653, branco e azul dos tokens Apogee). Inter em títulos e texto; números com alinhamento tabular. Um gráfico de linha de 30 dias com seleção de visualizações, navegações, ações iniciadas ou filtros; leitura do valor por dia e tabela acessível. Comparativos mostram períodos explícitos, valores e variações neutras, sem associar aumento de volume automaticamente a sucesso. Primeiro histórico e hoje parcial são sinalizados. Layout permanece utilizável em 390 px, teclado e movimento reduzido.

Arquivos previstos: lib/admin/behavior.ts (consulta única e autorizada), lib/admin/behavior-insights.ts (calendário e cálculos puros), components/admin/behavior-insights.tsx e behavior-insights.module.css (visualização), app/admin/comportamento/page.tsx (composição), testes unitários e ensaio PostgreSQL existente.

Validação: limites de mês/ano/ano bissexto; sete dias fechados; exclusão de hoje e futuro no comparativo; zeros, histórico novo e vazio; variação positiva/negativa/base zero; soma entre dispositivos e categorias; autorização antes do banco; erro/feature desativada; consulta em PostgreSQL isolado; renderização e interação do gráfico em desktop/celular. Comandos pesados na fila FIFO, sequencialmente.

## Resultado local em 08/11/2026

Base: `42f7a2fb6b1d03c051387850cf86785766f83b87`, branch `feat/behavior-insights-20261108`. Este documento registra a implementação local; não comprova push, CI, merge ou publicação desta versão.

- `node --test --test-concurrency=1 tests/behavior-insights.test.mjs tests/behavior.test.mjs`: 25 testes aprovados, nenhum erro.
- `node scripts/test-behavior-postgres.mjs`: seis verificações aprovadas em PostgreSQL temporário criado pelo script. Inclui incrementos concorrentes, restrições de categorias, retenção, ausência de identificadores/acesso público e consulta real do painel com semana atual 8, anterior 4 e variação 100%, excluindo uma linha futura sintética.
- `npm run typecheck`: aprovado.
- `APOGEE_LOCAL_PREVIEW=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build`: aprovado, incluindo a rota dinâmica `/admin/comportamento`.
- `node scripts/test-behavior-insights-browser.mjs` com Playwright já instalado: seis grupos de verificações aprovados no build local. Administrador fictício autenticado; quatro métricas; seletor de datas por teclado; tabela acessível; desktop 1440 px; celular 390 e 320 px sem rolagem horizontal da página após estabilização; preferências de sistema claro/escuro; movimento reduzido; histórico novo e vazio; usuário comum impedido; nenhuma requisição POST gerada pelas interações do painel.
- ESLint dos arquivos alterados e `git diff --check`: aprovados.

O ensaio de navegador usa banco e conta exclusivamente fictícios, sem `.env`, credenciais reais ou conexão de produção. Pré-carregamentos automáticos de links fora do percurso são bloqueados. A checagem inicial de largura ocorreu antes de estabilizar o layout; a verificação foi corrigida para aguardar a captura estável. Em outra tentativa, uma recarga substituiu o DOM durante a captura e o log registrou uma ocorrência genérica do provedor de autenticação, sem diagnóstico da causa. O percurso final aguarda a página estabilizar e testa apenas navegação deliberada, sem alterar autenticação ou limites reais da aplicação. Os processos de preview e PostgreSQL criados pelo script são encerrados ao final; os artefatos temporários são preservados.

Evidências locais ignoradas pelo Git em `make-it-fly-current/outputs/behavior-validation/`: `insights-browser.json`, `insights-preview.log`, `insights-daily-desktop.png`, `insights-weeks-desktop.png`, `insights-daily-mobile-390.png`, `insights-daily-mobile-320.png` e `insights-new-history-mobile.png`. Imagens de seção no celular podem incluir a barra fixa da administração sobreposta durante a captura. Todos os números dessas imagens são sintéticos e não representam tráfego real.

Privacidade revisada: não há alteração em coletor, consentimento, retenção, tabela SQL ou regras de publicação. O novo componente recebe somente datas, contagens e estado do histórico. Nenhum identificador de pessoa/conta/sessão, termo pesquisado, valor de filtro, resposta ou URL de navegação é incluído nos gráficos. O painel continua exigindo administrador antes da consulta. A primeira data registrada não prova funcionamento contínuo; zeros e variações devem ser interpretados como eventos registrados, não visitantes, retenção individual ou conversões confirmadas.

## Revisão após o primeiro CI

Publicação do commit `44c87d04aeef25400ce1b2f3075b2864ba09f054` autorizada pelo usuário. [PR #129](https://github.com/brigidovinicius/apogee/pull/129) aberto. O [CI 42509704031](https://github.com/brigidovinicius/apogee/actions/runs/42509704031) aprovou Radar e legado, mas o site terminou com 680/681 testes: a regra global `presentation-text.test.mjs` rejeitou os quatro travessões usados para contagens sem histórico. Nenhum deploy foi realizado.

Correção funcionalmente neutra: somente os quatro marcadores visuais de contagem indisponível foram trocados por hífens simples. Cálculo, consulta, autorização, coleta e regras de privacidade permanecem iguais. Após a correção, suíte completa local 681/681, novo build, seis grupos do ensaio de navegador com dados fictícios e lint do componente aprovados. Novo CI e publicação ainda dependem de conclusão; a autorização recebida citava o SHA anterior.

Preflight atual: checkout remoto limpo no SHA `42f7a2fb6b1d03c051387850cf86785766f83b87`; web saudável com zero reinícios; imagem anterior preservada e checksum do backup existente conferido. Leitura em transação somente leitura confirmou exclusivamente `day`, `page`, `event`, `target`, `device`, `count`, grants restritos ao proprietário `apogee_app` e primeiro registro em 08/11/2026. As contagens existentes incluem validação técnica; não equivalem a visitantes únicos. Nenhum dado ou configuração de produção foi alterado.

O registro no Linear foi recusado pela revisão automática por falta de autorização explícita para enviar detalhes do projeto àquele serviço. Não houve escrita no tracker; este documento mantém a evidência local.
