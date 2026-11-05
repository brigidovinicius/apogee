# Radar: equivalência da URL institucional na descoberta

## Problema confirmado após a implantação

A versão `b10d3523f96cf5738ec9b7204501f2a6a8c7a3ae` foi implantada em 03/11/2026 às 12h20, horário de Brasília, pela PR #119 e CI 41660273213. Às 13h47, os três serviços permaneciam saudáveis/em execução, com zero reinícios; 23 contêineres alheios, configuração e decisões administrativas foram preservados. Foram observadas 296 avaliações em 13 ciclos, 19–24 links por ciclo. Os pendentes passaram de 1.462 para 1.240, mas não houve nova fonte ou oportunidade publicada; o catálogo público permaneceu com 1.036 itens.

A amostra das retenções revelou monitores cuja URL verificada era uma origem sem barra final, por exemplo `https://noticias.ufsc.br`. O navegador e `URL.href` representam o mesmo documento como `https://noticias.ufsc.br/`. A comparação literal do caminho da descoberta rejeitava links da própria origem. O checkpoint também rejeitava seu próprio endereço inicial não serializado e reiniciava os primeiros 30 links a cada ciclo.

Isso é um erro de equivalência de endereço; não comprova que os candidatos afetados sejam atuais, relevantes ou publicáveis. A maioria das demais retenções ainda precisa ser interpretada individualmente, incluindo notícias antigas, navegação, PDFs sem adaptador e plataformas sem autoria correspondente.

Às 13h53, a consulta somente leitura encontrou 16 links bloqueados da própria origem com o caminho inicial sem barra: FAPESC, OBI/Unicamp, OBMEP e UFSC. Esse é o alcance confirmado da condição, sem contabilizar links externos ou presumir quantas fichas seriam publicadas.

## Alteração

- Serializar URLs dos documentos do caminho e da raiz do checkpoint usando `URL.href`. A URL institucional armazenada e sua verificação continuam intactas.
- Reconsultar todos os elos e a página individual, mantendo origem/escopo, HTTPS, query, autoria, prazo, inscrição, evidência, limites e transação de cadastro/publicação.
- A auditoria mantém a URL original do monitor e os hashes dos documentos consultados; o caminho de prova usa a representação serializada.
- Versão 4 de processamento permite reavaliar uma vez bloqueios compatíveis das versões anteriores. Mantém o máximo de quatro tentativas, exclusões, fontes pausadas, decisões administrativas, orçamento e alternância de alvos. Não reinicia contadores ou altera registros em produção manualmente.
- Um checkpoint antigo contendo URLs não serializadas pode reiniciar uma vez; os próximos ciclos preservam a continuação. Isso não exclui links ou oportunidades.

## Validação

Antes da correção, três regressões falharam: continuidade além de 30 links, publicação com caminho legado sem barra e publicação com caminho vazio. Após a correção, o fluxo usa a raiz normalizada, preserva o cadastro verificado e publica atomicamente uma oportunidade sintética válida. URLs de outra autoridade, outro documento/query ou HTTP continuam bloqueadas antes do acesso.

Validação final do Radar, sequencial pela fila global: `npm run test` com 588 aprovados e 34 condicionados/ignorados, zero falhas; `npm run lint`, `npm run typegen`, `npm run typecheck` e `npm run build` aprovados. O site não foi alterado neste complemento. Logs privados em `.local/origin-slash-*.log` e resultados em `.local/origin-slash-validation.json`.

Esta correção adicional é um novo candidato local. Não integra a imagem `b10d352` já implantada. CI, publicação e deploy do novo SHA são gates separados; não declarar a mudança ativa até verificar a revisão em produção.
