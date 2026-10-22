# APG-89 — Retorno do detalhe do Radar

O título grande do detalhe interceptava o clique de “Voltar ao Radar” em desktop. A reprodução em produção retornou H1 no hit-test do centro do link. O cabeçalho da rota agora separa o retorno e o título em grid, com intervalo de 1.5rem e área de clique mínima de 2.75rem. O CSS é exclusivo da rota; tipografia, href e regras de acesso permanecem iguais. Os estados de pré-abertura gratuita e detalhe completo usam o mesmo cabeçalho.

Validação local: 12/12 testes de radar-detail-access e navigation-return, build Next 16.4.2, typecheck, lint do arquivo alterado e git diff --check passaram. No Chrome, 33/33 verificações passaram em preview compilado com BetterAuth/PostgreSQL isolados: mesmo título longo aplicado temporariamente à oportunidade sintética, cinco pontos clicáveis, clique, Enter, entrada direta, recarga e Voltar/Avançar em desktop padrão/1024/768/390/320 px; Galeria pública e proteção do detalhe após logout. Título sintético original restaurado. Google OAuth não foi exercitado nesta rodada.

O preview precisou da migração 0007 apenas no banco isolado, após backup e conferência do histórico. Nenhuma migração ou escrita em produção. Preview compilado reaberto; sem push ou deploy. A correção ainda não está publicada.

Issue: https://linear.app/vinicusspace/issue/APG-89/corrigir-titulo-sobreposto-ao-link-voltar-ao-radar-no-desktop
Artefatos locais desta conversa: apg-89-retorno-radar/relatorio.md, browser-results.json, antes-producao.json, capturas desktop/móvel e logs.
