# Deploy das correções de navegação — 21/10/2026

Publicado em https://www.apogee.community/ após autorização explícita do usuário.

- PR #87 integrado: https://github.com/brigidovinicius/apogee/pull/87
- CI completo, seis jobs aprovados: https://github.com/brigidovinicius/apogee/actions/runs/39702130219
- Site: **478/478 testes**, tipos, lint, auditoria runtime, build e smoke standalone aprovados. Integrações de permissões, galeria, autenticação, proxy, cobrança e drops aprovadas.
- SHA publicado: `41af1db8c6a5e0b88cd0803f4cede326e9049b3a`, árvore idêntica ao head validado `acb09e64ce8885298a825229bd4ffc076817fdef`.
- A main foi integrada antes da publicação para preservar APG-84 (HTTP/3) e APG-85 (primeiro detalhe gratuito do Radar). Os conflitos foram resolvidos mantendo os destinos filtrados e a autorização vigente dos detalhes.
- Rollback de código/imagem: `7429096ddadc33bd5d3c7496960f5a8a9234a153`, preservado.

Preflight: SSH `root@srv1439756`, checkout limpo, web anterior saudável, `.env` modo 600, capacidade disponível. Backup existente com checksum e contagens da restauração conferidos; gzip do backup diário mais recente válido. Não foi criada ou restaurada nenhuma base nesta publicação.

Somente web foi compilado e recriado. A conferência final, em `2026-10-22T01:08:18Z`, confirmou revisão correta, **healthy**, **0 reinícios**, `OOMKilled=false`, cerca de 433 MiB de memória naquele instante e checkout limpo. `.env` manteve seu checksum; os 12 containers vizinhos mantiveram IDs e imagens. Sem migrações, mudanças de banco, DNS, Caddy, certificados, redes ou volumes.

**14 verificações HTTPS anônimas passaram**: nove páginas públicas retornaram 200 e cinco rotas protegidas retornaram 307 ao login preservando `next`.

**23 verificações no navegador passaram**, com sessão administrativa real já existente, em desktop e celular: Radar com filtros e histórico, administração com seis destinos e fechamento/foco do menu, galeria com retorno em um passo e saídas pública/painel, recarregamento e restauração da Programação/Experiência no Make It Fly. A conferência do menu considera somente o elemento de navegação; detalhes editoriais abertos no catálogo não são o menu. Nenhuma alteração de conteúdo ou formulário de cadastro, compra, upload ou envio foi submetido.

Limites: não foi feito novo login de senha/OAuth em produção. O ciclo com credenciais reais foi validado no preview isolado e pelo CI; em produção usou-se a sessão real existente. A ausência de reinícios corresponde à janela observada, não a um teste prolongado de vazamento de memória. O preview local permanece aberto na revisão isolada anterior, como evidência de testes, e não é a origem do tráfego público.

Evidências locais: `navigation-deploy-20261021/release.json`, `ci.json`, `public-smoke.json`, `browser-results.json`, `deploy.log` e `home-production.png` na pasta de artefatos desta conversa. Registro remoto: `/opt/apogee-site/releases/navigation-20261021/release.md`.

Esta documentação é posterior à publicação; sua atualização não implica novo deploy.
