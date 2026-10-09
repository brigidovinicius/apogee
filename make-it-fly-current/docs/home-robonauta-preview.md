# Home experimental com Robonauta

Pedido de 09/10/2026: testar uma home da Apogee com Robonauta. A revisão atual
substitui as reações em vídeo por acompanhamento contínuo do ponteiro com cabeça
3D. A validação registrada abaixo separa esta revisão das versões anteriores.

## Acesso local

- Endereço da prévia compilada: `http://127.0.0.1:3112/home-robonauta`. Revisão 3D compilada e servidor standalone reiniciado; a aba do usuário foi recarregada.
- Desenvolvimento: `http://127.0.0.1:3108/home-robonauta`.
- Rota independente, com `noindex, nofollow`. Isso é orientação de indexação, não controle de acesso. Nenhuma publicação ou push foi realizado.
- A home `/` e a alteração que já existia em `app/page.tsx` foram preservadas.

## Implementação atual — cabeça 3D com corpo fotográfico

Hero claro com Robonauta, mensagem da comunidade, links existentes para Make It Fly e galeria, seção do encontro, caminhos para galeria/Radar e rodapé compartilhado. O header ganhou uma variante clara opcional; o padrão continua escuro.

A composição atual é híbrida: **corpo fotográfico 2D e cabeça de monitor em
malha 3D**, renderizados com Three.js/WebGL em um canvas. Não é um modelo 3D
completo do personagem. `components/home/robonauta.tsx` controla entrada do
ponteiro, visibilidade e fallback; `components/home/robonauta-scene.ts` constrói
a cena; `lib/robonauta-motion.ts` calcula os ângulos e sua suavização.

A fotografia `robonauta-body.webp` ocupa um plano fixo atrás da cabeça. A cabeça
gira sobre um pivô junto ao pescoço, com carcaça volumétrica arredondada, laterais,
respiros, conexões e cabos cuja geometria acompanha o movimento. A frente recebe
uma textura mapeada da fotografia aprovada `robonauta-poster.webp`; os olhos não
foram redesenhados ou regenerados. A câmera e o corpo ficam fixos.

O ponteiro é acompanhado continuamente **dentro do hero**, com limites de
**±20° na horizontal e ±10° na vertical**. A suavização preserva continuidade ao
inverter a direção. Sair do hero, cancelar o ponteiro ou perder o foco devolve a
cabeça suavemente ao repouso próximo da posição neutra. Sem acompanhamento, há
um pequeno movimento de repouso e movimento discreto dos cabos. Um toque
primário pode direcionar a cabeça enquanto pressionado; liberar/cancelar o toque
restaura o repouso, sem impedir a rolagem nativa.

**O componente atual não contém vídeos nem usa os clipes direcionais antigos.**
Também não desloca ou inclina a fotografia inteira por CSS. A interação altera
a rotação da cabeça na cena, mantendo tipografia, layout e máscara do palco.

O movimento inicia automaticamente, sem controles de ligar/pausar/reagir,
conforme o pedido do usuário. Não há bloqueio por `prefers-reduced-motion` nesta
revisão; essa escolha não representa conformidade integral com as recomendações
Apple sobre movimento opcional.

O loop de renderização é suspenso quando a aba fica oculta ou o palco sai da
viewport e retomado quando ambos voltam a estar visíveis. A resolução do canvas
limita o pixel ratio a 1,75. Listeners, observadores, animação, texturas,
geometrias, materiais e renderer são descartados na desmontagem ou falha. O
poster permanece até o primeiro quadro renderizado; erro de importação,
carregamento de textura ou perda do contexto WebGL devolve a apresentação ao
poster. Sem JavaScript, imagem e navegação continuam disponíveis.

Não há conversa, voz ou microfone. Three.js já era dependência do projeto.
Upload, autenticação, consentimento e backend não foram alterados nesta revisão.

### Origem do corpo fotográfico

- Arquivo em uso: `public/mascot/robonauta-body.webp`, **1374 × 1145**, **94.118 bytes**.
- Ferramenta: `image_gen` integrada, a partir de `direcao-personagem-apogee/robonauta-referencia-lisa.png` no workspace.
- Prompt resumido: remover apenas o monitor e os cabos; preservar roupa, pescoço, enquadramento e iluminação; reconstruir fundo cinza uniforme de estúdio, sem acrescentar rosto, cabeça ou adornos.
- Resultado original da geração: `.codex/generated_images/01a11e4e-27c2-7511-8196-46638e9fd40f/exec-97fa8108-6e7b-4b95-a30b-4dcd034c52a5.png`.
- `robonauta-poster.webp` continua como fallback e fonte da textura frontal com os olhos aprovados.

### Validação da revisão 3D

- `npm test`: **217/217 passaram**, incluindo a lógica de movimento da cabeça.
- `npm run lint`: passou com o aviso anterior de `no-img-element` em `components/gallery/gallery-admin.tsx:81`.
- `npm run typecheck` e `npm run build`: passaram. O build final inclui câmera em perspectiva e carcaça com profundidade de 1,5 unidades; a placa do corpo conserva o enquadramento original. Standalone reiniciado na porta 3112 com os assets atualizados.
- Navegador na versão compilada: canvas Three.js pronto, zero elementos de vídeo, nenhuma transformação CSS do canvas e nenhum overflow horizontal na viewport atual de 629×725. Movimentos reais de mouse confirmaram yaw à esquerda −0,338 rad, posição intermediária +0,121 rad, pitch acima −0,146 rad e abaixo +0,167 rad, com mudança imediata do alvo e amortecimento contínuo. Capturas mostram o corpo fixo, as laterais do monitor e os cabos. São observações funcionais/visuais; não um benchmark de FPS.

### Limites atuais

O corpo é uma fotografia em um plano, não uma malha anatômica. A frente do
monitor usa a imagem dos olhos como textura: não há rig facial nem animação
independente de olhos/pálpebras nesta revisão. As laterais e os cabos são
geometria criada para esta implementação e foram inspecionadas em capturas do navegador; não foram extraídas de um modelo original do personagem. A cena não é um modelo 3D completo
extraído da imagem ou da referência L.I.S.A.

Interação em aparelho físico, suspensão por aba/offscreen, perda de contexto WebGL e falhas de carregamento foram revisadas no código, sem testes de falhas induzidas nesta revisão. Não confundir testes da
função de movimento com validação visual ou de desempenho da cena completa.

## Histórico — versões substituídas

Os registros a seguir descrevem implementações anteriores. Seus assets e
evidências foram preservados, mas seus resultados de build/navegador e suas
limitações não caracterizam automaticamente a revisão 3D atual.

### Versão com clipes direcionais

O poster WebP aprovado (120.770 bytes) e o repouso existente foram mantidos. A revisão de 09/10/2026 acrescenta dois MP4 H.264 silenciosos de oito segundos, 864×720, 24 fps e `faststart`: `robonauta-olhar-esquerda.mp4` (2.080.222 bytes) e `robonauta-olhar-direita.mp4` (1.920.634 bytes). Originais do Flow preservados em `direcao-personagem-apogee`; a primeira tentativa de direita, que virou para o lado errado, foi guardada em `intermediarios` e não integra a página.

#### Giro da cabeça por clipes, solicitado em 09/10/2026

Removido o deslocamento e a inclinação CSS da imagem inteira. Os novos clipes mostram a cabeça girando em relação ao pescoço, com mudança de perspectiva da carcaça do monitor e movimento dos cabos. As direções foram conferidas em sequências de quadros, sem espelhar os assets. São animações pré-renderizadas geradas no Flow (Veo 3.1 Lite); não há malha 3D ou acompanhamento contínuo do ângulo exato do cursor. A geração ainda pode produzir pequenas variações de forma/roupa entre quadros.

Entrar ou mover o cursor sobre o lado esquerdo/direito do palco escolhe a reação correspondente. Há uma faixa neutra central de 12% e histerese de 2% para evitar alternâncias na borda. Permanecer no mesmo lado não reinicia o clipe. Durante uma reação, apenas o último lado oposto fica pendente; centro/saída/aba oculta cancelam essa pendência. O clipe em andamento termina e volta ao repouso, com 160 ms antes de consumir uma direção pendente. Toque breve alterna lados; arraste para rolagem não dispara.

#### Reprodução automática da versão com clipes

Por solicitação explícita do usuário, a prévia mantém reprodução automática sem controles de reprodução/pausa/reação, dicas de ativação ou bloqueio por `prefers-reduced-motion`. Essa decisão substitui o movimento opcional da primeira versão; não representa conformidade integral com as recomendações Apple. Tipografia e layout foram mantidos.

O repouso roda em loop silencioso; só o clipe ativo reproduz. Os três clipes são pré-carregados enquanto o documento está visível. A reprodução continua ao rolar a home e pausa com a aba oculta ou desmontagem. A camada anterior permanece visível até o próximo `play()` confirmar início; troca com fade de 160 ms. Bloqueio de autoplay é retomado dentro de um gesto real de ponteiro/teclado. Falha de uma direção desativa apenas aquele clipe e preserva o repouso; falha do repouso mantém o poster. Recarregar permite nova tentativa.

Validação da revisão: `npm run lint` passou com o único aviso anterior de `no-img-element` em `gallery-admin.tsx:81`; `npm test` passou em 212/212; `npm run build` passou, incluindo TypeScript e geração da rota. Prévia standalone atualizada na mesma porta 3112. Navegador confirmou autoplay sem clique, carregamento dos três vídeos, reações à esquerda/direita disparadas somente por `Input.dispatchMouseEvent` (`mouseMoved`) e ausência de transformação CSS da imagem. Sequência de quadros e captura da própria home mostram o giro da cabeça.

Não há conversa, voz, microfone ou novas dependências. Upload, autenticação, consentimento e backend não foram alterados.

### Validação histórica da home inicial

- `npm run lint`: passou, com o aviso anterior de `no-img-element` em `components/gallery/gallery-admin.tsx:81`.
- `npm test`: 212/212 passaram. A primeira execução identificou a nova rota na lista fechada de superfícies; acrescentamos somente `app/home-robonauta/page.tsx` à expectativa, mantendo todas as demais restrições.
- `npm run typegen && npm run typecheck`: passaram.
- `npm run build`: passou; `/home-robonauta` foi gerada estaticamente.
- Smoke da versão compilada com `PORT=3112 HOSTNAME=127.0.0.1 node .next/standalone/server.js`, após copiar `public` e `.next/static` para o standalone.
- Navegador: inspeção visual a 1280×720, 1280×800 e 390×844; sem overflow horizontal nas dimensões verificadas. Menu móvel abriu/fechou. Poster inicial com preferência de movimento reduzido e metadados `noindex, nofollow` confirmados.
- Reprodução, reação pelo controle e pelo ponteiro, retorno ao repouso e pausa de ambos os vídeos confirmados pelos elementos de mídia. Imagens de evidência salvas na pasta de visualizações do chat.

### Limites e ocorrências da versão com clipes

O movimento usa clipes direcionais de duração finita; ele não segue cada posição do mouse em tempo real. Toque foi implementado com distinção entre toque e arraste, sem validação em aparelho físico. Retry de autoplay, pausa por visibilidade e fallback individual foram revisados no código, sem teste de falhas induzidas nesta revisão. Sem JavaScript, imagem e navegação permanecem disponíveis.

Durante o desenvolvimento, abrir o menu nativo antes da hidratação terminou produziu um aviso de divergência do atributo `open`; essa interação precoce não foi reproduzida como falha funcional. A versão compilada foi usada para a revisão final. Uma chamada CDP do navegador demorou excessivamente; as demais verificações finais usaram os controles normais da página.

## Reabrir a prévia local

Para iniciar novamente a prévia, execute `npm run build` e confirme seu sucesso,
copie `public` e `.next/static` para `.next/standalone` e rode o servidor
standalone na porta local escolhida. A prévia depende do processo local
permanecer ativo. Esta validação é local; não houve push ou deploy.
