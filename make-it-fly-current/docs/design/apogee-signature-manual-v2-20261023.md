# Assinatura manuscrita — preview local

Escopo: abertura do protótipo Earth/Radar no localhost. Nenhuma publicação, push ou alteração de `/makeitfly`.

## Origem visual

O usuário identificou a assinatura na captura de 23/10/2026 às 21:30. O original foi localizado no iCloud:

`Downloads do Mac - 2026-10-20/1-Projetos/Apogee e Make It Fly/Identidade Visual/MANUAL DE MARCA APOGEE V2 2.pdf`

Página física 6, página diagramada 08, seção **Assinatura manuscrita — Pode ser usada como logo**. A imagem incorporada foi extraída com `pdfimages -f 6 -l 6 -png`, sem reconstruir a assinatura com uma fonte. A extração textual anterior sobre Didot Italic não identifica essa arte manuscrita.

## Assets

- `public/design-preview/apogee-signature-v3/manual-v2-source.png`: imagem original incorporada ao PDF.
- `signature-gpt.png`: recomposição pelo modelo de imagem GPT, baseada na arte acima; branco sobre preto, estrela menor abaixo do descendente do g e com folga. É uma derivação para o teste, não um novo arquivo mestre oficial.
- Flow, projeto `f12ee666-341f-4ac1-a1de-b8a2b5ef87ab`, frames inicial/final iguais, Omni 1.1 Flash, 720p, 4s, 16:9, uma saída por tentativa.
- Primeira tentativa `0ea77419-3cf1-4167-a5ab-66e2ce7f484f`: luz na escrita; usuário apontou ausência de efeito visível na estrela.
- Segunda tentativa `ae9e179b-3b91-454d-91bb-67adf5dbfe78`: estrela iluminada, mas com esfera adicional. Não usada na página.
- Terceira tentativa `320c4d95-d028-49f0-bd97-cd3fa6af49aa`: brilho limitado aos contornos, sem esfera. Esta é a versão usada: `signature-light-flow-v3.mp4`, H.264, 1280x720, 4 segundos, sem áudio. O download foi remultiplexado com `-an -c:v copy -movflags +faststart`, sem recompressão.

## Comportamento implementado

Vídeo silencioso executado uma vez na abertura, composição `screen` sobre a Terra. Retorno à imagem estática ao terminar. Preferência por redução de movimento, economia de dados e erros de mídia usam a imagem estática. Pausa quando a aba fica oculta. O vídeo da Terra e a entrada do texto continuam controlados pela rolagem.

### Ajuste de suavidade — 24/10/2026

Pedido do usuário: passagem mais lenta e suave pela escrita e pela estrela. O mesmo clipe do Flow agora usa `playbackRate` e `defaultPlaybackRate` de 0,5: os 4 segundos de mídia são exibidos em aproximadamente 8 segundos. A camada de brilho tem opacidade máxima de 0,75 e entrada de 800ms com `ease-in-out`; a assinatura estática permanece abaixo para manter a letra legível. O retorno ao quadro estático usa o final sem brilho já presente no vídeo, também desacelerado.

Validado no localhost: taxa 0,5; em 4,52s de relógio, a mídia avançou 2,23s; duração efetiva 8s; transição computada `opacity 0.8s ease-in-out`. Reprodução terminou em `state=complete`, sem vídeo restante e sem erros de console. Captura `apogee-brilho-lento-local.png` na pasta de visualizações desta tarefa. Nenhuma nova geração, build, publicação ou deploy.

## Verificação em 24/10/2026

- `git diff --check` passou.
- Dev existente na porta 3000, PID 56771, preservado. Nenhum novo processo npm/build foi iniciado.
- Inspeção dos quadros do Flow confirmou o brilho percorrendo a palavra e a estrela; o clipe rejeitado com esfera não é referenciado pelo componente.
- Navegador integrado, 798x762: reprodução automática observada, `readyState=4`, duração 4s. Ao terminar, `state=complete` e o vídeo é desmontado, permanecendo a imagem estática. Nenhum erro de console na verificação.
- Quadro em 2,35s conferido e registrado em `apogee-signature-star-flow-local.png` na pasta de visualizações desta tarefa. A pausa temporária para essa captura foi removida por recarregamento.
- Mobile 390x844: assinatura com largura 358,8px, contida no viewport, sem overflow horizontal. Captura `apogee-signature-star-flow-mobile.png`.
- Redução de movimento: `state=static`, zero vídeos na assinatura. O tamanho de viewport foi restaurado. Movimento ficou habilitado na aba de preview para o teste do usuário.
- As tentativas de marcar as abas do Flow e do localhost como persistentes foram rejeitadas pela revisão automática; essa marcação não é necessária para servir os arquivos e foi omitida. Nenhuma alteração de projeto/publicação no Flow foi solicitada por essa etapa.


## Finalização autorizada — 24/10/2026

O usuário autorizou: “Finalize, teste e faça deploy”. A autorização substitui o limite local das etapas anteriores.

- O clipe escolhido do Flow foi retimado com interpolação temporal por mistura para 8s a 60fps (480 quadros), reproduzido a 1x. A mistura mantém a geometria fixa da marca, sem deformação por fluxo óptico.
- Saída publicada: `signature-light-flow-smooth-60fps.mp4`; opacidade 0,75 e entrada de 800ms mantidas.
- Teste no navegador integrado: 8s, 480 quadros, apenas 2 descartados no início; cadência estável de 60 quadros/s no restante. Estado final `complete`; sem overflow desktop.
- Terra recodificada em H.264 com keyframes a cada 6 quadros e sem B-frames, para tornar as buscas de tempo da rolagem mais leves. Conteúdo e duração originais preservados.
- A homepage passa a usar `listPublicOpportunities` e a filtragem vigente; exemplos e salvas locais foram retirados da página publicada. A busca completa usa o parâmetro público `busca`.
- `/makeitfly` e os componentes 3D compartilhados mantêm a versão de main. Rodapé institucional preservado.
- Suítes e build executados pelo CI, sem concorrer com o servidor local na fila do Mac. Resultado da publicação será registrado no relatório de release.
