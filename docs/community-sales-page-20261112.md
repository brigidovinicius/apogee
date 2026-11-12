# Comunidade Apogee — página local de apresentação

## Escopo confirmado

- Clonar o visual e a estrutura de `/makeitfly` para a rota `/comunidade`.
- Usar Human Academy como referência de organização da proposta educacional, sem copiar seus materiais ou promessas comerciais.
- Apresentar Radar de oportunidades disponível, cursos de IA em preparação e newsletter curada ainda não lançada.
- Preço, formato de adesão e frequência da newsletter permanecem indefinidos.
- Preparação local; não inclui publicação, captura de interessados, cobrança, alteração da Stripe ou mudanças no acesso ao Radar.

## Implementação

Base: `origin/main` em `052c69c`, branch isolada `feat/community-sales-20261112`.

1. Conteúdo próprio em `make-it-fly-current/content/community.ts`, sem importar agenda, patrocínio ou regras de inscrição do evento.
2. Nova rota em `make-it-fly-current/app/comunidade/page.tsx`, com metadados próprios e `noindex, nofollow` enquanto a oferta não está finalizada.
3. Composição em `make-it-fly-current/components/community/community-sales-page.tsx`, reutilizando diretamente CSS, Terra animada, poster e linguagem visual do Make It Fly. CSS próprio somente para o título, estados de entrega, FAQ e ajustes do texto.
4. Exceção exata para `/comunidade` no wrapper visual global, permitindo que o clone mantenha a identidade do Make It Fly. Teste existente ampliado para cobrir a rota.

Os componentes e estilos originais de `/makeitfly` não foram editados. Nenhuma dependência nova foi instalada. `node_modules` é um symlink local ignorado pelo Git para dependências existentes da mesma versão do Next.js.

## Comportamentos

- Menu e entregáveis levam às respectivas seções por âncora.
- Ações de exploração levam a `/oportunidades`, preservando a autorização e as condições comerciais existentes do Radar.
- FAQ usa `details/summary`, com teclado e foco visível.
- Não há formulário, simulação de inscrição, promessa de entrega pronta ou checkout da comunidade.
- A cena da Terra e seu fallback seguem os componentes existentes; o movimento reduzido usa a configuração já adotada no Make It Fly.

## Validação

Todos os comandos de projeto com Node passam explicitamente pela fila FIFO global.

- `next typegen --webpack`: passou.
- ESLint nos arquivos da alteração: passou.
- `tsc --noEmit --incremental false`: passou.
- `node --test --test-concurrency=1 tests/apogee-design-system.test.mjs`: 2 testes passaram.
- Revisão independente: corrigido contraste do rótulo da FAQ sobre fundo branco.
- `APOGEE_LOCAL_PREVIEW=1 APOGEE_BEHAVIOR_ENABLED=false next build --webpack`: passou no candidato final; rota `/comunidade` incluída. Foi usada a configuração de preview local existente, com um worker e sem o pacote `standalone`. Docker e o empacotamento para produção não fazem parte desta validação.
- Navegador no build compilado: 1440, 1024, 768, 390 e 320 pixels; sem estouros de texto nas seções após os ajustes de responsividade. Uma primeira passagem percorreu todas as seções; a passagem final confirmou as duas seções ajustadas nas cinco larguras.
- Navegação por âncoras, FAQ, foco inicial e skip link: passaram. Nenhuma âncora sem destino.
- Movimento reduzido: conteúdo com opacidade 1 e sem transformação nos blocos verificados.
- Console: zero erros. Houve aviso de depreciação de `THREE.Clock` na cena 3D reutilizada e avisos de preload de CSS. A cena chegou ao estado `ready`.
- Nenhum formulário nem link de checkout na página; rastreamento desabilitado no ambiente de QA.
- Links legais reutilizam a decisão de disponibilidade do provider existente, como no rodapé geral.
- Servidor de QA temporário em `127.0.0.1:3457`, encerrado após a validação para liberar a fila. Nenhum servidor anterior foi interrompido.

Capturas fora do worktree versionado: `../outputs/community-sales-20261112/`, incluindo `desktop-hero.png`, `desktop-entregaveis.png`, `1440-radar.png`, `mobile-inicio.png`, `390-entregaveis.png` e `320-entregaveis.png`.

## Pendências comerciais

Antes de publicar ou abrir adesões, definir preço e modalidade, escopo e lançamento dos cursos, frequência e operação da newsletter e destino da ação comercial. A página atual oferece exploração do Radar, sem apresentar isso como adesão paga à comunidade.
