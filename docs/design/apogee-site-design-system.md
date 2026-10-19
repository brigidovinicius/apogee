# Design system da homepage nas páginas Apogee

Atualizado em 18/10/2026. Implementação local, sem push ou deploy.

## Escopo e identidade

A identidade da homepage foi compartilhada com as páginas públicas, a área de membros e a administração: azul-marinho #07182D, branco, azul-claro #B9D3EE, Instrument Serif nos títulos e Inter no texto. Espaçamento lateral responsivo, controles com cantos de 0,4 rem, superfícies planas e foco visível ficam no escopo `data-apogee-design`.

O componente `ApogeeDesignSystem` recebe os filhos já renderizados pelo servidor. Ele aplica a camada visual conforme a rota, sem mover consultas, regras de acesso, formulários ou ações para o cliente. O contêiner usa `display: contents` para preservar os layouts existentes.

`/makeitfly` e toda sua subárvore, incluindo `/makeitfly/participar`, retornam os filhos originais sem contêiner nem tokens novos. Os estilos globais, fontes e componentes publicados do evento permanecem intactos.

## Cobertura

| Família | Rotas | Tratamento |
| --- | --- | --- |
| Institucional | `/`, `/home-robonauta` | Tokens e navegação compartilhados; homepage mantém suas seções e animações |
| Radar | `/oportunidades`, `/oportunidades/avisos` | Títulos, margens, cartões, rótulos, controles e shell da confirmação de avisos |
| Editorial | `/blog`, `/blog/[slug]` | Tipografia, categorias, cartões, leitura; erro recuperável com tentativa novamente |
| Comunidade pública | `/galeria`, `/loja` | Shell da galeria, títulos, superfícies, botões; navegação e diálogos da loja preservados |
| Entrada | `/login`, `/membros/entrar`, `/membros/cadastro` | Redirecionamento existente e formulários no layout de membros |
| Membros | `/membros`, `/membros/oportunidades` | Navegação, painéis, acesso ao Radar e listas |
| Fórum | `/membros/forum/[categoria]`, `/novo`, `/[topico]` | Cabeçalhos, formulários, tópicos e respostas via módulo compartilhado |
| Perfis | `/membros/perfil/[username]`, `/editar`, `/configurar` | Tipografia, campos, cartões e ações via módulo compartilhado |
| Administração | `/admin`, `/admin/radar`, `/admin/curadoria`, `/admin/usuarios`, `/admin/acesso-negado` | Shell, navegação ativa, títulos, métricas, painéis e estados |
| CMS | `/admin/posts`, `/novo`, `/[id]` | Editor, lista, histórico, labels, painéis e controles |
| Galeria administrativa | `/gerenciar-galeria` | Título, formulário, controles e cartões; `requireAdmin` preservado |
| Exceção | `/makeitfly`, `/makeitfly/participar` | Sem alteração visual |

Não houve alteração de banco, regras de publicação, segurança, endpoints ou persistência. O link Participar da galeria continua disponível. A foto removida da comunidade e o Robonauta removido da homepage não foram reintroduzidos.

## Validação

Comandos executados em sequência pela fila global: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

- 265 testes passaram; zero falhas. Incluem limites de rota e renderização dos filhos, autenticação, contratos existentes e hashes do Make It Fly.
- Build e tipos passaram. Lint sem erros; permanece um aviso preexistente de `<img>` em `gallery-admin.tsx:81`.
- `git diff --check` passou.
- 13 telas verificadas em 320, 390, 768 e 1440 px: 52 combinações sem overflow horizontal. Incluem sete páginas reais e seis amostras isoladas de blog, artigo, fórum, perfil, painel e editor.
- Make It Fly e inscrição: comparação antes/depois de dez propriedades computadas em títulos, seções, cabeçalho, campos e botões. Resultado idêntico em 1440 e 390 px, nas quatro combinações. Navegação cliente galeria → evento → galeria também remove e restaura o tema corretamente.
- Radar: seleção de categoria, busca sem resultados, limpeza, abertura/fechamento de filtros e menu mobile com Escape.
- Entrada: campos vazios retornam erros específicos sem criar conta.
- Galeria: âncora de envio, opção anônima e publicação bloqueada sem fotos/consentimento. Corrigida a opacidade do CTA quando o grid entra na tela.
- Loja: menu mobile, Em breve e detalhes do produto; Escape fecha e devolve o foco ao botão original.
- Cinco rotas protegidas conferidas sem sessão: redirecionamento para entrada com `next` preservado.

## Preview e limites

Preview real: http://127.0.0.1:3109/oportunidades
Amostras visuais isoladas: http://127.0.0.1:3109/__review/

O preview usa o snapshot público local do Radar e uma galeria vazia. Configuração sintética de autenticação aponta exclusivamente para loopback sem banco ativo, permitindo renderizar a entrada anônima sem credenciais reais. O blog real exibe o estado recuperável de indisponibilidade porque não há banco local.

As seis amostras em `/__review/` são HTML gerado a partir dos componentes e CSS reais com dados fictícios, identificadas por faixa visível e sem ações persistentes. O servidor auxiliar de preview atende essas amostras apenas localmente; não existe rota de amostra, bypass de autenticação ou fixture de dados no código de produção. Elas servem à revisão visual, não comprovam jornadas autenticadas. Nenhuma conta, artigo, foto, mensagem ou aviso foi gravado para testar o redesign.

Capturas `design-system-*.png` e `validacao-design-system.json` acompanham a entrega. O navegador foi devolvido ao tamanho normal e deixado no Radar atualizado.

## Revisão mobile de membros e administração — 18/10/2026

A revisão seguinte corrigiu a interferência entre a navegação do membro e a alternância de modo, reduziu o cabeçalho fixo do painel, limitou o menu em telas baixas, reorganizou os indicadores e aumentou os campos administrativos para 16 px no celular. Foram verificadas 49 combinações de sete telas e sete tamanhos, incluindo membro comum com nome longo, perfil e formulários. Os 265 testes e o build passaram novamente. Consulte `members-admin-mobile-review.md` para medições e limites das amostras.

## Interações dos formulários — 18/10/2026

Perfil e editor de artigos foram exercitados em amostras interativas isoladas, com ações reais de validação e persistência/transporte bloqueados. Foram corrigidos foco e associação dos erros, perda da seleção de tema após validação e endereço da prévia SEO. Os 268 testes e o build passaram. Consulte `profile-editor-interactions.md` para os cenários e os limites da integração simulada.
