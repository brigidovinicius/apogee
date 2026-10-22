# Google real: publicação e reteste concluídos — 22/10/2026

A correção funcional 512044e foi publicada com a atualização mínima de segurança do Next, no SHA **a4cc461a447260ae335a893765ba8c3ba15fcded**. O deploy e os três fluxos completos no Chrome passaram. Não houve falha de navegação nos 27 cenários verificados nesta rodada.

## Revisão e autorização

- PR [#88](https://github.com/brigidovinicius/apogee/pull/88), integrado em 069e1dbfd52db3194c4fcedbabf8d480ecde1a19. Árvore do merge idêntica à revisão publicada: fbc999556134bcb911dbe61f8e4368050b7eb802.
- [CI 39855751916](https://github.com/brigidovinicius/apogee/actions/runs/39855751916): seis jobs completos aprovados. Site com 488/488 testes, tipos, lint, auditoria de runtime, build Next 16.4.2 e smoke standalone aprovados. Integrações de papéis/RLS, galeria, autenticação, convites, quotas, Caddy/HTTP3 e cobrança aprovadas.
- Uma execução idêntica, 39855751934, mesmo ator/workflow/SHA/instante e ainda sem jobs, foi cancelada como duplicata. A execução completa acima permaneceu obrigatória e passou em todos os seis jobs.
- O CI inicial de 512044e foi bloqueado pelas auditorias de Next 16.3.8. O usuário aprovou expressamente o candidato a4cc461, que acrescenta somente Next/eslint-config-next 16.4.2 e lockfiles nos três pacotes. Não se ignorou a auditoria. A atualização foi verificada nas [notas oficiais](https://github.com/vercel/next.js/releases/tag/v16.4.2) e nos avisos [GHSA-2464-fhr4-w9xw](https://github.com/advisories/GHSA-2464-fhr4-w9xw), [GHSA-p3m5-59mp-jv5r](https://github.com/advisories/GHSA-p3m5-59mp-jv5r) e [GHSA-673q-mjm6-r5xr](https://github.com/advisories/GHSA-673q-mjm6-r5xr).
- O usuário também autorizou o uso de gh como brigidovinicius após o conector recusar criação de PR. O nome antigo apogee-site-interativo e o atual apogee foram confirmados pela API como o mesmo repositório, ID 1398566264.

## Publicação na VPS

Somente web foi reconstruído e recriado pelo runbook, após CI completo. Imagem: `sha256:1c224bad671100ba497821059cbaa1f562029c4a7cfc68d52c5dbd93e70e9942`. Verificação final em 22/10/2026 18:37:58 BRT: checkout limpo em a4cc461, Next 16.4.2 em execução, healthy, zero reinícios e OOMKilled=false. Foram 8.3 minutos observados desde o início do container; isso não é um teste prolongado de memória.

Checksum e modo 600 do .env preservados. Os 24 containers vizinhos inventariados, incluindo parados, mantiveram IDs e imagens. Sem migração, escrita de conteúdo administrativo, alteração de Console Google, DNS, Caddy, certificados, redes ou volumes. O serviço Radar não foi recriado; atualizar seus lockfiles para a validação do repositório não equivale a publicá-lo.

Rollback de código/imagem em 41af1db8c6a5e0b88cd0803f4cede326e9049b3a preservado. Backup existente com checksum e restauração isolada já comprovada conferidos; gzip diário válido. Nenhuma base nova, restauração ou migração foi executada nesta publicação.

## Google real e resultados dos três fluxos

Foram concluídas duas novas sessões Apogee por Google OAuth real, utilizando a sessão Google já existente no Chrome. Antes da entrada do Radar, a ausência de sessão Apogee foi confirmada na área protegida; antes da Administração, foi feito logout explícito. Não se usaram fixture, conta sintética, cookies inseridos artificialmente ou formulário local de senha. As duas janelas abriram separadamente, concluíram e fecharam. Não houve desafio de senha/código nesta rodada.

**Radar:** categoria=competicoes, busca=hackathon e pagina=2 preservadas. Depois de autenticar, Voltar recuperou a origem pública com sua âncora e Avançar restaurou o catálogo autenticado. Recarga e menu público móvel preservaram o destino. A falha anterior não se repetiu.

**Administração:** destino /admin/posts correto. Depois de autenticar, Voltar recuperou a página inicial e Avançar restaurou o Blog. Recarga, marca/Painel, seis destinos do menu móvel, fechamento/foco e histórico entre módulos passaram. A falha anterior não se repetiu.

**Galeria e Make It Fly:** Galeria abriu e recarregou sem sessão em desktop/móvel. A gestão continuou protegida e Voltar recuperou a Galeria pública. Os caminhos entre Galeria/evento e as saídas/retornos da Programação e Experiência passaram, preservando conteúdo, âncora e ponto de saída. Nenhuma foto foi enviada.

## Verificações de navegador

1. Aprovado — Sessão ausente confirmada na área protegida antes do novo login Google.
2. Aprovado — Galeria pública desktop: visitante sem sessão abre e recarrega.
3. Aprovado — Radar: Google real em janela separada, aba original preservada, sessão e destino filtrado confirmados.
4. Aprovado — Radar: Voltar após Google real recupera origem pública com filtros, página e âncora.
5. Aprovado — Radar: Avançar restaura catálogo autenticado e filtros.
6. Aprovado — Radar: recarga mantém sessão, URL e busca.
7. Aprovado — Radar móvel: navegação pública e retorno preservam destino autenticado.
8. Aprovado — Administração: acesso sem sessão preserva Blog como destino.
9. Aprovado — Administração: novo Google real abre Blog e janela de conclusão fecha.
10. Aprovado — Administração: Voltar após Google real recupera página inicial.
11. Aprovado — Administração: Avançar restaura Blog autenticado.
12. Aprovado — Administração: recarga mantém Blog e sessão.
13. Aprovado — Administração: marca abre Painel.
14. Aprovado — Administração móvel: Radar e fechamento do menu.
15. Aprovado — Administração móvel: Blog e fechamento do menu.
16. Aprovado — Administração móvel: Convites e fechamento do menu.
17. Aprovado — Administração móvel: Usuários e fechamento do menu.
18. Aprovado — Administração móvel: Cadastros dos drops e fechamento do menu.
19. Aprovado — Administração móvel: Painel e fechamento do menu.
20. Aprovado — Administração: Voltar/Avançar entre módulos com sessão estabelecida.
21. Aprovado — Galeria pública móvel: abertura e recarga após logout.
22. Aprovado — Gestão da Galeria protegida e Voltar recupera visualização pública.
23. Aprovado — Galeria móvel: menu Make It Fly e retorno público.
24. Aprovado — Make It Fly desktop: Programação, saída, Voltar com conteúdo/posição e Avançar.
25. Aprovado — Make It Fly desktop: Experiência, saída pelo rodapé, Voltar com ponto de saída e Avançar.
26. Aprovado — Make It Fly móvel: Programação direta, saída, Voltar com conteúdo/posição e Avançar.
27. Aprovado — Make It Fly → Galeria pública → Voltar preserva Programação e posição.

## Evidências

15/15 verificações HTTPS anônimas passaram, incluindo páginas públicas, redirecionamentos protegidos e conclusão anônima do Google sem falso sucesso. Registro em public-smoke.json.

browser-results.json contém os 27 cenários. ci-approved.json registra os seis jobs. deploy.log, preflight.json, postflight-initial.json e postflight-final.json comprovam revisão e preservação de infraestrutura. As capturas radar-google-real.png, admin-google-real.png, programacao-restaurada.png e galeria-publica-final.png pertencem à versão publicada.

As observações DOM do Chrome ocasionalmente ficaram desanexadas ou atingiram timeout durante substituições de documento. A aba atual foi reidentificada pelo inventário, e as asserções foram feitas em DOM/URL atuais após a navegação; nenhuma observação transitória foi registrada como falha do site. Não houve reinício de navegador nesta rodada. As conclusões se limitam aos cenários e à janela observados.


Artefatos locais: google-oauth-deploy-20261022/ na pasta de visualizações desta conversa.

Documentação posterior à publicação; não implica novo deploy.
