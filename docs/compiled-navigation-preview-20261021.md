# Preview de navegação compilado — 21/10/2026

O preview `next dev --webpack` reiniciava no limiar de 80% do heap V8 durante compilações, interrompendo a navegação. O executor local agora compila separadamente e serve com `next start`, sem compilador/HMR durante os testes. Não houve deploy.

`APOGEE_LOCAL_PREVIEW=1` habilita um perfil local: build com um worker e otimizações de memória; servidor com 768 MB de old space e build com 2 GB. Esse perfil usa o output normal do Next para `next start`; a configuração normal de deploy continua standalone quando a flag não está ativa. O limiar do Next dev não foi alterado.

O executor versionado é `make-it-fly-current/scripts/navigation-preview.mjs`. Execute, sempre pela fila global e sem outro preview ativo:

```text
npm-queue.py --command node scripts/navigation-preview.mjs build /caminho/privado/private-config.json
npm-queue.py --command node scripts/navigation-preview.mjs serve /caminho/privado/private-config.json /caminho/privado/runtime-memory.jsonl
```

A configuração privada existente não é copiada para o repositório. O executor valida a origem exata `http://127.0.0.1:4381`, o PostgreSQL isolado em `127.0.0.1:55439/apogee_navigation` e o catálogo sintético em `127.0.0.1:4382/catalogue`. Outros destinos são recusados. A porta 4381 tem um proxy somente loopback, que sobrescreve cabeçalhos de identidade antes do Next privado na porta 4383. Senhas, sessões, papel administrativo e cotas usam o backend real; e-mail, cobrança e OAuth Google ficam desativados.

O código compilado admite HTTP somente para a origem exata acima e a flag explícita de preview. A validação normal de HTTPS de produção continua ativa. O `local-run.mjs` já existente no runtime isolado foi atualizado como entrada compatível: `--build` compila; sem opção, serve. Alterações futuras exigem recompilar o preview.

O build compilado revelou uma falha no atalho do Radar ao partir de uma URL já ancorada. `SkipLink` agora substitui o fragmento pela History API integrada ao Next e move o foco ao conteúdo, preservando Voltar/Avançar. O caso foi observado falhando antes e passando depois. Testes existentes preservam estrutura visual, fontes, CSS e assets.

Validação final: build, 471/471 testes, typecheck, lint do escopo e `git diff --check` passaram. Os três fluxos foram repetidos diretamente no navegador com BetterAuth/PostgreSQL reais, contas sintéticas, desktop/mobile: 41 verificações passaram. Nenhum reinício nem compilação de desenvolvimento ocorreu na janela final. As amostras iniciais registraram 205 segundos com o mesmo PID, pico de RSS do servidor de 162,2 MiB e heap usado de 68,3 MiB. Métricas são amostradas a cada 5 segundos e não são um teste de vazamento de longa duração.

Artefatos desta conversa: `memory-stable-preview-20261021/relatorio.md`, `memory-summary.json`, `runtime-memory.jsonl`, `browser-results.json`, logs de build/testes e provas sanitizadas de backend/código. Sem push, deploy, migração ou alterações em produção. O preview foi deixado ativo na porta 4381.
