# Revisão mobile — membros e administração

18/10/2026. Alterações locais sobre `40779b9`, sem push ou deploy.

## Correções

- Os seletores da barra de membros agora atingem somente sua navegação direta. A grade de três abas não invade mais o seletor Administrador/Usuário aninhado.
- As duas opções de modo mantêm duas colunas de largura igual no celular, com texto de 13 px e alvos de pelo menos 44 px. A explicação usa 12 px.
- Identidade do membro organizada em avatar, nome flexível e Sair; nomes de usuário longos podem quebrar linha sem pressionar as ações.
- Reduzido o espaço inicial da área de membros no celular.
- O seletor de modo saiu do cabeçalho fixo do painel. Somente marca e menu ficam fixos; os controles de conta rolam com o conteúdo. A condição de exibição para administradores permanece a mesma.
- Menu administrativo limitado à altura disponível, com rolagem interna e contenção da rolagem. Em uma janela de 390 × 320 px, o cabeçalho caiu de 272,30 para 79,40 px e o menu terminou em 286,19 px, dentro da tela; antes terminava em 350,19 px.
- Indicadores em duas colunas a partir de 360 px, com cartões mais compactos. Em 320 px permanece uma coluna.
- Campos de texto, seletores e áreas de texto administrativos usam 16 px no celular, inclusive no editor de artigos.

A autenticação, os destinos dos links, os formulários e suas ações foram preservados. Make It Fly não foi alterado.

## Validação

`npm run lint`, `npm run typecheck`, `npm test` e `npm run build`, executados em sequência pela fila global. 265 testes passaram. Lint sem erros, com o aviso preexistente de `<img>` em `gallery-admin.tsx:81`. `git diff --check` passou.

O teste de alvos de toque foi ajustado para procurar o seletor específico da navegação direta, conservando a exigência de altura mínima de controle.

Revisão no navegador: sete telas × sete tamanhos = 49 combinações.

- Telas: fórum com controles administrativos, membro comum com nome longo, perfil, edição de perfil, criação de tópico, painel e editor de artigo.
- Tamanhos: 320×568, 360×740, 390×844, 430×932, 844×390, 768×1024 e 1440×900.
- Nenhuma rolagem horizontal; abas e opções de modo com altura mínima de 44 px; nenhum campo de texto visível abaixo de 16 px no celular.
- Menu em janela de 390×320 px: abertura, encaixe no viewport e rolagem até Auditoria conferidos.
- As duas abas de revisão foram atualizadas e devolvidas ao tamanho normal do navegador.

## Limite das amostras

As páginas `/__review/` usam HTML dos componentes e CSS reais, com dados fictícios e sem gravações. A ferramenta auxiliar foi corrigida para respeitar `composes` dos módulos CSS, como o Next já faz na aplicação; isso restaura o estilo composto dos avatares na amostra. Não foi necessário alterar os avatares de produção.

Essa revisão confirma apresentação e geometria responsiva; não comprova operações autenticadas no banco. Não foram criadas contas, enviados arquivos ou publicados conteúdos.

Preview de membros: http://127.0.0.1:3109/__review/members
Preview do painel: http://127.0.0.1:3109/__review/admin
