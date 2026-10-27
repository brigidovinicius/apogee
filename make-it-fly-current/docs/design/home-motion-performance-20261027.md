# Desempenho da home e da animação da Terra — 27/10/2026

Base publicada: `9021b9ce6245ea9b84c1d25eeaa393de986b4cc4` (PR #94)
Branch de revisão: `fix/home-mobile-performance-20261027`
Estado: validação local concluída; envio e publicação dependem da revisão do usuário

## Escopo

Preserva a sequência do Google Flow aprovada: mesmos 8 segundos, 192 quadros a 24 fps, enquadramento, trajetória, textos, logo e dimensões. A compressão é com perdas; não há troca por uma animação de imagem estática. Os arquivos originais permanecem no repositório.

- Celular: 6.097.587 → 2.689.680 bytes (−55,9%), 720 × 1280, H.264 sem B-frames, keyframe a cada 12 quadros
- Computador: 5.698.332 → 1.992.287 bytes (−65,0%), 1280 × 720, H.264 sem B-frames, keyframe a cada 6 quadros
- Os novos clipes têm `faststart` e nomes versionados com cache de um ano; não sobrescrever estes nomes depois da publicação
- A imagem inicial continua prioritária; o vídeo começa a carregar em tempo ocioso após `load`, ou no primeiro gesto se ele vier antes, somente com a Terra visível
- Movimento reduzido e economia de dados continuam mostrando a imagem estática
- A rolagem ignora posições entre quadros, conserva o destino mais recente durante a decodificação e suspende seeks com a aba oculta
- Leituras de layout precedem escritas e as variáveis da cena deixam de invalidar estilos de toda a página
- Noto Mono, Instrument Serif e DM Mono deixam de ser pré-carregadas globalmente; continuam disponíveis nas páginas que as usam. A home baixa apenas Inter

## Medição

Diagnóstico público reproduziu uma espera de cerca de 2,49 s entre `seeking` e `seeked` no vídeo móvel. Três GETs públicos retornaram 200, com TTFB de 0,52–0,73 s incluindo conexão/TLS. Não foi alterado servidor, banco ou cache de dados do Radar.

Para isolar a mudança, foram comparadas compilações de produção locais da base e da versão final, servidas sequencialmente pela mesma porta, com o mesmo catálogo público de teste. Navegador Chromium, viewport CSS 390 × 844, DPR 2, toque, cache desativado, CPU 4×, rede configurada em 200.000 bytes/s de download, 93.750 de upload e 150 ms de latência. Valores de carregamento são medianas de três navegações; não são resultados de aparelhos físicos nem nota Lighthouse/CrUX. A API PageSpeed estava sem cota. A diferença de TTFB do servidor público não é inferida desta comparação local.

| Métrica | Base | Versão final |
|---|---:|---:|
| Primeiro conteúdo (FCP) | 1,068 s | 1,012 s |
| Maior conteúdo (LCP observado) | 1,984 s | 1,620 s |
| Fontes solicitadas na home | 7 | 1 |
| Recursos concluídos na abertura, sem vídeo | 673.459 bytes | 584.816 bytes |
| Primeiro quadro disponível após iniciar rolagem | 1,89 s | 0,65 s |
| Maior espera por seek na primeira rolagem | 3,26 s | 1,30 s |
| Seeks concluídos na amostra de primeira rolagem | 4 | 26 |

A amostra de rolagem avança pela abertura em seis segundos e observa por mais quatro. A redução de espera não significa ausência garantida de buffering em conexões fracas: mantém-se um vídeo, cujo carregamento depende da rede. A contagem de callbacks de animação não é usada como alegação de FPS exibido pelo decodificador.

## Validação

- `npm test`: 502 testes aprovados
- `APOGEE_LOCAL_PREVIEW=1 npm run build`: aprovado, incluindo TypeScript
- `npm run lint`: sem erros; somente aviso preexistente de `<img>` no administrador de galeria
- `git diff --check`: aprovado
- Leitura HTTP Range `bytes=0-63`: 206 e 64 bytes para ambos os clipes; `Content-Type: video/mp4` e cache imutável corretos
- Metadados conferidos com ffprobe: duração, fps, quantidade de quadros e dimensões preservados
- Navegador: mesma animação carregada em 390 × 844 e 1440 × 900, sem rolagem horizontal; ida e volta com mídia já carregada completou 369 seeks, maior espera de 19,9 ms, sem callbacks acima de 50 ms na amostra. Isso não é uma medição de FPS exibido
- Movimento reduzido: cena estática, nenhum vídeo e texto acessível; Make It Fly com fontes carregadas e sem overflow
- Sem testes em Safari/iPhone ou Android físicos nesta sessão; a revisão nesses aparelhos permanece necessária após publicação autorizada

Todas as tarefas locais pesadas foram executadas sequencialmente pela fila. Apenas servidores temporários desta validação foram encerrados. Nenhum push, migração ou deploy foi realizado.

## Reprodução dos arquivos

```sh
ffmpeg -i public/media/earth-v2/earth-mobile-flow-web.mp4 -an -c:v libx264 -preset slow -crf 30 -g 12 -keyint_min 12 -sc_threshold 0 -bf 0 -threads 2 -pix_fmt yuv420p -movflags +faststart public/media/earth-v2/earth-mobile-scroll-v3.mp4
ffmpeg -i public/design-preview/earth-cinematic-v1/earth-orbit-flow-scroll.mp4 -an -c:v libx264 -preset slow -crf 28 -g 6 -keyint_min 6 -sc_threshold 0 -bf 0 -threads 2 -pix_fmt yuv420p -movflags +faststart public/media/earth-v2/earth-desktop-scroll-v3.mp4
```

No Mac de validação, estes comandos foram encapsulados individualmente em `npm-queue.py --command`, sem concorrência com builds/testes.
