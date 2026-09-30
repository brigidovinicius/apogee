# Auditoria do liquid glass e das animações

Inspecione a loja do Make It Fly em `http://127.0.0.1:3001/loja` e compare visualmente com `https://thedropstore.org`. O objetivo é aproximar materiais, ritmo e comportamento da referência, preservando marca, conteúdo e produtos do Make It Fly. Não publique nem altere serviços externos.

O projeto ativo fica em `/Users/viniciusbrigido/Site interativo Rosa teste /make-it-fly-current`. Leia os arquivos AGENTS.md aplicáveis e a documentação da versão instalada do Next.js antes de sugerir alterações.

Inspecione estes arquivos por inteiro:

- `app/loja/store-orb.tsx`
- `app/loja/store-glass-shader.ts`
- `app/loja/store-orb.module.css`
- `app/loja/use-store-motion.ts`
- `app/loja/loja.module.css`
- `app/loja/store-experience.tsx`

Valide no navegador em desktop e celular, com movimento normal e `prefers-reduced-motion: reduce`. Observe também rolagem rápida, mouse parado enquanto os cards passam, hover/saída do mouse, navegação por teclado, abertura/fechamento dos diálogos e retorno ao topo.

No vidro, confira transparência do canvas, centro incolor, contraste variável nas bordas, reflexos móveis, deformação suave, normais coerentes, Fresnel, espaço de cor e composição alpha. Diferencie refração do ambiente procedural de refração do conteúdo HTML: a implementação atual não captura o DOM em uma textura. Não descreva como refração real do texto um efeito que apenas permite enxergá-lo por transparência.

No movimento, confira composição de transformações, estabilidade em telas de 60/120 Hz, independência da velocidade do scroll, ausência de interceptação de wheel, entrada progressiva dos cards e retorno suave depois do hover. Inspecione pausas com aba oculta, elemento fora de vista e diálogo aberto; verifique limpeza de requestAnimationFrame, observers, listeners, geometria e material WebGL. Confira também fallback sem WebGL e perda/restauração do contexto.

Entregue no máximo 8 problemas prioritários. Para cada um: evidência observada, arquivo e linha, causa, impacto visual/funcional e correção mínima proposta. Separe fatos confirmados de hipóteses. Não atribua FPS nem tempos sem medir. Inclua capturas comparáveis e um checklist de testes executados. Preserve alterações existentes. A auditoria é somente leitura; aguarde autorização para implementar as propostas.
