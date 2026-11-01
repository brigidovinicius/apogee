# Homepage: filtros horizontais únicos

Preparação local em 01/11/2026. Base: `26251383456dc6faa9ca7d62243e36e0505fea25` (`main`). Branch: `fix/home-horizontal-filters-20261101`.

## Alteração

- Removida a barra lateral “Explorar”, incluindo a repetição das três categorias e o link lateral “Meu Radar”. O acesso ao espaço pessoal permanece em “Guarde possibilidades, não abas”.
- Preservadas as categorias horizontais, seus estados selecionados, busca, lista e links de oportunidades.
- Eliminadas a coluna lateral, a divisória e a margem interna correspondente. Busca e lista ocupam toda a largura da seção. Estilos exclusivos da lateral foram removidos, incluindo os de telas menores.
- Arquivos de aplicação: `make-it-fly-current/components/home/earth-radar/earth-radar-list.tsx` e `earth-radar.module.css` na mesma pasta.

## Validação

Todos os comandos de projeto foram executados sequencialmente pela fila `/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py`, consultada antes do trabalho pesado e inicialmente livre.

- `node --test --test-concurrency=1 tests/earth-home.test.mjs tests/home-opportunities.test.mjs`: 10 testes aprovados.
- `npm run lint -- components/home/earth-radar/earth-radar-list.tsx`: aprovado.
- `npm run typecheck`: aprovado, após geração local dos tipos pelo Next.
- `git diff --check`: aprovado.
- Homepage compilada em `next dev --webpack`, com API de teste apenas em loopback e três registros locais; nenhuma credencial ou dado privado de produção foi utilizado.
- Navegador: em 1440, 390 e 320 px, nenhuma barra lateral, uma faixa de categorias e nenhum overflow da página. Em desktop, conteúdo com os mesmos 1240 px do contêiner, sem borda ou padding lateral. Controles mobile com 44 px de altura.
- Interações: competições exibiu dois registros, eventos exibiu um, destaque restaurou os três e busca “NASA” exibiu um. Filtro de eventos também conferido em 390 px; rolagem horizontal preservada.
- A flag local `APOGEE_LOCAL_PREVIEW=1` inicialmente causou um aviso de hidratação no rodapé, pois esse código existente exibe links de minutas somente no servidor. O preview foi refeito com a flag desativada, sem erros ou avisos no console. O rodapé não foi alterado.

Capturas locais com dados de teste:

- `/Users/viniciusbrigido/.codex/visualizations/2026/11/01/01a1972e-f3bb-7002-87da-050e3bfc5b5a/home-filtros-desktop.jpg`
- `/Users/viniciusbrigido/.codex/visualizations/2026/11/01/01a1972e-f3bb-7002-87da-050e3bfc5b5a/home-filtros-mobile.jpg`

Preview temporário encerrado após a conferência. Sem push, PR, merge, deploy, migração ou alteração de dados reais. Publicação pendente de autorização após revisão, conforme `make-it-fly-current/AGENTS.md`.
