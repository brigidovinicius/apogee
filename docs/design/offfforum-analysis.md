# Investigação OFFFForum com REA

16/10/2026 · referência atual observada, sem submissão de formulários.

## Ambiente e método

REA 6.5.0, Node 22.23.2. O setup oficial foi primeiro simulado e depois aplicado somente ao cliente Codex, com `--skill=false`. O plano adicionava `mcp_servers.rea`, com backup. A comparação estrutural TOML confirmou que as demais configurações permaneceram iguais. A exposição das novas ferramentas MCP requer reiniciar o agente; nesta sessão foram usados os workflows oficiais via CLI.

A janela Chrome 155 com perfil descartável e CDP em loopback permitiu inspeção de DOM, mas suas capturas visuais travaram. A captura foi repetida com Chromium Headless 153, também com perfil exclusivo. A posição da janela na Mesa 2 não pôde ser confirmada. As evidências renderizadas são do Chromium de teste, não de Safari nem de um aparelho físico. Não foram usadas sessões autenticadas na investigação REA.

Fontes oficiais: [OFFFForum](https://www.offforum.com/), [galeria Awwwards](https://www.awwwards.com/sites/offfforum), [REA](https://github.com/morluto/rea), [instalação](https://github.com/morluto/rea/blob/main/docs/installation.md) e [observação de browser](https://github.com/morluto/rea/blob/main/docs/browser-observation.md).

## Fatos observados

| Tema | Evidência e implicação |
| --- | --- |
| Estado atual | A homepage divulga a edição de 2027. A galeria Awwwards apresenta mais seções/interações do que a página pública atual. Não presumir equivalência entre essas versões. |
| Estrutura | Header com lockup amplo, links About/FR no desktop, menu expansível no mobile; hero de tela inteira; quadro de datas e local; título/CTA de ingresso; comunidade/newsletter; rodapé. |
| Tipografia | Forvm 400 no H1: 45/43 px no desktop e 30/29 px no mobile. Baikal 600 no bloco de comunidade: 32/31 e 24/23 px. Fontes WOFF2 com swap. |
| Cores | Preto/branco dominantes, cinzas declarados no CSS e vermelho em tokens auxiliares. Transparências ajudam o texto sobre mídia. Frequência de tokens não mede proporção visível. |
| Composição | Grande diferença de escala entre marca, texto display e interface; elementos encostam em margens curtas; mídia ocupa o campo visual, com CTA concentrado. |
| Menu móvel | Abertura revela About, Media room, Contact, FAQ e FR. Dois traços tornam-se X; CSS declara duração de 700 ms. O botão da referência não fornece um nome acessível explícito — esse problema não foi reproduzido na Apogee. |
| Hover | Classes públicas indicam pseudo-elementos escalados e transições de 500 ms em links; feedback discreto no CTA. |
| Scroll | Hero dá lugar ao bloco de comunidade e rodapé. A observação passiva registrou uma janela curta; não prova a existência de pinning ou timelines complexas em outras versões. |
| Media | Composição de fundo apresenta conteúdo em movimento. O DOM principal contou três imagens e nenhum video/canvas, mas a árvore de acessibilidade identifica um video player. A contagem do DOM principal não exclui mídia dentro de componentes/árvores internas. Não foi reutilizado esse conteúdo. |
| Responsividade | Capturas em 1440×1000 e 390×844; sem overflow horizontal. CSS contém breakpoints de 40, 48, 64, 80 e 90 rem. O título reduz escala e a navegação vira menu. |
| Carregamento | CSS separado, payload Nuxt, modulepreload e prefetch. Bundle REA observou/analisou 52 scripts. Fontes têm swap; uma thumbnail DatoCMS observada usa lazy loading. |

## Inferências e limites

O HTML comprova a família Nuxt; o REA infere Vue e Vite com confiança média a partir de fingerprints. A listagem Awwwards menciona GSAP, mas a captura não comprovou plugins, timelines ou código de animação GSAP específico. Não havia necessidade técnica demonstrada para adicioná-lo à Apogee.

A galeria da referência inspira escala, contraste, ritmo e feedback. Não oferece justificativa para copiar seu framework, fontes, identidade, assets ou implementação. Nenhum código da referência foi incorporado.

Não foram medidos Core Web Vitals de campo da referência, FPS sustentado ou comportamento em todos os navegadores. As capturas passivas têm escopo/filtragem declarados pelo REA. A ausência de eventos numa janela curta não prova ausência de comportamento.

## Tradução para Apogee

- Tipografia editorial de grande escala e campos navy/white/sky, preservando os assets e a fundação Instrument Serif/Inter existentes.
- Hero textual rápido, entrada curta e CTA Radar. A narrativa deriva do próximo salto associado ao nome Apogee.
- Movimento progressivo com Framer Motion já instalado; profundidade de 16 px no retrato durante scroll; preferência de movimento reduzido, pausa e suspensão com documento oculto.
- Prévia real por categoria; seleção somente de apresentação, sem alteração do ranking/classificação do Radar.
- Imagens próprias e foto da galeria ao vivo, com crédito e URL original. Não criar cópia estática que sobreviva a uma retirada de consentimento.
- Menu nativo com nome acessível e fallback sem JS; rotas existentes preservadas.

## Evidências

| Arquivo de captura | Operação | ID |
| --- | --- | --- |
| `apogee-after-inspect.json` | `inspect_web_page` | `ev_b397ef6d611f57bc843eb71206d48920dd03f68f620f8c0b7a5ae4f9c150087e` |
| `apogee-after-shot.json` | `capture_web_screenshot` | `ev_f7b14255220e5f52430ec4e6cd27cc8867fbdabac0c72fd2131f528ad967ed89` |
| `apogee-before-inspect.json` | `inspect_web_page` | `ev_917dfea3cd0bd205761b20a7fb92341f7332722d67b1aaea7c8f91eab9c7bb5f` |
| `apogee-before-shot.json` | `capture_web_screenshot` | `ev_9dfc6a006205a79fcc995e5f95bf3b7646c103401aa366a208f4ee35cd9ee226` |
| `apogee-dom-comparison.json` | `compare_web_captures` | `ev_660338576edacd90b78412cc5e1aff3ecb28f6d522f6be2af10b56f5252497b0` |
| `apogee-pixel-comparison.json` | `compare_web_screenshots` | `ev_ac7283dff43a8e042ce234309dfae97b58974149258ab41c207a1742780fa755` |
| `browser-targets.json` | `list_browser_targets` | `ev_1317d3d8b20283224fef08f74275d890de141a988d3fa4ca703b6c2838da21be` |
| `offforum-bundle.json` | `analyze_web_bundle` | `ev_ac987fef55f197c74c0080a63d7d0a46b4ee4152f8ed02ef9cc4c5ef232cdd10` |
| `offforum-desktop-clean.json` | `inspect_web_page` | `ev_a80c9b0a43f5156c28797b4be92a790757db02bf030028601b6814a1f220ce34` |
| `offforum-desktop-shot.json` | `capture_web_screenshot` | `ev_b6720d4e35ec8b45e92d9211a87210e8d3c0d078cf5d6511b809dcdd0f68b9f5` |
| `offforum-inspect.json` | `inspect_web_page` | `ev_3adb6e9f00117c7bd8be9c0d376ec802d0408e86c4f8a779514ea0ca4d2bb203` |
| `offforum-mobile-shot.json` | `capture_web_screenshot` | `ev_79cefd44c09554faf1629f398d8ebb7489685df4a72331df264993e674d2818a` |
| `offforum-mobile.json` | `inspect_web_page` | `ev_859aa0852056499225213216c9bafb2a7deedd87c9f91e995e4badb12e8787e5` |
| `offforum-session.json` | `observe_web_session` | `ev_126c763bcb64ed86785cf8b6f26a5d3543ad6a8292907b2d2bce88815f3fede0` |

A comparação desktop antes/depois da Apogee encontrou aproximadamente 96,7% de pixels diferentes, como esperado num redesign. Isso mede mudança visual, não qualidade ou ausência de regressão. A comparação de capturas marcou DOM, recursos e acessibilidade como alterados; várias dimensões ficaram unknown. As origens de produção e do preview local são diferentes, portanto diferenças de armazenamento/URLs não são tratadas como regressões de produção. Os testes funcionais são reportados separadamente.
