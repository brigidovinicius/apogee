# Blog e notícias Apogee: direção visual implementada

**Data:** 10/11/2026. **Estado:** etapas visuais e validação local concluídas. Código ainda não enviado nem publicado.

## Base e escopo

PR #130 aberto em `b21af48e3c631bad33a9220aaee1fbc0d3750c19`; main consultada em `9b69ac86ac0b8c025c19dbea847f9d0e9659079e`. Branch isolada `codex/blog-editorial-visual-20261110`, integração local sem conflitos. Alterações concorrentes do worker/admin no checkout original foram preservadas.

CMS, worker, consultas públicas, biblioteca de mídia, slugs, canonical, categorias, filtros e paginação existentes foram reaproveitados. Sem nova dependência, migração, chamada de IA ou escrita no banco. Nenhum push, merge remoto, deploy ou artigo publicado.

## Etapas validadas antes de avançar

1. **Fundação:** GFS Didot Regular local nas manchetes e Inter no corpo/interface. Marinho `#07182D`, branco e azul-claro, restritos a `/blog` e seus artigos. Logo original e navegação reutilizados. Fonte/licença, acentos, TypeScript, lint, carregador real `next/font/local` e navegador aprovados. Peso 400, sem negrito/itálico sintéticos. SHA-256 do TTF: `4fc784ab824e8866eeef8ad55976b93e7e170fb1b8237fd4f8781b5b4dd297f9`. O texto integral da licença foi preservado, com normalização de quebras de linha e espaços finais para Git.
2. **Listagem:** abertura compacta, manchete dominante, chamadas secundárias, filetes e capas proporcionais. Filtros sublinhados e composição adaptada ao acervo real. TypeScript/lint aprovados. Navegador interno: 0/1/3/8 itens de teste; 390/768/1440 px sem overflow; filtros, estado vazio, paginação com 24 itens, capas e modo marinho. Espaçamento das chamadas corrigido e reconferido antes de avançar.
3. **Artigo:** manchete Didot, resumo Inter, autoria/data do CMS, capa/legenda, coluna de até 680 px; corpo de 19 px no desktop e 18 px no celular. Referências HTTPS já reconhecidas pelo pipeline ganham links, usando o mesmo parser do JSON-LD. TypeScript/lint e navegador aprovados: texto longo, capa, ausência de capa, fontes, retorno ao blog, foco de teclado de 3 px e modo marinho.
4. **Compatibilidade:** treze testes de blog/editor, mídia/SEO, autorização do pipeline e regressões novas aprovados. As novas verificam texto escapado/fontes, 404 sem consulta de mídia e preservação de tema/página sem revelar capa de outro artigo. Lint e diff-check aprovados. Revisão independente sem achados P0–P2; um P3 sobre chaves repetidas foi corrigido e revalidado. **Build completo do candidato final aprovado**, com compilação em 27,9 s, TypeScript em 4,7 s e geração das 22 páginas estáticas.

## Método e limites

Leituras locais em Documents e falta de espaço interromperam algumas tentativas. A validação foi concluída numa cópia íntegra em `/private/tmp/apogee-editorial-check-20261110-teo8rppt`, com a mesma árvore-base e os mesmos oito arquivos de aplicação/teste. Eles foram sincronizados de volta à cópia de trabalho com hashes conferidos. A compilação final foi executada quando o espaço voltou a cerca de 5,3 GiB, pela fila global, com um worker e limite de memória.

O navegador interno renderizou as páginas React reais, CSS Modules processados com os plugins do Next e o carregador real de fontes. Consultas foram substituídas por fixtures fictícias locais, identificadas nas capturas. Não foi um teste de ponta a ponta contra o banco/CMS real nem de hidratação dos controles de compartilhar/menu; esses componentes não foram alterados. Vídeos e mídia inline mantêm seus parsers/renderizadores; os testes existentes cobrem a validação de URL de vídeo.

Build: `next build --webpack`, `APOGEE_LOCAL_PREVIEW=1`, um worker, heap máximo de 1536 MiB. Imagem Docker/standalone, CI remoto e validação pública permanecem gates separados.

## Arquivos e continuidade

Arquivos de aplicação/teste: `app/blog/layout.tsx`, `editorial.module.css`, `page.tsx`, `blog.module.css`, `[slug]/page.tsx`, `fonts/GFSDidot-Regular.ttf`, `fonts/OFL-GFSDidot.txt` e `tests/blog-editorial.test.mjs`.

As seis categorias legadas continuam funcionais. As cinco editorias próprias, conteúdo estruturado e aprovação por revisão do PRD 0.3 dependem dos contratos de E1/E2 e não foram simulados pela mudança visual. Tópicos e relacionados permanecem futuros. Esta entrega conclui o escopo visual e não declara concluídos os requisitos de backend de E0/E1/E2.
