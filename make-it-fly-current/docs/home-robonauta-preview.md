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

O componente cliente reproduz repouso, reage ao cursor ou toque breve e retorna ao repouso. Há controles de reprodução/pausa e reação por teclado. Movimento reduzido começa estático, com reprodução por escolha explícita. O repouso usa `preload="none"`; metadados da reação só são antecipados enquanto o movimento está habilitado e o mascote está visível. Vídeos pausam fora da área visível/aba e têm fallback para a imagem. Sem JavaScript, os controles ficam desabilitados e a imagem/navegação continuam disponíveis.

### Refinamento da reação ao mouse

Mantidas a tipografia, as imagens e a composição. A camada anterior permanece visível, pausada, até o próximo clipe estar reproduzindo; a troca usa um fade de 160 ms. A preferência por movimento reduzido também desativa esse fade. Uma dica contextual explica como interagir e informa quando movimento reduzido ou pausa manual estão ativos. Corrigido um espaço entre frases que se uniam na largura intermediária da home.

Orientação consultada: [Apple HIG — Motion](https://developer.apple.com/design/human-interface-guidelines/motion), que recomenda movimento opcional, feedback breve e controle para interromper animações. Isto não representa certificação de conformidade de toda a página.

Validação desse refinamento: ESLint do componente e build com TypeScript passaram; a prévia standalone foi reiniciada na mesma porta. No navegador, o ponteiro com movimento reduzido manteve ambos os vídeos pausados; após reprodução explícita, disparou a reação e retornou ao repouso. Pausa manual confirmada. O tratamento de toque permanece implementado, sem novo teste em aparelho físico.

Não há conversa, voz, microfone ou novas dependências. Upload, autenticação, consentimento e backend não foram alterados.

## Validação

- `npm run lint`: passou, com o aviso anterior de `no-img-element` em `components/gallery/gallery-admin.tsx:81`.
- `npm test`: 212/212 passaram. A primeira execução identificou a nova rota na lista fechada de superfícies; acrescentamos somente `app/home-robonauta/page.tsx` à expectativa, mantendo todas as demais restrições.
- `npm run typegen && npm run typecheck`: passaram.
- `npm run build`: passou; `/home-robonauta` foi gerada estaticamente.
- Smoke da versão compilada com `PORT=3112 HOSTNAME=127.0.0.1 node .next/standalone/server.js`, após copiar `public` e `.next/static` para o standalone.
- Navegador: inspeção visual a 1280×720, 1280×800 e 390×844; sem overflow horizontal nas dimensões verificadas. Menu móvel abriu/fechou. Poster inicial com preferência de movimento reduzido e metadados `noindex, nofollow` confirmados.
- Reprodução, reação pelo controle e pelo ponteiro, retorno ao repouso e pausa de ambos os vídeos confirmados pelos elementos de mídia. Imagens de evidência salvas na pasta de visualizações do chat.

## Limites

O movimento é composto pelos clipes aprovados: não é um modelo 3D articulado nem rastreamento contínuo dos olhos. Toque foi implementado com distinção entre toque e arraste; não foi validado em aparelho físico. Suspensão por visibilidade, mudança de preferência do sistema e fallback de erro foram revisados no código, sem teste de falhas induzidas. Um erro de mídia mantém a imagem e exige recarregar para tentar reproduzir novamente.

Durante o desenvolvimento, abrir o menu nativo antes da hidratação terminou produziu um aviso de divergência do atributo `open`; essa interação precoce não foi reproduzida como falha funcional. A versão compilada foi usada para a revisão final. Uma chamada CDP do navegador demorou excessivamente; as demais verificações finais usaram os controles normais da página.

Para iniciar novamente a prévia, execute `npm run build`, copie `public` e `.next/static` para `.next/standalone` e rode o servidor standalone na porta local escolhida. A prévia depende do processo local permanecer ativo.
