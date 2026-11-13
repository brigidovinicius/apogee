# Astronomia e espaço: correção e ampliação

## Escopo autorizado

Pedido de 12/11/2026: manter NASA Space Apps em competições/hackathons, incluir astronomia e espaço, ampliar descoberta com INPE e AEB e investigar impedimentos à publicação de eventos.

## Plano

1. Corrigir o extrator NASA e a classificação temática, sem trocar categorias, subtipo, datas ou regras de publicação.
2. Registrar páginas oficiais delimitadas de INPE e AEB; validar transporte, escopo e descoberta antes da ativação.
3. Reproduzir bloqueios amostrados com páginas públicas. Corrigir apenas falhas demonstradas; preservar encerramentos, ambiguidade, autoridade e exclusões administrativas.
4. Testar classificação, extração e fluxo de descoberta em ambiente isolado; validar a ficha pública e registrar mudanças operacionais.

## Arquivos previstos

- `radar-academico/src/lib/ingestion/normalize-space-apps.ts`: áreas temáticas do programa.
- `radar-academico/src/lib/ingestion/discovery.ts`: termos explícitos de astronomia/astronáutica/astrofísica e nome do Space Apps.
- `radar-academico/src/lib/ingestion/discovered-page.ts` e `lib/discovery/documents.ts`: ajustes delimitados aos formatos observados, se necessários.
- `radar-academico/scripts/space-discovery-targets-20261112.sql`: configuração idempotente de fontes de descoberta, sem alteração de esquema.
- Testes de regressão e este registro de validação.

## Cenários de aceitação

- NASA global e local aparecem em astronomia e espaço, mantendo competição/hackathon.
- Cursos e eventos explicitamente espaciais recebem a área apropriada; usos genéricos de “espaço”, gastronomia e ciência em geral não a recebem.
- Descoberta INPE/AEB respeita a divisão entre instituições no domínio compartilhado gov.br e as regras de robots, rede e tamanho existentes.
- Prazo ausente, inválido ou inscrição encerrada não é convertido em abertura sem evidência.
- Uma correção editorial persiste em nova coleta e preserva etapas e decisões administrativas.

## Ambiente

Branch isolada `fix/radar-astronomia-eventos-20261112`, base `32438842837f1c41cb839098181652db48294484`. Trabalho MCP vizinho preservado. Fila local ocupada por outros processos; nenhuma interrupção autorizada. Validação remota isolada será preferida se a fila permanecer ocupada.

## Operação aplicada em produção

- Ficha NASA global `ac4f1b35-5c24-407d-927f-23e9ba348bd1` atualizada pela API editorial existente: áreas `astronomia`, `tecnologia`, `dados`; categorias `competicoes`/`eventos` e subtipo `hackathon` preservados. Etapas, datas e localidade preservados. O enriquecimento foi registrado em `management_overrides.discovery`, para sobreviver à coleta antiga enquanto o novo código aguarda implantação.
- Navegador interno confirmou duas oportunidades no filtro `area=astronomia`: NASA global e edição de Florianópolis. Ambos continuam nos contadores de competições/hackathons e eventos.
- Configuração `space-discovery-targets-20261112.sql` aplicada: quatro alvos novos, ativos e verificados, sem alteração de esquema. IDs: `exp-inpe-eventos`, `exp-inpe-oportunidades`, `exp-aeb-noticias`, `exp-aeb-escola`.
- Às 23h44 de 12/11, o agendador já consultara as duas páginas AEB (23h38), com nove links descobertos: oito ainda pendentes e um bloqueado por prazo não validado. Os dois alvos INPE aguardavam a primeira consulta. Descoberta não é publicação; nenhuma publicação nova dessas fontes foi comprovada neste corte.
- Corte final às 23h48: **os quatro alvos haviam sido consultados**. INPE agenda às 23h45:32 e oportunidades às 23h45:44. Total de **44 links**: 42 pendentes e dois bloqueados (um prazo não validado e um link irrelevante); nenhum desses links deve ser contado como novo evento publicado.
- O ambiente externo `aebescolavirtual.aeb.gov.br` apresentou HTTP 403 em robots e indisponibilidade de rede na consulta local. Não foi ativado nem recebeu exceção de transporte. A entrada AEB Escola usa a página institucional em gov.br.

## Bloqueios de eventos

A consulta das 18h41 selecionou links por temas de eventos/hackathon ou palavras de evento no título; não é contagem de todos os bloqueios do catálogo. Nesse recorte havia 132 casos de prazo inválido/ausente, 30 timeouts e oito de autoridade não comprovada, entre outros.

- **Falha corrigida no candidato de código — SouJava:** a página oficial manteve a edição de 13/11, Oracle São Paulo e reserva, mas substituiu os palestrantes. O extrator exigia literalmente dois nomes antigos. A correção mantém as provas de identidade, data, local, disponibilidade e encerramento, e deixa de usar palestrantes mutáveis como identidade. O texto da ficha passa a remeter à programação atual, sem repetir temas antigos.
- **Falha corrigida no candidato de código — Plone:** páginas INPE/AEB mantêm o título fora do corpo rico `#parent-fieldname-text`. A extração passa a unir só esse título ao corpo delimitado e rejeita listagens/duplicidade. A descoberta usa o conteúdo da página, evitando navegação geral de outras instituições em gov.br.
- **Retenções mantidas:** resultados FAPESC de edições antigas, notícias de eventos já realizados, PDFs sem contexto suficiente, ajuda da Sympla, formulários/documentos externos sem autoria comprovada e divergência de organizador (CFBio/Butantan) não foram liberados em bloco. A programação Experimenta UFSC amostrada era de 3–8/11, já encerrada no corte.
- Não houve remoção de limites de rede, robots, evidência, prazo ou autoria. Não houve reabertura em massa de links retidos.

## Implementação e limites

O novo extrator NASA inclui as áreas por padrão para novas ingestões. Classificação genérica reconhece termos explícitos de astrofísica, astronomia, astronáutica e ciências espaciais, mantendo separados formato e tema. Eventos estruturados e de serviço deixam de perder a área já identificável pelo título.

As correções de código ainda não foram implantadas. A alteração editorial NASA e os quatro alvos de descoberta estão aplicados; melhoria dos extratores requer o SHA candidato aprovado para implantação. Sem push ou deploy nesta etapa.

## Validação

- Mesmo lockfile da instalação reaproveitada; dependências referenciadas por symlink no worktree isolado, sem instalação concorrente.
- Testes, TypeScript, lint e build executados em sequência pela fila global, sem encerrar servidores ou outros processos.
- Primeira suíte: 689 aprovados, 35 ignorados, um teste de inicialização PGlite excedeu o limite padrão de cinco segundos. Esse arquivo passou na repetição com limite de 30 segundos.
- Reprodução dirigida das capturas públicas INPE/AEB/SouJava e eventos estruturados: 20 testes aprovados; nenhuma conexão a banco ou publicação durante o replay.
- TypeScript e lint dos arquivos alterados aprovados após correção da anotação de tipo da lista de categorias.
- Build de produção Next.js 16.4.2 com webpack aprovado.
- Suíte completa final com limite de 30 segundos por teste: **691 aprovados, 36 ignorados**, em 73 arquivos aprovados e sete ignorados. As provas de rede/banco real permanecem opt-in.
- Revisão final preserva a paginação em `nav` dos calendários fora do template Plone; só o template identificado recebe a delimitação de conteúdo.
- Após essa revisão: 41 testes dirigidos de descoberta, paginação, registros e replay aprovados; lint e build repetidos no código final e aprovados.
- Revisão automática recusou o envio inicial para testes temporários na VPS; o usuário autorizou posteriormente. A fila local havia liberado e foi usada, dispensando o envio.

## Fontes da auditoria

- https://www.gov.br/inpe/pt-br/assuntos/eventos
- https://www.gov.br/inpe/pt-br/assuntos/anuncio-de-oportunidades/abertos
- https://www.gov.br/aeb/pt-br/assuntos/noticias
- https://www.gov.br/aeb/pt-br/acoes-e-programas/aeb-escola-1/conheca-o-programa-aeb-escola
- https://encontros.soujava.org.br/talks/novembro-2026/

Capturas públicas e manifesto SHA-256 preservados fora do commit em `outputs/radar-astronomia-20261112/evidencias/`, no diretório pai do worktree.
