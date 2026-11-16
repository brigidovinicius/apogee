# Benefícios — validação do candidato local

Base conferida: `419bfbeabf097533f629577e9b539d04dfadd14a`. Branch local: `feat/member-benefits-20261116`. Implementação e dados de revisão permanecem locais, antes de publicação.

## Resultado

- 813 testes gerais aprovados, sem falhas.
- 25 testes com PostgreSQL nativo aprovados: 12 da nova área e 13 das entregas existentes. Cobrem acesso anual/admin, bloqueios, revogação durante a transação, salvos e resgates concorrentes sem duplicação, titularidade, conferência com evidência privada, revisão obsoleta e preservação do histórico.
- TypeScript aprovado após o ajuste de reabertura de resgates.
- Lint sem erros. Um aviso preexistente em `components/gallery/gallery-admin.tsx:87` sobre `img` foi preservado.
- Build Next.js concluído. Como as dependências locais são reutilizadas por symlink, o empacotamento standalone avisou sobre 27 arquivos externos à raiz de tracing. O candidato de publicação deverá usar a instalação normal de dependências e repetir o build/CI; esta saída local não é uma imagem de release.
- 26 verificações HTTP reais aprovadas contra `127.0.0.1:3486`, com sessões fictícias: entrada/saída, proteção após sair, quatro rotas bloqueadas para gratuito sem catálogo privado, catálogo de três ofertas sintéticas para anual/admin, busca sem acento, categoria, salvos/histórico inicialmente vazios, detalhe e rascunho inacessível. A administração recebe as candidatas em rascunho.
- `git diff --check` sem problemas de whitespace.

As verificações HTTP foram complementadas posteriormente pela revisão interativa descrita abaixo. Na etapa inicial, o controle Browser estava indisponível; os resultados de integração com banco e HTTP acima pertencem ao candidato inicial `55e6a7a`.

Em páginas já transmitidas pelo Next, `notFound()` pode manter status HTTP 200. O teste de acesso direto ao rascunho confirmou o fallback 404 do framework e a ausência do nome e de controles da oferta privada.

## Evidências locais

Logs fora do Git em `outputs/beneficios-implementacao-20261116/`, ao lado do worktree: `unit.log`, `integration.log`, `typecheck.log`, `lint.log`, `build.log`, `http-review.json` e `browser-review.json`. O catálogo comercial privado também permanece fora do repositório.

O banco de revisão contém três ofertas fictícias publicadas, um rascunho fictício e seis candidatas reais em rascunho. Não houve publicação de oferta comercial, migração real, envio de mensagem a parceiro ou consumo de serviço pago.

O roteiro e as contas fictícias estão em [benefits-workspace-runbook-20261116.md](benefits-workspace-runbook-20261116.md). A inspeção visual do proprietário antecede qualquer pedido de publicação.

## Revisão interativa no navegador interno

36 verificações passaram pela interface real da prévia, com contas fictícias e banco isolado:

- Busca `video` sem acento, resultado vazio, limpeza de filtros e as três categorias disponíveis.
- Salvar, remover, salvar novamente, contador e lista, persistência ao recarregar e ao trocar de conta. Busca e categoria combinadas também foram conferidas dentro de Salvos.
- Iniciar resgate, persistir no histórico, reabrir sem duplicar, confirmar administrativamente com referência privada e preservar o resultado ao reabrir. O titular recebeu o estado Confirmado sem a referência privada.
- Saída pelo menu e entrada nas contas anual, gratuita, renovação cancelada ainda vigente e administração. A segunda conta elegível não herdou salvos ou histórico da primeira.
- Conta gratuita bloqueada nas quatro rotas: catálogo, salvos, histórico e detalhe por ID. O DOM mostrou `blur(5px)`, atributo `inert` e zero controles no conteúdo borrado, sem nomes ou registros privados.
- Seis candidatas comerciais permaneceram em rascunho. Nenhuma ação foi feita em oferta real.
- A largura atual do navegador era 498 px, sem overflow horizontal. Não houve alteração de viewport; outros tamanhos e temas não foram reavaliados nesta rodada.

Uma orientação textual foi corrigida: o início do resgate dizia “Siga as instruções abaixo”, mas as instruções estão acima do botão. Agora diz “Siga as instruções da oferta”, conferido em um novo pedido fictício. Nenhuma falha funcional foi encontrada nos demais fluxos solicitados. A alteração de código desta rodada é somente essa mensagem, validada na própria prévia; não foi necessário repetir build ou testes pesados.

Estado deixado para revisão: conta `revisaoanual@example.test`, uma oferta salva e dois pedidos fictícios (um Iniciado e outro Confirmado). As contas, abas, banco e serviços de produção foram preservados. A prévia continua local e não houve push, publicação ou ativação de parceria.
