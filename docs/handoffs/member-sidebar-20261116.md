# Área de membros: navegação lateral e blog integrado

Base: 28d60da. Branch: fix/member-sidebar-20261116. PR #189. Publicação autorizada em 16/11/2026; aguardando a CI final e o deploy.

## Resultado

Layout comum com menu lateral, versão recolhível para celular, identidade e saída, links secundários em Sua conta e cabeçalho/rodapé compactos. Blog acessível por /membros/blog e /membros/blog/[slug], mantendo categorias, paginação, artigos, canonical e URLs públicas. Calendário e coleções levam ao detalhe interno do Radar. Introduções e suporte foram reduzidos, preservando regras de acesso e estado real dos entregáveis.

## Validação em 16/11/2026

Todos os comandos pesados executados sequencialmente pela fila global npm-queue.py, NODE_OPTIONS=--max-old-space-size=2048.

- node --test --test-concurrency=1 tests/*.test.mjs: 811 passaram, zero falhas/skip.
- node node_modules/eslint/bin/eslint.js: zero erros; aviso preexistente gallery-admin.tsx:87 sobre img.
- APOGEE_LOCAL_PREVIEW=1 NEXT_TELEMETRY_DISABLED=1 node node_modules/next/dist/bin/next build --webpack: passou, incluindo TypeScript e geração de rotas.
- git diff --check: passou.

Navegador com autenticação real e PostgreSQL sintético local: login anual e gratuito, logout e retorno ao login, atividade concluída/persistida/reaberta, benefícios vazios e acesso restrito, ferramentas e filtro, Blog com tema/página/artigo/retorno/rascunho indisponível, Radar com busca e salvar, agenda e filtro salvo, coleção criada/evento adicionado/detalhe interno, tópico criado e perfil editado. Menu desktop e celular 390x844; Esc e recolhimento ao navegar; Home/Blog sem overflow horizontal.

Testes em produção foram de leitura com a sessão existente. Nenhum registro real, pagamento, permissão externa ou email foi alterado/enviado. Google Agenda/OAuth e pagamentos reais não foram executados na prévia. Trilha parcial e benefícios sem parceiros confirmados continuam identificados como tal.

## Retomada

A cópia validada está em /private/tmp/apogee-member-sidebar-20261116. A cópia em Documents sofreu leituras bloqueadas pelo iCloud, portanto usar uma pasta realmente local para novos builds. O script scripts/local-offer-review.mjs cria banco isolado e aceita APOGEE_REVIEW_DURATION_SECONDS=900, encerrando normalmente depois. Preservar a fila global e não interromper servidores de outros chats.

A publicação foi autorizada pelo proprietário após a revisão. Revalidar produção/main e trabalhos concorrentes antes de integrar; não substituir checkout nem copiar arquivos manualmente para o servidor. O patch não inclui mudanças de banco, pagamentos, Home pública ou evento.

## Acesso administrativo solicitado após a revisão

O proprietário pediu visualização completa com a conta administrativa, sem explicações de permissões no front. Trilha e benefícios agora autorizam o papel administrativo atual além da assinatura anual; o estado financeiro permanece independente. A verificação da conta continua obrigatória. O progresso é privado por usuário e revalida papel e bloqueio na transação. Revogação e bloqueio invalidam a operação mesmo com uma autorização anterior. Rascunhos, acordos internos e ofertas expiradas continuam fora das telas de membros.

Os 13 testes de integração de entregáveis passaram, incluindo administrador sem assinatura, conta bloqueada, papel revogado, isolamento de progresso e regras dos membros comuns. A caixa de ferramentas já autorizava administradores; o aviso de prévia foi removido. O menu administrativo aparece compacto na área de membros, e a Home não mostra bloqueios de assinatura para administradores.
