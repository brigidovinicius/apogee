# Busca do Radar — implementação local

Base: `8f9b031627a3ee2ebcd79d4dc0d5fe9e9773dae9`. Branch: `feat/radar-search-20261109`.

## Comportamento e plano

- Busca por nome de evento, instituição, áreas verificadas, categorias e localização, combinando palavras entre campos e em qualquer ordem.
- Acentos, caixa, espaços, hífens e pontuação normalizados; siglas curtas e anos com correspondência por palavra.
- Nome exato e trechos do título precedem os resultados por tema ou descrição. Critérios editoriais existentes continuam como desempate.
- Aliases explícitos de marcas e de temas, sem inferir áreas da instituição. Recuperação moderada de um termo com erro, após resultados precisos.
- Home envia a consulta ao catálogo completo; os destaques deixam de simular uma busca global limitada à prévia.
- Rótulos, consultas sugeridas e resultado vazio melhorados. Filtros, paginação, calendários e limites de acesso preservados.

Arquivos: `lib/opportunities/{vocabulary,search,types,discovery,ranking}.ts`, componentes `opportunities-board.tsx`, `calendar-filters.tsx`, `search-suggestions.tsx` e `earth-radar-list.tsx`; testes de busca, regressão e navegador. Sem tabela, migração, dependência nova, telemetria ou API pública adicional.

Cenários: nomes completos/parciais/invertidos, nome + instituição, temas cadastrados, siglas, pontuação, erros moderados, ranking, filtros combinados, paginação, calendário, vazios, indisponibilidade e proteção dos detalhes. Dados sintéticos e lote editorial histórico, com relógio controlado. Nunca usar disponibilidade histórica como evidência de inscrições abertas hoje.

## Validação

Executada em 09/11/2026, sequencialmente pela fila global do Mac:

| Verificação | Resultado |
| --- | --- |
| Suíte completa: `npm test` | 710 testes passaram; zero falhas, pulados ou cancelados; 56,3 s. |
| TypeScript: `npm run typecheck` | Passou. |
| ESLint dos arquivos alterados | Passou. |
| Build: `npm run build` | Passou; Next.js 16.4.2, Webpack, perfil local de produção com um worker e teto de memória de 2 GB. |
| Navegador: `scripts/test-radar-search-browser.mjs` | 21 checks passaram em Chrome headless, desktop 1280×900 e celular 390×844; zero erros JavaScript e zero conexões de banco. |
| Desempenho sintético | 1.044 registros; consultas por título, tema, erro de digitação e sem correspondência; 45–74 ms para construir a página completa, incluindo filtros, contagens, ranking e paginação. Não inclui rede ou banco. |
| Diff | Revisado; `git diff --check` sem erros. |

O teste de navegador inicia somente um servidor Next e um catálogo HTTP sintético em loopback, bloqueia requisições externas e métodos de escrita no navegador, usa ambiente explicitamente limitado e uma conexão de banco armadilha. Encerra apenas seus próprios processos ao terminar. O servidor temporário já foi encerrado; nenhum servidor de outro chat foi interrompido.

A revisão independente de código detectou a colisão por prefixo entre UFSC e UFSCar. Foi corrigida com correspondência por palavra para siglas reconhecidas; testes negativos cobrem essa distinção em maiúsculas/minúsculas. As consultas de palavras comuns também preservam plural, prefixo e recuperação moderada de erros independentemente da caixa.

Evidências locais fora do Git: `../outputs/radar-busca-20261109/`, com logs de testes, lint, tipos, build, navegador e capturas desktop/mobile. Os eventos das capturas são simulados; suas datas não representam disponibilidade real.

Para repetir o navegador após o build, executar pela fila global:

```sh
RADAR_SEARCH_PLAYWRIGHT_MODULE=/caminho/local/playwright/index.mjs \
python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py \
  --command node scripts/test-radar-search-browser.mjs /caminho/absoluto/evidencias/
```

Se `playwright` já estiver resolvível no ambiente local, a variável de módulo é opcional. O caminho de saída precisa terminar em `/`. Não instalar nem iniciar outro servidor em paralelo para executar a validação.

## Limites e decisões

- Aliases são explícitos e revisáveis: IA/AI, EAD/online, machine learning/aprendizado de máquina, quatro instituições e variantes HSM+/REC’n’Play. Não é um dicionário exaustivo de todas as siglas e marcas.
- Uma consulta pode recuperar no máximo um termo digitado incorretamente, com pelo menos cinco letras; termos numéricos e siglas curtas não têm recuperação aproximada. Resultados aproximados ficam depois das correspondências precisas.
- Os filtros continuam obrigatórios. Ampliar uma pesquisa sem correspondências requer uma ação explícita do usuário; essa ação conserva a consulta e remove os demais filtros.
- Home consulta o catálogo completo ao enviar o formulário. As sugestões enquanto se digita são temas do vocabulário existente, via datalist nativo; não consultam a rede e não expõem detalhes protegidos.
- Calendários compartilham a correspondência textual, preservando a ordem cronológica das etapas. O catálogo público e o de membros compartilham também o ranking por relevância.
- O acesso autenticado foi validado em testes isolados da DAL e da página de catálogo compartilhada. O navegador verificou o redirecionamento anônimo preservando a pesquisa; não foi criada conta ou sessão em banco real.
- Banco e disponibilidade atuais de produção não foram consultados. Publicação continua sendo uma etapa separada.

## Publicação

Não publicada. Revisar o candidato validado antes de qualquer push ou deploy.
