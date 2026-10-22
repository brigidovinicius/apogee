# Navegação — correções finais e reteste em 21/10/2026

Estado: implementado e validado localmente na branch
`fix/navigation-audit-20261020`. Sem push, CI remoto, merge ou deploy.

## Correções

1. O atalho compartilhado “Pular para o conteúdo” passou de âncora nativa a
   `next/link`. O roteador agora conserva a rota ao sair e usar Voltar/Avançar.
   A mesma troca foi aplicada ao link de rolagem do hero, que usava a mesma
   âncora nativa. O HTML visual, as classes e os destinos foram preservados.
2. Os três retornos do Make It Fly à Apogee registram as coordenadas de saída
   na própria entrada do histórico, preservando os campos do Next.js e quaisquer
   outros campos existentes. Um componente sem DOM, no layout compartilhado,
   observa travessias do histórico e restaura a posição depois que a rota do
   evento é exibida. A posição só é aceita para a URL exata de `/makeitfly`, com
   coordenadas finitas e não negativas. Visitas novas não aplicam essa restauração.

Não foram alterados CSS, conteúdo do evento, animações, Terra, autenticação,
banco ou serviços de produção. A restauração não bloqueia rolagem, não muda
`history.scrollRestoration` e não substitui os dados de roteamento do Next.js.

## Evidência antes/depois

Antes das alterações, os testes de navegador reproduziram:

- URL do Make It Fly após Voltar, mas conteúdo da página inicial ao usar o atalho;
- retorno à seção Programação em vez do rodapé, após uma entrada direta móvel.

Depois, **36 verificações completas passaram no navegador, sem falhas**, cobrindo:

- Radar: filtros e paginação públicos, entradas desktop/CTA móvel/menu móvel,
  login local, paginação de membros, Voltar e Avançar até o público;
- administração: seis destinos móveis, fechamento, foco, escolha da página atual
  por Enter, sidebar desktop, marca e histórico;
- galeria: painel e galeria pública, com Voltar/Avançar em 1280 e 390 px;
- Make It Fly: quatro âncoras, saídas por cabeçalho/rodapé, entrada direta na
  Programação em celular, conteúdo e ponto de saída restaurados;
- atalho de acessibilidade por Enter nos três contextos: evento, Radar e painel.

Uma repetição para captura de evidência comparou a posição do rodapé antes e
depois: `top = 288.9140625 px` e `bottom = 844.1953125 px` em ambos os casos.

## Checagens locais

```sh
node --test --test-concurrency=1 tests/make-it-fly-scroll.test.mjs tests/navigation-return.test.mjs tests/deployment-isolation.test.mjs tests/energy-support.test.mjs tests/apogee-scroll.test.mjs tests/apogee-automatic-ui.test.mjs
```

Resultado: **40 passaram, 0 falhas**. O adaptador de renderização HTML do hero
foi atualizado para aceitar `next/link`. Os hashes dos dois TSX com mudanças de
navegação foram atualizados após revisão; a preservação do layout normaliza
somente o componente sem DOM e a mudança do atalho, mantendo a referência visual.
Os hashes de estilos, cena, animação e assets continuam iguais.

`git diff --check` e `node --check tests/browser/skip-link-history.mjs` passaram.
Não foi repetido build, typecheck nem a suíte completa nesta rodada.

## Ambiente e limites

O navegador usou o preview persistente em `http://127.0.0.1:4381/`. Componentes
de navegação e estilos são reais; catálogo, login e destinos administrativos são
simulados, e o hero/Terra são simplificados. O layout do preview recebeu as
mesmas alterações funcionais do layout da aplicação. Isso não valida login,
banco, pagamentos ou uma publicação em produção. O servidor permaneceu ativo.

Evidências na pasta de visualizações deste chat, em `navigation-final-fixes/`:
`final-browser-results.json`, `results.json`, `focused-tests.log`,
`scroll-before-after.json`, `rodape-restaurado-mobile.png` e
`radar-atalho-retorno.png`.
