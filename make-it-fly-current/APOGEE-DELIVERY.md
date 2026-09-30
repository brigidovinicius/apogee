# Make It Fly — entrega local da experiência de apogeu

## Atualização vigente: rolagem natural e limpeza visual

12 de setembro de 2026. **Implementado e verificado no localhost, sem deploy.** Esta atualização substitui as decisões de seção longa, fixação e legendas descritas no histórico abaixo.

A causa da página presa era a abertura fixada em uma seção de 260svh no desktop e 160svh no celular. Agora a abertura ocupa uma tela, com limites mínimos para telas baixas, e participa do fluxo normal da página. A câmera usa diretamente a posição de rolagem, sem uma mola atrasando a resposta. O afastamento termina nos primeiros 65% da saída da abertura, enquanto a seção seguinte já entra na tela. Só o fundo tem deslocamento diferencial; os textos e links acompanham a rolagem normal.

- Removidos da abertura o círculo orbital, o progresso técnico e “APOGEE / MAX DISTANCE”.
- Título auxiliar em Instrument Serif 400 e descrição em Inter 400, conforme o manual da marca. Lettering original preservado.
- Removido o travessão da frase “Tire uma ideia do papel em um dia.” e dos textos visíveis revisados.
- “40 participantes” substituído por vagas limitadas, incluindo experiência, chamada final e metadados.
- Removidas as referências a Florianópolis, o destaque “07—19H / FLORIANÓPOLIS” e a etiqueta “04 / 06” do manifesto. Os horários das atividades foram preservados.
- Setembro de 2026, botões de participação e lata com “Energizados por Red Bull” mantidos.
- Crédito NASA removido da abertura; atribuição completa preservada em `public/earth/CREDITS.md`, acessível pelo link “Créditos das imagens” no rodapé.

Validação: build de produção, lint e tipagem aprovados; **21/21 testes aprovados**, incluindo progresso limitado, monotonicidade, reversão determinística e ausência de uma seção fixada.

No navegador, em 1044×929, a rolagem real de 0 → 300 → 600 px produziu progresso da Terra de 0 → 0,4968 → 0,9936. O topo da seção seguinte passou de 929 → 629 → 329 px e o título subiu exatamente com a página. No celular 390×844, a rolagem de 300 px produziu progresso 0,5468 e topo da seção seguinte em 544 px. Sem overflow horizontal, com CTA dentro da abertura, em 360×800, 390×844, 1280×800 e 1440×900. Preferência de movimento reduzido continua respeitada, com ativação local opcional.

Capturas atuais: `../screenshots/natural-scroll-start.png`, `natural-scroll-middle.png` e `natural-scroll-next-section.png`. Nenhuma preferência global do navegador ou do sistema foi alterada.

As skills de depuração e design orientaram a reprodução do bloqueio, a remoção da fixação e a aplicação da tipografia oficial sem redesenhar a marca. A publicação e a pasta `baseline/` permanecem intactas.

---

## Histórico das etapas anteriores (não descreve o comportamento vigente)

## Correção posterior: Terra parada no scroll

A causa foi confirmada nas três abas locais: `prefers-reduced-motion: reduce`, cena `static` e nenhum Canvas. A preferência de movimento reduzido estava selecionando o poster, não uma falha de distância da câmera.

A abertura agora oferece **Ativar animação / Pausar animação** quando essa preferência é detectada. A escolha vale apenas para a página aberta, não altera o navegador ou o macOS e não ignora proteção de WebGL ou aparelhos fracos. Ao recarregar, a preferência do navegador volta a ser o padrão. As três abas locais foram atualizadas e ativadas para a revisão do usuário.

Também foi corrigida a atualização de progresso quando o hero passa de uma tela estática para a seção longa: um ResizeObserver recalcula o início sem esperar o próximo scroll. Cada montagem mantém sua própria versão de prontidão.

Arquivos desta correção: `ApogeeHero.tsx`, `HeroContent.tsx`, `useApogeeTimeline.ts`, `apogee.module.css`; novos `lib/apogee-motion-policy.ts` e `tests/apogee-motion-policy.test.mjs`.

Validação posterior: build, lint e tipagem aprovados; **14 testes aprovados**. No navegador, mantendo movimento reduzido ligado, a ativação criou o Canvas e o scroll avançou do contato até **93% / apogeu**, com afastamento visível da Terra. Pausa por Enter removeu o Canvas e manteve foco no controle. CTA visível, controle de 44 px e ausência de overflow em 1280×800, 390×844, 360×800 e 360×640. Capturas: `../screenshots/motion-fix-start.png` e `../screenshots/motion-fix-end.png`, em 877×772.

Esta correção seguiu a skill `engineering:debug`: reprodução, identificação da condição de bloqueio, correção local e teste de regressão. Nenhum deploy foi realizado.

---

Data: 12 de setembro de 2026. **Sem deploy. Prévia pronta para revisão, com as limitações de QA registradas abaixo.**

A abertura com Lua foi substituída localmente por uma Terra 3D cuja câmera se afasta por uma curva discreta, com desaceleração no final. O conteúdo real do evento foi preservado. Conforme a solicitação adicional, topo e rodapé usam a ilustração da lata com o texto **“Energizados por Red Bull”**, sem a logo isolada nesses locais.

Prévia compilada: [localhost:3017](http://127.0.0.1:3017/). A versão pública [makeitfly.vercel.app](https://makeitfly.vercel.app) não recebeu esta implementação.

## Base e preservação da publicação

A base foi recuperada dos arquivos do deployment publicado, não das experiências de Terra anteriormente rejeitadas:

- Deployment: `dpl_7zYo7vXKvP8fo9J7Ei2q2PQnGMUu`.
- URL imutável: [deployment publicado](https://rosa-maria-livro-ld5j3ewtq-brigidovinicius-projects.vercel.app).
- Manifesto de origem: `../production-source-manifest.json`, recuperado em `2026-09-12T13:35:21.667Z`.
- 46 arquivos de origem verificados por SHA-1; 42 puderam ser reaproveitados por igualdade de hash e 4 foram recuperados do deployment.
- Base de comparação local: `../baseline/`. Implementação nova: esta pasta `site/`.

A comparação do conteúdo de `#experiencia` até o fim de `<main>` encontrou igualdade exata com a base. Em `content/site.ts`, os dados posteriores a `ABERTURA` também permaneceram idênticos. Nome, data, local, descrição do evento, programação, capacidade, destino dos links e CTAs não foram inventados nem substituídos. As mudanças editoriais se limitam à apresentação da abertura e à assinatura Red Bull solicitada, inclusive na descrição de metadados.

O lettering existente, os arquivos aprovados de marca, as demais seções e as dependências foram mantidos. A estrela não gira nem é deformada; o pequeno efeito de hover agora é somente de escala. Os antigos arquivos de Lua e a imagem da logo Red Bull continuam no acervo do projeto, mas a abertura ativa não importa a cena lunar nem referencia a logo isolada. Não foram apagados arquivos da versão publicada.

## Arquitetura e decisões

Stack preservada: Next.js 16, React 19, TypeScript, Tailwind CSS e estrutura existente de componentes. Three.js, React Three Fiber e Framer Motion já estavam instalados; não foi adicionado GSAP nem outra biblioteca de animação.

| Arquivo/componente | Responsabilidade |
|---|---|
| `ApogeeHero.tsx` | Integra seção, conteúdo, cena dinâmica, poster e tratamento de erro. |
| `useApogeeTimeline.ts` | Normaliza o scroll com `useScroll`, suaviza com `useSpring`, acompanha breakpoint, movimento reduzido, capacidade básica do aparelho e visibilidade da aba/seção. |
| `lib/apogee-config.ts` | Define câmera de perspectiva com FOV fixo, trajetória curva, interpolação contínua e valores compartilhados da cena. |
| `EarthCanvas.tsx` | Carrega texturas, configura câmera, luzes, DPR, renderização sob demanda e tratamento de falhas de WebGL/texturas. |
| `EarthGlobe.tsx` | Esfera de raio constante, superfície diurna, luzes noturnas limitadas ao lado escuro, relevo sutil e camada separada de nuvens. |
| `Atmosphere.tsx` | Atmosfera fina por shader Fresnel, sem pós-processamento pesado. |
| `StarField.tsx` | Estrelas procedurais determinísticas e discretas, reduzidas no celular. |
| `OrbitOverlay.tsx` | Linha orbital e metadados em SVG/HTML, separados do Canvas. |
| `HeroContent.tsx` | Textos, lettering, informações reais, assinatura da lata e CTA em HTML normal. |
| `EarthPosterFallback.tsx` | Poster responsivo disponível antes do WebGL e nos modos estáticos. |
| `apogee.module.css` | Composição editorial, seção sticky, responsividade e regras de movimento reduzido. |

A malha terrestre não recebe uma animação de escala. O afastamento vem da distância da câmera; o campo de visão permanece em 35°. Há uma pequena variação lateral/orbital e enquadramento assimétrico. A Terra gira no máximo 4° na sequência, sem rotação infinita.

- Desktop: seção de `260svh`, área visual de `100svh`, diâmetro inicial de aproximadamente `175vw` e final de `10.5vw`.
- Mobile: seção de `160svh`, diâmetro inicial de aproximadamente `180vw` e final de `26vw`.
- A desaceleração final e a continuidade do afastamento são cobertas por testes numéricos.
- O título e os CTAs estão presentes desde o HTML inicial; não aguardam a Terra carregar nem o scroll terminar.
- O lettering original foi preservado. Inter variável existente é utilizado nos textos da nova abertura, com peso denso no título auxiliar. Noto Sans Mono foi acrescentada aos dados técnicos; Instrument Serif foi preservada e passou a ser servida localmente.

### Performance e acessibilidade implementadas

O Canvas é importado dinamicamente com SSR desativado e é decorativo (`aria-hidden`, `pointer-events: none`). A renderização é sob demanda e fica suspensa quando a seção não está visível ou a aba está oculta. O DPR é limitado a 1–1,5; a textura diurna 4K só é selecionada para desktop com capacidade suficiente. Mobile utiliza 2K e menos estrelas.

Mapas diurno/noturno são marcados como cor sRGB. Máscaras de nuvem e relevo usam espaço de dados linear. As texturas carregadas têm descarte explícito; geometrias e materiais declarativos seguem o ciclo de vida do React Three Fiber. Não há bloom nem controles orbitais interativos bloqueando a página.

`prefers-reduced-motion`, economia de dados e indicadores conservadores de aparelho fraco selecionam a apresentação estática. Com movimento reduzido não há viagem orbital nem longa seção fixada. Esse modo foi verificado em 360×800: `data-scene="static"`, nenhum Canvas e hero com 800 px de altura. O HTML mantém título, links e informações acessíveis independentemente do Canvas. As regras de foco da página foram mantidas; os demais testes de interação estão discriminados na matriz abaixo.

## Assets reais e fontes

As cinco texturas da cena foram obtidas diretamente de hosts oficiais NASA. Créditos completos, URLs exatas, transformações, dimensões e hashes estão em `public/earth/CREDITS.md`; os originais de trabalho estão em `../earth-originals/`. Não foi usado vídeo generativo nem uma imagem plana como implementação principal da Terra.

| Arquivo local | Fonte real e tratamento |
|---|---|
| `earth-day-4k.webp`, `earth-day-2k.webp` | [Blue Marble — superfície, oceano e gelo](https://visibleearth.nasa.gov/images/57730/the-blue-marble-land-surface-ocean-color-and-sea-ice), NASA/GSFC. Derivados 4096×2048 e 2048×1024 do [original 8192×4096](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57730/land_ocean_ice_8192.png). |
| `earth-clouds-2k.webp` | NASA/GSFC Blue Marble, [original de nuvens 2048×1024](https://eoimages.gsfc.nasa.gov/images/imagerecords/57000/57747/cloud_combined_2048.jpg). A fonte não contém alpha; o shader transforma luminância em opacidade. Não é apresentado como PNG/RGBA originalmente transparente nem como meteorologia ao vivo. |
| `earth-night-2k.webp` | NASA Earth Observatory/GSFC, [Black Marble 2016](https://science.nasa.gov/earth/earth-observatory/earth-at-night/maps/), observações VIIRS. Derivado em escala de cinza 2048×1024 do [original 3600×1800](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/imagerecords/144000/144897/BlackMarble_2016_01deg_gray.jpg). |
| `earth-bump-2k.webp` | [Topografia Blue Marble Next Generation](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/topography-bathymetry-maps/), Jesse Allen/NASA Earth Observatory com dados GEBCO/BODC. Derivado 2048×1024 do [original 5400×2700](https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/topography/gebco_08_rev_elev_5400x2700.jpg). É bump map, não normal map de espaço tangente. |

O crédito visível da cena é “Earth imagery: NASA/GSFC”, ligado ao arquivo de créditos. Nenhuma logo NASA foi adicionada; o crédito não indica patrocínio ou endosso da agência. As cores e a iluminação são tratamento visual da cena, não dados científicos atuais.

### Posters definitivos

`earth-poster-desktop.avif` (1440×900) e `earth-poster-mobile.avif` (390×844) são capturas diretas do Canvas da própria cena Three.js, no progresso inicial `p=0`. Utilizam as texturas NASA/GEBCO, a câmera, a atmosfera, os materiais e a iluminação da implementação interativa. Foram codificados como AVIF com qualidade 55 no Sharp, preservando transparência e sem textos, marca ou interface incorporados.

São renders locais derivados das texturas creditadas, não fotografias independentes da NASA nem imagens generativas. Substituem integralmente as conversões temporárias da referência `Imagem do Codex 12 de set. de 2026, 10_29_08.jpg`; essa referência não está nos posters entregues. A origem e a conversão dos posters definitivos estão registradas em `public/earth/CREDITS.md`.

### Lata Red Bull

`public/partners/red-bull-can-white.png` é a arte fornecida em `RED BULL_ED_LATA_FL_BRANCO_ABERTA.png`, na pasta de arquivos do usuário. Foi preservada sua proporção vertical de 1726×4918. O topo e o rodapé apresentam a lata ao lado da expressão “Energizados por Red Bull”. Não foi usada uma logo isolada nesses dois espaços.

### Fontes

Fontes e licenças estão documentadas em `app/fonts/SOURCES.md`:

- [Noto Sans Mono — Google Fonts](https://github.com/google/fonts/tree/main/ofl/notosansmono): subset Latin variável 400–500, WOFF2 oficial, licença SIL OFL 1.1 em `OFL-NotoSansMono.txt`.
- [Instrument Serif — Google Fonts](https://github.com/google/fonts/tree/main/ofl/instrumentserif): normal e itálico 400, WOFF2 oficiais, licença SIL OFL 1.1 em `OFL-InstrumentSerif.txt`. A tipografia existente foi mantida, removendo a necessidade de baixar essa fonte durante o build.
- Inter variável e DM Mono já pertenciam à base e não tiveram seus arquivos alterados.

## Arquivos alterados e criados

Inventário comparado por SHA-1 contra `../production-source-manifest.json`: **6 arquivos de origem alterados, 28 arquivos novos incluindo este relatório, nenhum arquivo de origem removido**. Não inclui dependências instaladas, `.next/`, caches ou arquivos operacionais da pasta pai.

### Alterados

| Arquivo | Mudança |
|---|---|
| `app/globals.css` | `overflow-x: clip` no body, preservando a rolagem da seção sticky. |
| `app/layout.tsx` | Noto Sans Mono local, Instrument Serif local, texto de metadados atualizado para “Energizados por Red Bull”. |
| `components/landing/make-it-fly-v2.tsx` | Integração de `ApogeeHero`, retirada da cena lunar da página ativa e uso da lata no rodapé. |
| `components/landing/make-it-fly-v2.module.css` | Ajustes pontuais do cabeçalho e assinatura da lata; remoção da rotação do símbolo. |
| `content/site.ts` | Somente a assinatura de apoio em `ABERTURA`: frase, caminho da lata e texto alternativo. |
| `package.json` | Comando `npm test`; dependências mantidas. |

### Novos

```text
APOGEE-DELIVERY.md
app/fonts/OFL-InstrumentSerif.txt
app/fonts/OFL-NotoSansMono.txt
app/fonts/SOURCES.md
app/fonts/instrument-serif-latin-400-italic.woff2
app/fonts/instrument-serif-latin-400-normal.woff2
app/fonts/noto-sans-mono-latin-variable.woff2
components/hero/ApogeeHero.tsx
components/hero/Atmosphere.tsx
components/hero/EarthCanvas.tsx
components/hero/EarthGlobe.tsx
components/hero/EarthPosterFallback.tsx
components/hero/HeroContent.tsx
components/hero/OrbitOverlay.tsx
components/hero/StarField.tsx
components/hero/apogee.module.css
components/hero/useApogeeTimeline.ts
lib/apogee-config.ts
public/earth/CREDITS.md
public/earth/earth-bump-2k.webp
public/earth/earth-clouds-2k.webp
public/earth/earth-day-2k.webp
public/earth/earth-day-4k.webp
public/earth/earth-night-2k.webp
public/earth/earth-poster-desktop.avif
public/earth/earth-poster-mobile.avif
public/partners/red-bull-can-white.png
tests/apogee-config.test.mjs
```

O servidor de desenvolvimento gerou referências temporárias em `next-env.d.ts`. Na cópia de segurança entregue, esse arquivo foi restaurado aos bytes do deployment e os 46 hashes da base foram novamente verificados, sem divergências. `package-lock.json`, configuração do Next.js, rota `app/page.tsx` e arquivos de marca mantêm seus hashes de produção.

## Validação e comandos

Resultados registrados nesta sessão, antes das últimas correções de enquadramento do CTA e de tratamento de falha assíncrona do WebGL. A regressão final dessas correções ainda precisa ser concluída:

| Verificação | Resultado |
|---|---|
| `npm run build` | Aprovado; build de produção Next.js com webpack. |
| `npm run lint` | Aprovado. |
| `npm run typecheck` | Aprovado. |
| `npm test` | Aprovado: 6 testes, 0 falhas. |
| `curl -I --max-time 10 http://127.0.0.1:3017/` | `HTTP/1.1 200 OK`; resposta compilada servida localmente. |
| Inspeção do HTML compilado | Um `h1`, zero canvases renderizados no servidor, os dois posters responsivos e dois links para `#participar`; nenhuma referência ativa à imagem `red-bull.png`. |
| Comparação de dados e conteúdo fora da abertura | Aprovada por comparação exata com a base recuperada. |

Os cinco testes de viewport amostram a câmera em 1.001 pontos cada: 1440×900, 1280×800, 768×1024, 390×844 e 360×800. Verificam distância crescente, Terra progressivamente menor, coordenadas finitas, FOV fixo, rotação limitada a 4°, enquadramento final inteiramente dentro da viewport e desaceleração final. O sexto teste cobre limites de entrada e determinismo. **Esses testes matemáticos não substituem screenshots, medição de layout ou testes de interação em navegador.**

### Matriz visual — resultados e limitações

| Item | Estado |
|---|---|
| Antes desktop 1440×900 | Captura registrada em `../screenshots/before-desktop.png`; dimensões verificadas. |
| Antes mobile 390×844 | Captura registrada em `../screenshots/before-mobile.png`; dimensões verificadas. |
| Depois: captura válida do navegador integrado | `../screenshots/after-desktop-current.png`, com dimensões efetivas de **844×929**. Não é uma captura desktop 1440×900 nem substitui a comparação mobile. |
| Depois desktop 1440×900 e mobile 390×844 | Capturas exatas da página completa bloqueadas por erro de escala da ferramenta. As tentativas com escala incorreta não devem integrar a entrega. |
| Layout em 1440×900, 1280×800, 768×1024, 390×844, 360×800 | Medições de DOM realizadas: `scrollWidth` igual à largura da viewport em todos os cinco tamanhos, portanto sem overflow horizontal nessas medições. Cena `ready` e duas latas em todos os casos. Dados em `../screenshots/responsive-checks.json`. |
| CTA em todos os cinco tamanhos | **Reteste aprovado após a correção:** botão inteiramente dentro da viewport, cena `ready` e sem overflow horizontal em todos os cinco tamanhos. Em 1280×800, o botão termina em 766,4 px. Evidência: `../screenshots/responsive-checks-final.json`. |
| Movimento reduzido e ausência de longa seção fixa | **Verificado em 360×800:** cena estática, Canvas ausente e hero com 800 px de altura. |
| WebGL indisponível | **Reteste aprovado:** `getContext` temporariamente retornando `null` produziu cena `fallback`, zero Canvas, poster carregado e hero de 800 px em viewport de 800 px. O teste e a preferência emulada foram removidos depois. Evidência: `../screenshots/webgl-fallback-check.json`. Perda de contexto posterior tem tratamento implementado, mas não foi simulada separadamente. |
| Navegação por teclado e CTA para `#participar` | Ativação do CTA do hero por Enter confirmada: URL passou a `#participar`. Link de retorno ao início também confirmado. Destino externo de inscrição não foi acionado. Não foi executada uma auditoria completa de ordem de foco. |
| Início, afastamento e rodapé | Capturas válidas em 1044×929: `after-preview.png`, `after-apogee.png` (99% da viagem) e `after-footer.png`. A lata foi conferida no topo e rodapé; o recurso efetivamente carregado foi de 64 px, com proporção preservada. |
| Safari e Chrome independentes | Indisponíveis no ambiente de automação desta sessão. Os testes de navegador realizados utilizaram somente o Chromium integrado. |
| Posters definitivos e atribuição correta | **Concluído:** renders diretos da própria cena NASA/GEBCO, desktop 1440×900 e mobile 390×844, AVIF com transparência; créditos atualizados. |

O redimensionamento do navegador e a captura da página apresentaram um erro de escala nesta sessão: a emulação alterou as dimensões do DOM, mas a captura da página não acompanhou corretamente o viewport. Isso não afetou a captura direta do Canvas utilizada nos posters. A imagem de depois válida de 844×929 é identificada por suas dimensões reais. As medições de DOM e os testes matemáticos acima não equivalem a uma aprovação visual completa nem a uma execução independente em Safari ou Chrome.

## Fechamento

Implementação local com posters definitivos, build, lint, tipagem e seis testes automatizados aprovados. Os cinco tamanhos mantêm CTA visível e ausência de overflow lateral; movimento reduzido, falha de criação de WebGL e ativação do CTA por teclado foram verificados. Permanecem as limitações de capturas exatas de depois, auditoria completa de foco, simulação isolada de perda de contexto e testes independentes em Safari/Chrome. Nenhum deploy, alteração de domínio, mudança de alias ou substituição da versão pública foi realizado.

## Como retomar a prévia

O pacote durável está em `outputs/make-it-fly-apogee/` no projeto original, com `site/`, `baseline/`, originais NASA, manifesto e capturas. `baseline/` mantém os 46 arquivos do deployment, verificados por hash. `site/` não inclui dependências instaladas nem caches.

Para reproduzir em uma máquina com espaço livre: entre em `site/`, execute `npm ci`, `npm run build` e `npm run start -- --port 3017 --hostname 127.0.0.1`. Para editar, use `npm run dev -- --port 3017`. Pare a prévia atual antes de reutilizar a mesma porta. A prévia desta sessão foi iniciada na cópia de trabalho temporária e usa as dependências locais já disponíveis.

A skill `anthropic-skills:frontend-design` orientou a composição editorial da abertura, hierarquia tipográfica e contraste, preservando o lettering fornecido e a estrela aprovada.
