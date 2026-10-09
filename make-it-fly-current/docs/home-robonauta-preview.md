# Home experimental com Robonauta

Pedido de 09/10/2026: testar uma home da Apogee com o mascote aprovado.

## Acesso local

- Prévia compilada: `http://127.0.0.1:3112/home-robonauta`.
- Desenvolvimento: `http://127.0.0.1:3108/home-robonauta`.
- Rota independente, com `noindex, nofollow`. Isso é orientação de indexação, não controle de acesso. Nenhuma publicação ou push foi realizado.
- A home `/` e a alteração que já existia em `app/page.tsx` foram preservadas.

## Implementação

Hero claro com Robonauta, mensagem da comunidade, links existentes para Make It Fly e galeria, seção do encontro, caminhos para galeria/Radar e rodapé compartilhado. O header ganhou uma variante clara opcional; o padrão continua escuro.

O poster WebP aprovado (120.770 bytes) e o repouso existente foram mantidos. A revisão de 09/10/2026 acrescenta dois MP4 H.264 silenciosos de oito segundos, 864×720, 24 fps e `faststart`: `robonauta-olhar-esquerda.mp4` (2.080.222 bytes) e `robonauta-olhar-direita.mp4` (1.920.634 bytes). Originais do Flow preservados em `direcao-personagem-apogee`; a primeira tentativa de direita, que virou para o lado errado, foi guardada em `intermediarios` e não integra a página.

### Giro da cabeça solicitado em 09/10/2026

Removido o deslocamento e a inclinação CSS da imagem inteira. Os novos clipes mostram a cabeça girando em relação ao pescoço, com mudança de perspectiva da carcaça do monitor e movimento dos cabos. As direções foram conferidas em sequências de quadros, sem espelhar os assets. São animações pré-renderizadas geradas no Flow (Veo 3.1 Lite); não há malha 3D ou acompanhamento contínuo do ângulo exato do cursor. A geração ainda pode produzir pequenas variações de forma/roupa entre quadros.

Entrar ou mover o cursor sobre o lado esquerdo/direito do palco escolhe a reação correspondente. Há uma faixa neutra central de 12% e histerese de 2% para evitar alternâncias na borda. Permanecer no mesmo lado não reinicia o clipe. Durante uma reação, apenas o último lado oposto fica pendente; centro/saída/aba oculta cancelam essa pendência. O clipe em andamento termina e volta ao repouso, com 160 ms antes de consumir uma direção pendente. Toque breve alterna lados; arraste para rolagem não dispara.

### Movimento contínuo

Por solicitação explícita do usuário, a prévia mantém reprodução automática sem controles de reprodução/pausa/reação, dicas de ativação ou bloqueio por `prefers-reduced-motion`. Essa decisão substitui o movimento opcional da primeira versão; não representa conformidade integral com as recomendações Apple. Tipografia e layout foram mantidos.

O repouso roda em loop silencioso; só o clipe ativo reproduz. Os três clipes são pré-carregados enquanto o documento está visível. A reprodução continua ao rolar a home e pausa com a aba oculta ou desmontagem. A camada anterior permanece visível até o próximo `play()` confirmar início; troca com fade de 160 ms. Bloqueio de autoplay é retomado dentro de um gesto real de ponteiro/teclado. Falha de uma direção desativa apenas aquele clipe e preserva o repouso; falha do repouso mantém o poster. Recarregar permite nova tentativa.

Validação da revisão: `npm run lint` passou com o único aviso anterior de `no-img-element` em `gallery-admin.tsx:81`; `npm test` passou em 212/212; `npm run build` passou, incluindo TypeScript e geração da rota. Prévia standalone atualizada na mesma porta 3112. Navegador confirmou autoplay sem clique, carregamento dos três vídeos, reações à esquerda/direita disparadas somente por `Input.dispatchMouseEvent` (`mouseMoved`) e ausência de transformação CSS da imagem. Sequência de quadros e captura da própria home mostram o giro da cabeça.

Não há conversa, voz, microfone ou novas dependências. Upload, autenticação, consentimento e backend não foram alterados.

## Validação da home inicial

- `npm run lint`: passou, com o aviso anterior de `no-img-element` em `components/gallery/gallery-admin.tsx:81`.
- `npm test`: 212/212 passaram. A primeira execução identificou a nova rota na lista fechada de superfícies; acrescentamos somente `app/home-robonauta/page.tsx` à expectativa, mantendo todas as demais restrições.
- `npm run typegen && npm run typecheck`: passaram.
- `npm run build`: passou; `/home-robonauta` foi gerada estaticamente.
- Smoke da versão compilada com `PORT=3112 HOSTNAME=127.0.0.1 node .next/standalone/server.js`, após copiar `public` e `.next/static` para o standalone.
- Navegador: inspeção visual a 1280×720, 1280×800 e 390×844; sem overflow horizontal nas dimensões verificadas. Menu móvel abriu/fechou. Poster inicial com preferência de movimento reduzido e metadados `noindex, nofollow` confirmados.
- Reprodução, reação pelo controle e pelo ponteiro, retorno ao repouso e pausa de ambos os vídeos confirmados pelos elementos de mídia. Imagens de evidência salvas na pasta de visualizações do chat.

## Limites

O movimento usa clipes direcionais de duração finita; ele não segue cada posição do mouse em tempo real. Toque foi implementado com distinção entre toque e arraste, sem validação em aparelho físico. Retry de autoplay, pausa por visibilidade e fallback individual foram revisados no código, sem teste de falhas induzidas nesta revisão. Sem JavaScript, imagem e navegação permanecem disponíveis.

Durante o desenvolvimento, abrir o menu nativo antes da hidratação terminou produziu um aviso de divergência do atributo `open`; essa interação precoce não foi reproduzida como falha funcional. A versão compilada foi usada para a revisão final. Uma chamada CDP do navegador demorou excessivamente; as demais verificações finais usaram os controles normais da página.

Para iniciar novamente a prévia, execute `npm run build`, copie `public` e `.next/static` para `.next/standalone` e rode o servidor standalone na porta local escolhida. A prévia depende do processo local permanecer ativo.
