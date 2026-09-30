# Validação da V2

Validação técnica da revisão de identidade concluída em 12 de setembro de 2026.
A produção existente foi preservada nesta rodada.

## Verificações automatizadas

- `npm run lint` — aprovado
- `npm run typegen` — aprovado
- `npm run typecheck` — aprovado, inclusive sem cache `.next`
- `npm run build` — aprovado com Next.js 16.3.4 e webpack
- rotas produzidas — somente `/` e `/_not-found`, ambas estáticas

## Verificações no navegador

- composição revisada em 320, 768 e 1280 px;
- sem overflow horizontal em 320 e 768 px;
- hero, trajetória, CTA final e rodapé revisados visualmente;
- imagem de Rosa carregada uma única vez;
- logos da Red Bull, Make It Fly e Apogee carregados corretamente;
- CTA do hero leva a `#participar` e CTA final leva ao Instagram da Rosa;
- com `prefers-reduced-motion`, a lua manteve deslocamento comprovado entre
  `scrollY=0` e `scrollY=2160`; a rotação contínua é apenas desacelerada;
- foco de teclado, contraste, alvos de toque e reflow revisados.

## Integridade

- `content/site.ts`, retrato de Rosa, logo da Red Bull e textura da lua são
  idênticos aos arquivos aprovados do projeto original;
- wordmark Make It Fly, estrela-pulsar e logo Apogee vieram dos arquivos de
  identidade fornecidos nesta revisão;
- a entrega local continua sem `.vercel`;
- o endereço de produção existente continua sendo
  https://makeitfly.vercel.app;
- esta revisão ainda não foi publicada, por decisão de manter a produção intacta
  até uma solicitação explícita de deploy.
