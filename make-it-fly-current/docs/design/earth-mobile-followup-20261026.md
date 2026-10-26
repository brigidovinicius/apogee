# Ajustes locais — Terra no iPhone, brilho e navegação (26/10/2026)

Base publicada: `96446bdd6ee3014864e4a80eb9fffbd6371e1998`.
Branch local: `fix/earth-mobile-shimmer-20261026`.

## Comportamento

- Brilho na assinatura e na estrela reinicia a cada 10 segundos: clipe de 8 segundos e cerca de 2 segundos em repouso. Interrompe o ciclo com a aba oculta ou mídia fora da viewport, sem acumular reproduções.
- A Terra inicia um play silencioso e inline para liberar a decodificação antes do controle por rolagem. O seek aceita metadata disponível e conserva o destino mais recente durante a decodificação.
- Uma rejeição de autoplay permite nova tentativa por toque/teclado e mostra “Ativar movimento da Terra”. O vídeo não é descartado por uma restrição transitória do navegador. Preferências de movimento reduzido e economia de dados continuam respeitadas.
- “Radar” e “Explorar o Radar” abrem `/oportunidades`; a regra responsiva mantém Radar visível no celular.

Referência de comportamento do Safari: https://webkit.org/blog/6784/new-video-policies-for-ios/

## Verificações

Tudo sequencial pela fila npm, antes do servidor dev:

```
node --test --test-concurrency=1 tests/earth-home.test.mjs tests/earth-media-playback.test.mjs tests/site-shell.test.mjs
node node_modules/next/dist/bin/next typegen --webpack
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js components/home/earth-radar tests/earth-home.test.mjs tests/earth-media-playback.test.mjs
```

Resultado: 12 testes aprovados; typegen, TypeScript e lint sem erros. `git diff --check` aprovado.

Navegador integrado / Chromium, viewport 390x844:

- Intervalo medido entre passagens: 10.014 ms; clipe de 8s e playbackRate 1.
- Aos 56% da rolagem, vídeo da Terra em 4,912s e texto com opacidade 0,260; sem overflow horizontal.
- Simulação local de preload somente metadata e rejeição NotAllowedError: botão de ativação exibido; ao ativar, scene=ready, readyState=4, vídeo pausado para a rolagem e botão removido. Instrumentação temporária removida.
- Movimento reduzido: zero vídeos, imagens estáticas e texto visível.
- Radar e Explorar o Radar chegam a `/oportunidades`. A camada de comentários do Codex interceptou um clique do Playwright; a ativação DOM do link confirmou a navegação do aplicativo. Radar também foi ativado pelo controle nativo.
- O preview isolado não possui credenciais do catálogo; a página de destino exibe seu estado de indisponibilidade. Não foi feita alteração em dados de produção.

Limite: não houve execução em iPhone físico nem no motor WebKit nesta sessão. A simulação valida a recuperação e o viewport, mas a confirmação no Safari do aparelho continua pendente.

Somente implementação e teste local nesta etapa. Sem push, CI remoto, merge ou novo deploy. O Make It Fly permanece fora do escopo.
