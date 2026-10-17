# Revisão mobile da homepage Apogee

Preview: http://127.0.0.1:3109/ — somente local, sem deploy.

## Correções

- Menu compartilhado agora fecha ao tocar/clicar fora, ao sair com o foco, ao selecionar um destino e com Escape. Escape devolve o foco ao controle. O nome acessível acompanha aberto/fechado.
- A navegação tem altura máxima baseada em `100svh` e rolagem interna. Em 844 × 390 px, o menu ficou entre y=74 e y=352; foi possível revelar Membros sem rolar a página.
- O hover claro da navegação desktop foi limitado à navegação desktop. No menu mobile, texto navy permanece legível sobre sky. Cores observadas: rgb(7,24,45) / rgb(185,211,238), contraste 11.56:1.
- O restante do cabeçalho continua no servidor; apenas o menu recebeu um componente cliente pequeno. Links, destinos e controle de acesso foram preservados.

## Validação

- 14 verificações de interação registradas em `validacao-mobile.json`: menu, teclado, foco, categorias, âncora, CTA do Radar, pausa/retomada, movimento reduzido, menu nativo sem JavaScript e contraste.
- Viewports: 320×568, 360×800, 390×844, 430×932, 768×1024, 844×390 e 1440×900. Sem overflow horizontal; H1 em duas linhas sem cortes; nenhuma imagem quebrada nos checks finais.
- Preferência de movimento reduzido: ativa, zero animações em execução na medição CDP. Emulação restaurada ao fim.
- Zero exceções JavaScript registradas na rodada final, incluindo navegação ao Radar e retorno.
- ESLint dos componentes alterados, TypeScript e 263/263 testes passaram. Build final passou após a correção de contraste; `git diff --check` passou.
- Capturas: `mobile-homepage-revisada.png`, `mobile-homepage-completa-revisada.png`, `mobile-menu-revisado.png`, `mobile-menu-paisagem.png` e `mobile-comunidade-revisada.png`.

## Limites verificados

- Testes em viewport emulado no navegador integrado; aparelho físico e gestos de toque reais permanecem pendentes. O navegador não aceitou Input.dispatchTouchEvent; não se declara teste de toque físico.
- Radar e galeria usam replay de dados já públicos. Não há banco de produção conectado. Blog retorna erro local por DATABASE_URL ausente; esse destino não foi declarado funcional nesta prévia. Login, cadastro, pagamentos e operações de banco não foram exercitados.
- Sem JavaScript, hero, links e menu nativo permanecem disponíveis; Radar permanece no fallback de carregamento, e a galeria oferece link de fallback. Não se declara catálogo interativo sem JavaScript.
- A correção do menu compartilhado beneficia também as rotas que reutilizam o cabeçalho; não altera autenticação ou os destinos. O gate estético anterior continua com os limites já registrados.

Nenhum push, PR, merge ou deploy realizado. O preview foi mantido ativo para revisão.
