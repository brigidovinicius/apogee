# Design e mídia da Apogee — 27/10/2026

## Escopo

- Base de produção: `861c3b2`; integrada a correção anterior de assinatura móvel/logo `c5dda15` como `c793af8`
- Branch local: `feat/home-design-quality-20261027`
- Removida a linha de progresso fixa do topo
- Home: “Descubra seu próximo salto” e Radar: “Encontre o seu próximo salto”
- Removidos os pontos finais dos blocos de texto da home e das apresentações estáticas de Blog, Loja, Radar e Membros; conteúdo editorial armazenado, URLs, valores monetários e dados de usuários não são reescritos
- Navegação da home reutiliza SiteHeader, com menu completo no celular, estados claros/escuros e logo oficial
- Logo oficial também substitui a composição textual na Loja e o texto no link de retorno do Make It Fly; seu design de evento e suas mídias permanecem preservados
- Tipografia Inter, espaçamentos, raios e cores passam a compartilhar os tokens do sistema global
- Espaço inicial do Radar no celular: 120 → 40 px; seções seguintes usam 48–80 px

## Mídias e desempenho

Imagens criadas com a ferramenta nativa GPT imagegen e entregues em WebP responsivo em `public/media/earth-v2`:
- Horizontal: 1672 × 941, 293.930 bytes; alternativa 960 × 540, 126.512 bytes
- Vertical: 941 × 1672, 320.312 bytes; alternativa 640 × 1137, 172.776 bytes
- Original anterior: PNG de aproximadamente 2,2 MB
- Assinatura: mesma arte convertida de 504.239 para 35.044 bytes
- Vídeo vertical novo: Google Flow / Veo 3.1 Quality, 720 × 1280, 8 s, 24 fps
- Projeto Flow: https://flow.google.com/project/f12ee666-341f-4ac1-a1de-b8a2b5ef87ab
- Download original: `/Users/viniciusbrigido/Downloads/Earth_receding_into_space_20261027110132.mp4`
- Vídeo vertical distribuído: H.264 CRF 24, keyframe a cada 24 quadros, sem áudio e faststart
- Vídeo horizontal existente mantido durante o movimento; nova imagem de abertura e novo quadro final GPT com mais definição (1672 × 941, 121.932 bytes), revelado suavemente no final da rolagem
- A Terra só solicita vídeo após intenção de interação; imagem estática para redução de movimento/economia de dados
- A home deixa de importar Framer Motion para transmitir o progresso da rolagem
- Resolução nativa entregue pelo Flow é 720p vertical; não foi criada nem alegada uma versão 4K
- Ganhos de bytes não equivalem a uma medição de Core Web Vitals em produção

## Prompts GPT

### Horizontal
Edit this reference Earth photograph for the Apogee homepage. Preserve the exact composition: a wide 16:9 orbital view, curved Earth horizon around the upper third, rich dark navy space above, blue ocean and intricate white cloud formations below. Create a genuinely high-definition, photorealistic premium aerospace photograph with finely resolved cloud texture, clear blue atmosphere, restrained natural contrast, realistic sunlight and no blur or painterly smoothing. Crisp natural detail without oversharpening halos. Keep the top third as clean navy negative space for an existing white logo overlay. No text, logos, stars, spacecraft, borders or watermark. Render at the largest available resolution, ideally 3840x2160. This is the new high-resolution opening plate for an existing cinematic scroll experience; preserve visual continuity and the calm blue palette.

### Vertical
Create a portrait 9:16 photorealistic orbital photograph of Earth as a premium mobile website background, ideally 1440x2560 or largest portrait resolution. Rich clean navy space in the top 34 percent. The gently curved horizon of Earth crosses around 38 percent from top. The lower 62 percent is filled with a beautifully resolved blue ocean and highly detailed thin white cloud fields seen from low orbit. Airy pale blue atmosphere, thin cyan atmospheric rim, realistic sunlight and fine natural cloud detail. Calm restrained cinematic photography. NO text, logo, symbols, stars, spacecraft, borders, watermark or lens flare. Crucial: native vertical composition and crisp cloud definition for a high-density phone screen. The Earth extends beyond left and right edges; not a small floating globe. Match a blue and white Apogee orbital website aesthetic with space reserved above for a white brand signature.

## Prompt Flow
One continuous photorealistic orbital camera shot in PORTRAIT 9:16. Start exactly on this supplied high-definition Earth horizon image. The camera slowly dollies backward and upward, revealing the full spherical blue-white Earth, ending with the complete globe centered horizontally in the UPPER HALF, with clean dark navy space in the LOWER HALF for a website headline. Keep the planet diameter about 80 percent of the portrait width at the end. Preserve extremely crisp, finely resolved cloud structures, realistic coherent geography and thin cyan atmospheric rim, pale blue oceans, soft natural sun. Smooth slow ease in and out, eight seconds, no cuts, no dissolve, no fast zoom, no shake, no melting or morphing, no flat card. Clean navy space with no stars, no spacecraft, no text, no logos or watermarks, no audio. Premium aerospace photographic quality for a high-density mobile screen.

### GPT — quadro final desktop
Enhance this exact Earth photograph for the resting final frame of a premium website animation. Preserve EXACT framing, planet size, position on the right, cloud shapes, blue-white palette, light direction, thin atmosphere and clean dark navy negative space on the left. Improve only photographic definition: resolve delicate cloud edges and ocean texture crisply and naturally, with clean fine detail and restrained natural contrast. No oversharpening halos, no extra glow or blur. No added stars, objects, text, logos or watermarks. Wide landscape 16:9. Highest available native resolution. This must register closely with the supplied composition so it can blend over the final frame of an existing video.

## Referências e validação
- [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Apple HIG — Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- Controles com pelo menos 44 px, foco visível, menu acessível e preferência de movimento reduzido
- Testes focados iniciais: 21/21
- TypeScript: aprovado
- Lint: sem erros; alerta preexistente em gallery-admin
- Suíte completa: 500/500 testes aprovados; build de produção e TypeScript aprovados
- Chromium integrado: 320, 390, 768 e 1440 px sem overflow horizontal; menu com todos os destinos, Escape fecha e restaura foco; navegação com alvos de pelo menos 44 px
- Abertura móvel: zero vídeos antes de interação; imagem vertical correta; vídeo após rolagem confirmado em 720 × 1280
- Preferência de movimento reduzido: versão estática, sem vídeos
- Home: nenhum ponto final em títulos/parágrafos visíveis e nenhuma linha de progresso
- Sem erros/avisos de console observados na home
- Radar e Loja: Inter e logo oficial confirmadas em renderização; Loja móvel sem overflow
- Blog local: identidade/navegação conferidas no estado de indisponibilidade, pois a prévia não se conecta ao banco de publicações
- Prévia local usa a cópia pública do Radar capturada em 26/10, sem banco nem credenciais de produção
- Limites: sem iPhone físico/VoiceOver e sem medição de Core Web Vitals de produção; páginas autenticadas e transações não foram exercitadas
- Sem envio, merge, deploy ou alteração de dados de produção


## Comandos e evidências

Validação serializada pela fila global: `npm test`, `npm run lint` e `APOGEE_LOCAL_PREVIEW=1 npm run build`

O teste de compartilhamento foi atualizado para o texto sem ponto final, mantendo as verificações de URL canônica e ausência de confirmação falsa de entrega

Capturas locais em `/Users/viniciusbrigido/.codex/visualizations/2026/10/27/01a17da1-8444-7a83-881d-e698268bc7ec`: `home-mobile-transition.jpg`, `home-desktop.jpg`, `radar-global.jpg` e `loja-global.jpg`

Prévia local: http://127.0.0.1:4381
