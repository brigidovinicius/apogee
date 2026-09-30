# Movimento da loja — segunda rodada de 28/09/2026

## Causa observada da página parada

Na prévia local, o navegador informou `prefers-reduced-motion: reduce`, a gota estava em `renderState=static` e os deslocamentos dos cards eram zero. Não foi ausência de WebGL: o renderer estava pronto. A preferência do sistema desativava o movimento deliberadamente.

## Alterações

- Controle acessível no cabeçalho: **Ativar animações / Pausar animações** (Animar/Pausar em tela estreita). Uma escolha manual vale somente para a sessão da loja, sem mudar a configuração do Mac. O botão de retorno restaura a preferência do sistema. Visitantes sem escolha continuam respeitando o sistema; a renderização inicial não depende de APIs do navegador.
- Gota: removida a dilatação global senoidal. Ondas médias viajam pela superfície; detalhes finos seguem a mesma corrente. Normais e reflexos acompanham a deformação. Velocidade do ponteiro e scroll geram um alongamento limitado, com compressão transversal. O centro quase branco e a composição Fresnel da rodada anterior foram preservados.
- Cards: trajetórias com amplitudes e fases diferentes, deslocamento proporcional à profundidade, resposta amortecida ao ponteiro e parallax. Reduzida a rotação plana dos desenhos para evitar aparência de recorte girando. Em telas estreitas, somente parallax suave durante a rolagem, sem flutuação contínua dos cards.
- A verificação de hover também acompanha cards que derivam sob um mouse parado. Mantidas as pausas com diálogo aberto, aba oculta e gota encoberta no celular.

A observação ao vivo de [The Drop Store](https://thedropstore.org/) orientou o deslocamento em profundidades distintas e a corrente superficial da gota. Não foram copiados seus assets. Os produtos do projeto ainda são ilustrações SVG; transformação de uma ilustração não oferece o mesmo resultado de um modelo 3D ou uma sequência de imagens de diferentes ângulos.

## Verificação

- No navegador, com a preferência nativa ainda em `reduce`, o clique em Ativar mudou a loja para `full`, a gota para `running` e os cards passaram a mudar de posição.
- Amostra de 1 segundo em repouso: primeiro card passou de x=2,17/y=19,36px para x=−2,84/y=15,22px, com scroll zero. É evidência de deslocamento, não medição de FPS.
- Pausar retornou a gota para `static` e zerou os deslocamentos dos cards.
- Recarregar preservou a escolha `full` após hidratação. Retornar ao sistema restaurou `reduced`.
- Com `no-preference` simulado, retornar ao sistema manteve o loader oculto e a animação ativa, sem repetir a entrada. A simulação foi removida; a prévia entregue usa escolha manual `full` com o sistema original ainda em `reduce`.
- Viewport 320 × 800: sem transbordamento horizontal; controles do cabeçalho com 44px de altura. Após scroll de 500px, a gota passou para `paused`.
- Sem erros de console na página durante a verificação.
- Diálogo de produto: gota pausou ao abrir; Esc fechou, devolveu o foco ao card e retomou a gota.
- `npm run typecheck`: passou.
- `npm run build`: passou.
- `npm run lint`: zero erros; permanece o aviso de imagem em `components/gallery/gallery-admin.tsx:94`, fora deste escopo.
- 14 testes focados passaram: loja, política da gota, preferência/SSR e dinâmica amortecida. A equivalência 60/120Hz é um teste matemático da mola, não teste em dois monitores físicos.
- A suíte geral não foi reexecutada nesta rodada. As 16 falhas de outras áreas registradas no relatório anterior não foram corrigidas nem consideradas resolvidas.

## Amostra visual

`/Users/viniciusbrigido/.codex/visualizations/2026/09/26/01a0dfa2-59d4-7b02-9565-ae360fec7e49/loja-movimento-28-09.gif`

GIF de 26 capturas ao longo de aproximadamente 7 segundos, em frequência reduzida de captura. Serve para mostrar deslocamento e deformação, não para avaliar a fluidez ou o desempenho real da animação. Teste a prévia em `http://127.0.0.1:3001/loja` e use Ativar animações no cabeçalho.

Nenhuma configuração do sistema alterada. Nenhuma publicação ou deploy realizado.
