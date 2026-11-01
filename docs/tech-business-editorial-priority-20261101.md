# Prioridade editorial: tecnologia, empreendedorismo e premiações

Implementação local em 01/11/2026, sobre `main` `ea993532bd09fb07c87674adaf94d89bfdbe7b51`. Branch: `fix/home-horizontal-filters-20261101`, incluindo também a retirada da lateral duplicada, ainda não publicada.

## Comportamento

- A ordenação compartilhada da home, Radar público e Radar de membros favorece competições/hackathons e eventos de tecnologia, IA, inovação, startups, negócios e empreendedorismo. Usa categorias, subtipo e áreas estruturadas ou o título da atividade; o nome de uma instituição tecnológica não estabelece o tema de um evento.
- Premiações financeiras confirmadas têm peso adicional maior que os desempates e penalidades de repetição. Nenhum valor bruto é usado para fazer uma oportunidade parecer melhor. Admissões formais e vestibulares não recebem esses reforços.
- Entre os eventos preferidos, realização nos próximos sete dias recebe desempate maior, seguida da janela de 30 dias. A data de realização não substitui o prazo de inscrição.
- Busca ou assunto explícito preservam a escolha da pessoa. Os filtros de eventos/competições mantêm o reforço de premiações. As demais oportunidades continuam no catálogo.
- A home reaproveita o componente financeiro existente para exibir rótulo, valor e condições confirmadas. A apresentação mantém legibilidade sobre fundo claro, valores totais e os destinatários da premiação.
- O servidor determina o ranking; o cliente da home conserva essa ordem. Evidências, controles administrativos e campos protegidos não foram ampliados.

## Coordenação entre tarefas

A tarefa **Verificar atualização do Radar** (`01a1971b-d83f-7863-90b5-ae96af985a43`) é responsável pelo fluxo de descoberta, validação/cadastro de fontes e ingestão. O candidato observado nessa tarefa é `d2c80ad`, no checkout `radar-source-expansion-20261101`.

Comparação com as bases atuais: dez arquivos deste pacote contra 17 daquela correção, **zero caminhos em comum**. Nenhum arquivo em `radar-academico` foi alterado neste chat. Ambos os candidatos usam `ea99353` como ancestral. A comparação é um retrato da conferência; conferir novamente antes de integração/publicação se qualquer candidato mudar.

A [pesquisa de 14 eventos](../research/tech-business-events-20261101/README.md) e o [JSON de referência](../research/tech-business-events-20261101/events.json) estão preparados para integração pelo fluxo de fontes. Não importam nem ativam fontes automaticamente. Front in Floripa foi identificado como esgotado; inscrições de público, mentorias, submissões, startups e prêmios foram mantidas como modalidades distintas.

## Validação

Tudo executado sequencialmente pela fila global do npm, sem encerrar processos de outros chats:

- `node --test --test-concurrency=1 tests/radar-catalogue.test.mjs tests/radar-member-feed.test.mjs tests/home-opportunities.test.mjs tests/earth-home.test.mjs`: **52 testes aprovados**, inclusive após rebase no main atualizado. Cobertura inclui prêmios, temas, diversidade, busca/filtros, prioridade antes da paginação, paridade com a home e preservação dos dados originais. Os mocks de links dos testes existentes ainda emitem aviso de atributo `prefetch`; nenhuma falha.
- `npm run lint -- lib/opportunities/ranking.ts components/home/earth-radar/earth-radar-list.tsx components/opportunities/opportunity-financials.tsx tests/earth-home.test.mjs tests/radar-catalogue.test.mjs`: aprovado.
- `npm run typecheck`: aprovado no main atualizado.
- `git diff --check`: aprovado.
- Integridade da pesquisa: 14 IDs únicos, todos `research_only`, sem prazos de inscrição inferidos.
- Preview local com API de teste em loopback, três registros fictícios, nenhuma conexão de dados reais: home e `/oportunidades` exibiram primeiro hackathon premiado, depois summit de tecnologia/negócios e depois evento geral de saúde, apesar dos prazos anteriores dos outros registros.
- Home em 1440 e 390 px; Radar público em 390 e 320 px, sem overflow de página. Uma única faixa de categorias na home e nenhuma lateral. Valor e condições da premiação legíveis; console sem erros/avisos nas páginas verificadas. Preview temporário encerrado ao final.

Capturas com dados fictícios:

- `/Users/viniciusbrigido/.codex/visualizations/2026/11/01/01a1972e-f3bb-7002-87da-050e3bfc5b5a/home-prioridade-premios-desktop.jpg`
- `/Users/viniciusbrigido/.codex/visualizations/2026/11/01/01a1972e-f3bb-7002-87da-050e3bfc5b5a/home-prioridade-premios-mobile.jpg`

Não foi executado build completo local; as rotas alteradas foram compiladas pelo Next durante a conferência, além dos testes, lint e tipos. Sem push, PR, merge, deploy, migração, inscrição ou escrita de dados reais. Publicação depende de autorização após revisão, conforme `make-it-fly-current/AGENTS.md`.
