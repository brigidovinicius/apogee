# Auditoria dos Fundamentos da Pesquisa Google — Apogee

Data: 11/10/2026. Escopo: toda a estrutura publicada por `https://www.apogee.community`.

Base de trabalho: `200f51aab40d47a37facf76a2f1f1756d808ad66`, revisão que introduziu o sitemap e o robots.txt públicos. Branch local: `fix/google-search-essentials`, diretório isolado `seo-google`. Alterações de ícones e ingestão existentes em outros diretórios foram preservadas.

## Referências usadas

- [Fundamentos da Pesquisa Google](https://developers.google.com/search/docs/essentials?hl=pt-br): conteúdo útil, títulos descritivos, links rastreáveis e controle de indexação.
- [URLs canônicos](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls): consistência entre links, sitemap e canônicos de cada página.
- [Nome do site](https://developers.google.com/search/docs/appearance/site-names): identificação da Apogee com `WebSite` na home.
- [Políticas de dados estruturados](https://developers.google.com/search/docs/appearance/structured-data/sd-policies): representar apenas fatos do conteúdo real.
- [Paginação](https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading): links `<a href>` entre páginas e canônico próprio em cada página.
- [Conteúdo com carregamento adiado](https://developers.google.com/search/docs/crawling-indexing/javascript/lazy-loading): o rastreador deve conseguir descobrir o conteúdo sem depender de cliques.

## Inventário de indexação

| Superfície | Rotas | Tratamento |
| --- | --- | --- |
| Home | `/` | Pública, indexável, canônico próprio e dados `WebSite`/`Organization` |
| Radar público | `/oportunidades` | Pública, indexável; descrição informa que se trata de uma prévia; detalhes continuam protegidos |
| Galeria | `/galeria`, `/galeria?pagina=N` | Pública, fotos no HTML inicial, paginação por links e canônico próprio em cada página |
| Loja | `/loja` | Pública, indexável; descrição informa que a coleção está em desenvolvimento |
| Make It Fly | `/makeitfly` | Pública, indexável; título e descrição descrevem a experiência sem inventar datas |
| Participação | `/makeitfly/participar`, alias `/participar` | Formulário `noindex`; alias mantém o destino existente |
| Prévia de design | `/home-robonauta` | `noindex, nofollow` |
| Autenticação | `/login`, `/membros/entrar`, `/membros/cadastro` | Login redireciona para a entrada; páginas de autenticação herdam `noindex` |
| Membros | `/membros`, `/membros/oportunidades`, `/membros/forum/[categoria]`, `/membros/forum/[categoria]/novo`, `/membros/forum/[categoria]/[topico]`, `/membros/perfil/[username]`, `/membros/perfil/editar` | `noindex` no layout; autorização existente no servidor |
| Administração | `/admin`, `/admin/acesso-negado`, `/admin/curadoria`, `/admin/posts/novo`, `/admin/usuarios`, `/admin/radar`, `/gerenciar-galeria` | `noindex`; controles de acesso existentes preservados |
| APIs | `/api/applications`, `/api/applications-export`, `/api/auth/[...all]`, `/api/checkout`, `/api/gallery`, `/api/gallery/admin`, `/api/journey` | Regra global `X-Robots-Tag: noindex, nofollow` para `/api/:path*` |
| Fotos públicas | `/galeria/fotos/[photo]` | WebP processado no domínio oficial; fotos existentes rastreáveis, ausentes/inválidas 404/noindex |
| Arquivos de descoberta | `/robots.txt`, `/sitemap.xml` | HTTP 200; sitemap lista somente as cinco páginas públicas de entrada |
| Endereços inexistentes | Qualquer rota inexistente; parâmetros inválidos de paginação | Página 404 com links de retorno; `notFound()` e `noindex` para paginação inválida/vazia |

O `robots.txt` continua permitindo rastreamento para que o Google possa ler as diretivas `noindex`. Bloqueio de rastreamento não foi usado como controle de acesso. A autenticação continua sendo aplicada pelo servidor. Páginas subsequentes da galeria são descobertas pelos links de paginação; não são falsamente canonizadas para a página 1.

## Melhorias implementadas

1. Títulos, descrições e canônicos de todas as páginas públicas consistentes com seu conteúdo. Open Graph e Twitter passam a identificar a própria página, em vez de herdar textos genéricos da home.
2. Dados estruturados na home identificam `WebSite` e `Organization` com nome, URL e logo reais. Serialização protege o script contra caracteres HTML. Não foram criadas avaliações, ofertas, preços, datas de evento ou perfis sociais fictícios.
3. Galeria entrega a página inicial de fotos públicas no HTML do servidor. O hook reaproveita os dados, evitando a requisição duplicada após a hidratação. Se o armazenamento estiver indisponível, a introdução real continua disponível e o cliente pode tentar carregar as fotos.
4. Paginação da galeria usa URLs próprias (`?pagina=N`) e links anterior/próxima página. Parâmetros negativos, duplicados, fracionários, com zeros à esquerda ou fora do limite são rejeitados. Páginas vazias subsequentes usam `notFound()`.
5. A leitura da galeria durante a renderização não modifica armazenamento. Somente o DTO público validado é serializado; testes verificam ausência de operações DELETE e de campos extras no HTML recebido pelo cliente. A correção PostgreSQL posterior estende essa garantia a todas as leituras.
6. Fotos exibem largura e altura reais, `loading="lazy"` e `decoding="async"`. As imagens do rodapé interno receberam `sizes` correspondente ao tamanho exibido, evitando variantes de 3840 px para um logo de 256 px.
7. APIs passam a emitir `noindex`; a página 404 oferece retorno à comunidade e à galeria.
8. `npm run seo:verify -- ORIGIN` permite repetir a validação HTTP após publicação. O comando padrão aponta para `http://127.0.0.1:3107`; os canônicos verificados sempre apontam para o domínio oficial.

## Validação local

- Dependências instaladas pelo lockfile, sem compartilhamento de `node_modules` ou `.next` de outra tarefa. Next.js 16.3.8.
- `npm test`: 225 testes passaram, sem falhas. Inclui regressões de acesso, uploads, anonimato, preservação visual, leitura pública sem limpeza e SEO.
- `npm run build`: compilação de produção e TypeScript passaram; todas as rotas acima constam no mapa gerado.
- `npm run lint`: zero erros; um aviso preexistente de `<img>` na administração da galeria, que não é indexável.
- `npm run seo:verify`: passou contra o build local. Conferiu as cinco páginas públicas, títulos únicos, descrições, canônicos, metadados sociais, idioma, presença de alt, dados estruturados, `noindex` de membros/formulários/prévia/administração, cabeçalhos de API, 404, sitemap e robots.
- Galeria com fotos e paginação foi exercitada com fixtures de dados públicos; a validação HTTP local usa o estado sem credenciais e não acessa armazenamento remoto. Sem alterações em `.env`, banco, DNS ou Caddy.
- As páginas locais que inicializam autenticação registraram erros de renderização pela ausência da configuração de membros, incluindo HTTP 500 em `/gerenciar-galeria`; nelas foi verificada apenas a exclusão de indexação, incluindo as declarações dos layouts, sem validar o funcionamento de login/cadastro. Algumas respostas em streaming mantêm HTTP 200 apesar do erro interno, por isso o código HTTP não prova funcionamento. A API pública da galeria retornou 503 pelo armazenamento não configurado. O verificador informa respostas 5xx em origem local e as rejeita em origem publicada. Os fluxos reais exigem nova conferência no domínio após o deploy autorizado.

## Evidências públicas e limites

- A propriedade de domínio está verificada por DNS e a inspeção da home informa que a página está indexada.
- O sitemap publicado responde HTTP 200, `application/xml`, 413 bytes, XML válido com cinco URLs. `robots.txt` aponta para ele.
- DNS público do Google retorna o mesmo A para domínio raiz e `www`, sem AAAA publicado; o TXT de verificação está presente. Identificação de Googlebot simulada também recebe o mesmo XML, mas não substitui uma requisição real do Google.
- O teste em tempo real do Search Console para o sitemap, em 11/10/2026 às 15:27, informou **“O URL está disponível para o Google”**. O primeiro envio informou **“Não foi possível ler o sitemap”**. Após uma nova submissão, a confirmação **“Sitemap enviado”** foi exibida e a tabela passou para **“Processado”**, com **5 páginas encontradas**, última leitura em 11/10/2026 e zero vídeos. A pendência de envio/leitura está resolvida; isso não equivale à indexação de todas as cinco páginas.
- PageSpeed Insights recusou a consulta pela quota diária da API. A tentativa alternativa pela interface criou o [relatório da home](https://pagespeed.web.dev/analysis/https-www-apogee-community/sffbdpdd5r?form_factor=mobile), às 15:34:57, mas permaneceu carregando o diagnóstico nas abas celular e computador, sem entregar notas. A seção de experiência de usuários exibiu “Nenhum dado”. Não há nota atual de desempenho nem certificação de Core Web Vitals. A medição mobile/desktop das cinco páginas e os dados de usuários reais devem ser conferidos após publicação.
- A atualização de ícones foi reconciliada antes do deploy. O PNG da Apogee publicado pela tarefa de favicon foi preservado e confirmado nas cinco páginas públicas.
- Moderação de conteúdo enviado pela comunidade, atualização de informações de eventos e divulgação legítima exigem manutenção contínua. A conformidade técnica não garante posições, rich results ou indexação de todas as páginas.

## Publicação de SEO concluída

- Push e deploy foram explicitamente autorizados pelo usuário. [PR 19](https://github.com/brigidovinicius/apogee/pull/19) integrada; revisão testada `244f0aad4b11aade4ed9512710a1460ca83fdd28`, CI [38165094585](https://github.com/brigidovinicius/apogee/actions/runs/38165094585) concluída com sucesso nos três projetos. Site: 225 testes, typegen/typecheck/lint/auditoria/build/smoke aprovados; auditoria runtime sem vulnerabilidades.
- SHA publicado por SSH: `294b3cb863264878a1bdc76fe79fe9d455fd2089`. O subtree `make-it-fly-current` coincide com a revisão testada; a árvore completa inclui integração de Radar feita em outra tarefa e não é idêntica.
- Imagem confirmada: `sha256:1a2e634a0253cdb2c9bdad603253f0511bac67fac399bc642f612f37c010ade2`; container saudável, zero reinícios. Rollback `aaae5bcaac0fb4b68317cd3af50bb42059611055` preservado. Checkout remoto limpo e configuração protegida em modo 600.
- As cinco páginas públicas passaram em título, descrição, canônico, OG/Twitter, idioma, conteúdo semântico, headers e ícone. Oito superfícies excluídas e 11 rotas protegidas foram validadas; 42 recursos internos e redirecionamento HTTP/domínio raiz → HTTPS www passaram.
- A validação estrita encontrou `/api/gallery` em 503 e parou corretamente. As demais verificações foram executadas com o bloqueio explicitamente registrado. A indisponibilidade veio de configuração Supabase legada anterior ao deploy; não é declarada validação completa da galeria nesse SHA.
- O usuário autorizou corrigir a galeria e exigiu PostgreSQL direto na VPS. A solução está registrada em [Correção da galeria](gallery-postgres-repair.md), com migração aditiva, backup e CI PostgreSQL descartável. A correção foi publicada e a validação estrita passou; detalhes abaixo.

## Search Console — conferência após SEO

- Propriedade de domínio verificada por DNS. Sitemap **Processado**, cinco páginas encontradas, zero vídeos; última leitura em 11/10/2026.
- Home já indexada. Teste em tempo real de 11/10/2026 às 15:57: **URL disponível para o Google**, página pode ser indexada.
- `/oportunidades`: detectada, ainda não indexada; teste real às 16:02 aprovou disponibilidade/indexabilidade. Pedido aceito: **Indexação solicitada**.
- `/loja`: detectada, ainda não indexada; teste real às 16:12 aprovou disponibilidade/indexabilidade. Pedido aceito: **Indexação solicitada**.
- `/makeitfly`: detectada, ainda não indexada; teste real às 16:16 aprovou disponibilidade/indexabilidade. Pedido aceito: **Indexação solicitada**. A galeria foi conferida após o deploy PostgreSQL, conforme registro final.
- Ações manuais e problemas de segurança: **Nenhum problema foi detectado** nos dois relatórios. Relatório de páginas ainda em processamento. Core Web Vitals sem dados de uso suficientes nos 90 dias informados pela interface, tanto celular quanto computador.

Pedidos aceitos são fila de rastreamento, não prova de indexação imediata. Dados de usuários reais e PageSpeed continuam sem medição concluída; não há alegação de nota ou conformidade total de desempenho.

## Validação final — galeria PostgreSQL publicada

- PR 21 e CI 38167703754 aprovadas. Produção no SHA `7741a7199a0780f8850a1cbeb8c3b4b4f638e4c2`, preservando as melhorias SEO, os ícones e a ponte administrativa da PR 20.
- `npm run seo:verify -- https://www.apogee.community`: **passou**, incluindo `/api/gallery` HTTP 200. Cinco páginas públicas com metadados/canônicos próprios; controles de indexação, 404, sitemap e robots validados.
- Varredura complementar: **passou**, com conteúdo semântico das cinco páginas, oito superfícies excluídas, 12 rotas protegidas (inclui `/admin/radar`), sete famílias de API, 40 recursos internos e convergência HTTPS www.
- A galeria foi conferida no Safari e responde com estado vazio legítimo. API retorna `photos: []`, `nextOffset: null`; banco PostgreSQL tem zero fotos. Não foram inseridas fotos fictícias ou importados arquivos antigos. Não se declara validação de fotos reais/páginas subsequentes em produção; esses fluxos foram testados com fixtures e PostgreSQL descartável.
- Teste real do Search Console para `/galeria`, 11/10/2026 às 16:56: **URL disponível para o Google**, **É possível indexar a página**. Pedido aceito: **Indexação solicitada**.
- Relatório de desempenho permanece sem medição concluída. A aprovação técnica e os pedidos de indexação não garantem ranking ou inclusão de cada URL no índice.
