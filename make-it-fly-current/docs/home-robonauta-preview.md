# Home experimental com Robonauta

Pedido de 09/10/2026: testar uma home da Apogee com o mascote aprovado.

## Acesso local

- Prévia compilada: `http://127.0.0.1:3112/home-robonauta`.
- Desenvolvimento: `http://127.0.0.1:3108/home-robonauta`.
- Rota independente, com `noindex, nofollow`. Isso é orientação de indexação, não controle de acesso. Nenhuma publicação ou push foi realizado.
- A home `/` e a alteração que já existia em `app/page.tsx` foram preservadas.

## Implementação

Hero claro com Robonauta, mensagem da comunidade, links existentes para Make It Fly e galeria, seção do encontro, caminhos para galeria/Radar e rodapé compartilhado. O header ganhou uma variante clara opcional; o padrão continua escuro.

Os assets aprovados de `direcao-personagem-apogee` foram integrados a `public/mascot`: poster WebP de 120.770 bytes e dois MP4 H.264 silenciosos de oito segundos, com proporção 6:5. Os originais foram preservados. O poster mantém os olhos, monitor, roupas e cabos aprovados.

O componente inicia o repouso automaticamente, em loop e sem som. A reação ocorre ao entrar ou movimentar o cursor sobre o palco e retorna ao repouso ao terminar. O cursor também controla um deslocamento máximo de 7 px × 4 px e inclinação máxima de 2° × 1,2°, aplicados apenas à camada interna do mascote, com suavização de 240 ms. Ao sair, o personagem volta ao centro. Toque breve dispara a reação; arraste para rolar não dispara.

### Movimento contínuo solicitado em 09/10/2026

Por solicitação explícita do usuário, removidos os controles de reprodução/pausa/reação, as dicas de ativação e o bloqueio por `prefers-reduced-motion`. Esta decisão substitui a versão anterior de movimento opcional nesta prévia; não representa conformidade integral com as recomendações Apple. Tipografia, layout da home e assets foram preservados.

O vídeo continua quando se rola a home e pausa apenas quando a aba/documento fica oculto ou o componente é desmontado. Retorna automaticamente quando a página volta a ficar visível. Ambos os clipes são pré-carregados para reduzir a latência da reação; somente o clipe ativo reproduz. Se o navegador bloquear autoplay, um gesto real de ponteiro/teclado tenta `play()` diretamente, sem exibir um controle adicional. Erro de mídia mantém o poster.

A camada anterior permanece visível, pausada, até o próximo clipe começar; a troca usa fade de 160 ms. A reação não reinicia a cada evento do ponteiro. A posição é medida no palco imóvel e aplicada por `requestAnimationFrame`, com cancelamento ao sair, ocultar a página ou desmontar o componente. Eventos de movimento também disparam a reação, recuperando uma entrada de mouse ocorrida antes da hidratação.

Validação dessa revisão: ESLint do componente e build com TypeScript passaram; a prévia standalone foi atualizada na mesma porta. Navegador confirmou autoplay sem qualquer clique, ausência dos controles, reação usando somente `Input.dispatchMouseEvent` com `type: mouseMoved`, deslocamento em ambas as direções, retorno ao centro e retorno automático ao repouso. O teste partiu do navegador que antes sinalizava movimento reduzido.

Verificação a 390×844: vídeo em reprodução automática, nenhum botão de animação e nenhuma rolagem horizontal. A suíte existente foi reexecutada e passou em 212/212 testes. Nenhum teste foi relaxado nesta revisão.

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

O movimento combina os clipes aprovados e transformação leve da camada visual: não é um modelo 3D articulado nem rastreamento contínuo dos olhos. Toque foi implementado com distinção entre toque e arraste; não foi validado em aparelho físico. Suspensão por visibilidade, retry de bloqueio de autoplay e fallback de erro foram revisados no código, sem teste de falhas induzidas. Um erro de mídia mantém a imagem e exige recarregar para tentar reproduzir novamente. Sem JavaScript, a imagem e a navegação permanecem disponíveis.

Durante o desenvolvimento, abrir o menu nativo antes da hidratação terminou produziu um aviso de divergência do atributo `open`; essa interação precoce não foi reproduzida como falha funcional. A versão compilada foi usada para a revisão final. Uma chamada CDP do navegador demorou excessivamente; as demais verificações finais usaram os controles normais da página.

Para iniciar novamente a prévia, execute `npm run build`, copie `public` e `.next/static` para `.next/standalone` e rode o servidor standalone na porta local escolhida. A prévia depende do processo local permanecer ativo.
