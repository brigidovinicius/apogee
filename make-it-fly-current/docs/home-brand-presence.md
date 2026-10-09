# Presença visual da Apogee na home

Implementação local de 08/10/2026, na branch `feat/home-brand-presence`, a partir de
`ee6cbb4` (referência `origin/main` disponível no repositório local de origem).
A pasta original desta conversa não continha o checkout; o trabalho está na cópia
isolada `apogee-home/`. Nenhuma atualização remota foi presumida.

## Composição e escopo

- Home com mensagem e CTA existentes, estrela como destaque e bloco do Make It Fly
  abaixo da primeira tela. Cabeçalho, rodapé e destinos de navegação preservados.
- Paleta dos tokens atuais: navy `#07182D`, branco `#FFFFFF`, sky `#B9D3EE` e preto
  `#0A0A0A`. Inter na interface, Instrument Serif no título.
- SVG oficial de 715 bytes, com a geometria e orientação originais; aplicação em
  branco via CSS. Nenhum asset foi alterado. Iluminação somente no entorno.
- Movimento vertical de 6 px em 7 segundos; reação ao cursor de até 6 px por eixo;
  pulso de 650 ms ao toque. Sem rotação, espelhamento ou deformação da estrela.
- Controle de pausa, suspensão fora da tela e com documento oculto, preferência
  `prefers-reduced-motion` respeitada inclusive quando alterada durante a visita.
  Sem JavaScript, conteúdo e decoração estática continuam visíveis.
- A área de envio recebeu apenas CSS: tokens tipográficos, superfícies, raios,
  legibilidade e foco. JSX, lógica, upload, campos, validações, consentimento,
  APIs, autenticação, Make It Fly e componentes compartilhados não foram alterados.

## Referência de marca

Manual consultado: `/Users/viniciusbrigido/Downloads/MANUAL DE MARCA APOGEE V2.pdf`,
SHA-256 `daf784d9fa5adaa884dc162e380a7b1c16a7384f44f674f19b4f08a0df0bab18`.
A página física 15 proíbe girar ou espelhar; a 13 orienta um protagonista visual;
a 8 restringe efeitos dentro do lockup. A forma original foi preservada.

O V2 especifica GFS Didot/Didot Italic/Inter; a fundação já instalada usa
Instrument Serif/Inter, documentada em `ui-mockup-integration-plan.md`.
Esta alteração preserva essa fundação e não representa migração tipográfica ao V2.
A [L.I.S.A.](https://ca.linkedin.com/company/locomotive-mtl) orientou apenas a ideia
de presença decorativa com resposta breve. Não foi implementado assistente.

Antes de editar, foram lidas as guias locais do Next sobre `use client` e CSS em
`node_modules/next/dist/docs/01-app/`. As dependências finais foram instaladas com
`npm ci --offline --no-audit --no-fund`, conforme o lockfile, incluindo Next 16.3.8.

## Validação

- `npm run lint`: zero erros; um aviso preexistente de `<img>` em
  `components/gallery/gallery-admin.tsx:81`.
- `npm run typegen` e `npm run typecheck`: passaram.
- `node --test --test-concurrency=1 tests/*.test.mjs`: 212 testes passaram,
  zero falhas e zero testes ignorados. Inclui os contratos de assets, shell,
  isolamento, galeria e permissões. Nenhum teste existente foi modificado.
- `npm run build`: passou.
- `git diff --check`: passou.
- Build standalone iniciado com `PORT=3108 HOSTNAME=127.0.0.1 node
  .next/standalone/server.js`, com cópias dos assets somente na saída gerada.
- Chromium local: desktop 1440 px, celular emulado 390 px e largura 320 px.
  Conferidos CTA, menu móvel, ausência de overflow horizontal, mouse, toque,
  pausa/retomada, suspensão fora da tela, movimento reduzido, skip link,
  foco visível e apresentação sem JavaScript. Sem erros JavaScript de página.
- Capturas e resultados estruturados em
  `/Users/viniciusbrigido/.codex/visualizations/2026/10/09/01a11e4e-27c2-7511-8196-46638e9fd40f/`:
  `home-desktop.png`, `home-mobile.png`, `upload-mobile.png`, `browser-checks.json`.

Limites: teste responsivo em Chromium, sem Safari ou aparelho físico. Não foi
medido FPS sustentado. A API de galeria retorna 503 no ambiente local sem backend
configurado; a apresentação do formulário foi validada, sem enviar fotos nem
alterar dados. Nenhum push, PR, deploy ou publicação foi realizado.
