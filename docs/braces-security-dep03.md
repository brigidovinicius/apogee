# DEP-03 — limite de profundidade em braces

Data: 20/10/2026. Base: `5f9f9f4`. Branch: `fix/braces-depth-dep03`.
Status: proteção local validada; aviso upstream ainda aberto. Sem push, CI remoto, Docker ou deploy.

## Decisão e alcance

O [aviso GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) continua sinalizando `braces <=3.0.3`, sem versão corrigida. O registro oficial npm também oferece 3.0.3 como última versão. O [relato upstream e a discussão do mantenedor](https://github.com/micromatch/braces/issues/70) discordam quanto ao alcance da ameaça; nesta tarefa, entradas sintéticas abaixo de 10.000 caracteres reproduziram `RangeError: Maximum call stack size exceeded` na biblioteca instalada.

As três aplicações alcançam a biblioteca pela cadeia `eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`; raiz e site também a alcançam pelas ferramentas `shadcn`. A busca nos diretórios de código das aplicações não encontrou uso direto dessas bibliotecas em handlers públicos. A reprodução comprova o comportamento da dependência, sem demonstrar um ataque em produção.

Adotamos uma cópia local de 3.0.3 com limite de profundidade, preservando nome, versão, licença MIT e a dependência `fill-range`. Isso não constitui uma versão corrigida publicada pelo mantenedor. A versão do framework e as versões dos demais pacotes permanecem intactas.

## Arquivos e alterações

Os caminhos são relativos à raiz deste checkout. Os dois diretórios de vendor possuem conteúdo idêntico para permitir instalações e contextos Docker independentes.

| Arquivo/trecho | Alteração |
|---|---|
| `make-it-fly-current/vendor/braces/lib/depth.js` e equivalente no Radar | Limite fixo de 128 níveis; lança `SyntaxError` com código `BRACES_DEPTH_LIMIT`; opções do chamador não aumentam o limite |
| `vendor/braces/lib/parse.js`, nos dois projetos | Verifica a profundidade antes de adicionar blocos de chaves ou parênteses à pilha do parser |
| `vendor/braces/lib/compile.js`, nos dois projetos | Conta nós com filhos no percurso recursivo e valida antes de processar o nó |
| `vendor/braces/lib/expand.js`, nos dois projetos | Verifica a profundidade em cada chamada recursiva do percurso de expansão |
| `vendor/braces/lib/stringify.js`, nos dois projetos | Aplica o limite também à serialização e a ASTs fornecidas diretamente |
| `vendor/braces/index.js`, `lib/constants.js`, `lib/utils.js`, `LICENSE` | Cópias sem alteração do tarball oficial, com licença preservada |
| `vendor/braces/package.json` | Metadados mínimos com nome/versão/dependência originais; omite ferramentas de desenvolvimento upstream |
| `vendor/braces/PROVENANCE.json` | Integridade SHA-512 do tarball e hashes SHA-256 dos arquivos originais/locais |
| `vendor/braces/DEP03.patch` | Diff exato dos quatro arquivos existentes alterados; o novo guard é `lib/depth.js` |
| `vendor/braces/SECURITY.md` | Proveniência, política e limites da correção local |
| Três `package.json` | Dependência de desenvolvimento local e override `braces: "$braces"`; raiz reutiliza o vendor do site; DEP-01 e DEP-02 preservados |
| Três `package-lock.json` | Apenas registro raiz, nó/link de `braces` e novo registro do vendor mudaram; demais registros de pacotes idênticos à base |
| `make-it-fly-current/Dockerfile`, `radar-academico/Dockerfile` | Copia vendor antes de `npm ci`; nenhuma imagem foi construída ou publicada |
| `make-it-fly-current/eslint.config.mjs`, `radar-academico/eslint.config.mjs` | Exclui a cópia de terceiro do lint da aplicação; a proteção é exercitada pelos testes comportamentais |
| `scripts/braces-depth-regressions.mjs` | Resolve a biblioteca consumida por `fast-glob`/`micromatch`; 17 cenários compartilhados |
| `tests/braces-depth-security.test.mjs` e equivalente no site | Incluem cenários na suíte Node existente |
| `radar-academico/src/__tests__/braces-depth-security.test.ts` | Inclui os mesmos cenários na suíte Vitest existente |

O tarball oficial foi obtido com `npm pack braces@3.0.3 --ignore-scripts`, e seu SHA-512 foi comparado ao registro antes da cópia. Os quatro percursos modificados estão no patch; a normalização da última linha de `stringify.js` também está registrada. Não foi usado `npm audit fix`, pacote de terceiros alternativo, hook de pós-instalação ou atualização do framework.

## Evidências locais

- Antes: **14 falhas e 3 sucessos** nos 17 cenários com a biblioteca original. Os testes diferenciam estouro da pilha/ausência de limite do erro controlado desejado.
- Depois: 17 cenários direcionados passaram na raiz instalada com `npm ci --ignore-scripts`. Suítes completas: **35 testes na raiz, 395 no site e 278 no Radar**, sem falhas. O Radar tem **15 testes ignorados** de integração PostgreSQL, sem as credenciais de ambiente requeridas; eles não são contados como aprovados.
- Cobertura da regressão: chaves e parênteses com 4.500 níveis, caminhos padrão/parse/compile/expand/stringify, ASTs diretas, limite 128/129, literais escapados e entre aspas, alternativas, intervalos numéricos e busca de arquivos reais em fixture temporária própria.
- `npm ci --ignore-scripts --no-audit --no-fund` passou nas três árvores. Uma instalação mínima em `/private/tmp`, fora dos checkouts, também passou; confirmou `fill-range` local, expansão compatível via `micromatch` e rejeição controlada do padrão profundo.
- Tipos e lint passaram nos três projetos. O site conserva um aviso preexistente de `<img>` em `components/gallery/gallery-admin.tsx:81`. A raiz e o Radar não tiveram avisos de lint.
- A instalação do Radar sob o Node padrão 20 avisou que `pdfjs-dist` exige Node >=22.13. A suíte passou também sob Node 20, mas foi repetida sob o Node 22.23.2 já instalado, com o mesmo resultado; tipos e lint do Radar usaram Node 22. A configuração global de Node não foi alterada.
- Os três builds standalone e os três smokes HTTP passaram. Os smokes usam configuração sintética e loopback, sem serviços de produção. Evidências: [validation.json](evidence/security-dep03/validation.json).

Todas as operações de projeto usam a fila global `npm-queue.py --command`, sequencialmente. O workflow de segurança existente já executa as três suítes e instalações independentes; nenhum CI remoto foi disparado.

## Auditoria final

| Aplicação | Críticas | Altas | Médias | Total completo | Total com `--omit=dev` |
|---|---:|---:|---:|---:|---:|
| Raiz | 0 | 10 | 3 | 13 | 0 |
| Site | 0 | 10 | 7 | 17 | 0 |
| Radar | 0 | 5 | 1 | 6 | 0 |

O aviso de braces continua presente nas três respostas, porque a versão continua 3.0.3. Não houve supressão do aviso. Auditorias completas retornaram código 1; as de produção, 0. A comprovação da proteção está na resolução local e na regressão comportamental.

As respostas passaram a incluir avisos do SDK MCP, Hono e Vite/launch-editor ausentes na consulta anterior. A base reconstruída da raiz retornou nove altas, e a consulta posterior retornou dez ao incluir o SDK; nenhum registro ou versão desse pacote mudou. Portanto, esse aumento não pode ser atribuído à alteração de braces. As consultas não formam um snapshot atômico do registro npm. Os novos IDs foram registrados como DEP-07 a DEP-09 no [inventário](security-remediation-status.md), sem correções adicionais nesta tarefa. O identificador original do DEP-02 continua ausente.

## Comandos de validação

Todos os comandos de projeto foram prefixados por `/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command`.

```sh
npm ci --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm test
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build
node scripts/security-smoke.mjs . # raiz; caminhos relativos equivalentes no site/Radar
npm audit --package-lock-only --json --registry=https://registry.npmjs.org
npm audit --package-lock-only --omit=dev --json --registry=https://registry.npmjs.org
```

No Radar, a validação compatível usou `/opt/homebrew/opt/node@22/bin/node` com os entrypoints `node_modules/vitest/vitest.mjs run --maxWorkers=1 --reporter=verbose`, `node_modules/typescript/bin/tsc --noEmit --incremental false`, `node_modules/eslint/bin/eslint.js`, `node_modules/next/dist/bin/next build --webpack` e o smoke. O build também recebeu `BUILD_STANDALONE=true`. A instalação mínima isolada usou seu próprio `npm ci --ignore-scripts` e `check.mjs`. As consultas da base usam manifestos/lockfiles extraídos do commit base, sem instalar pacotes nessa base.

## Limites e pendências

O limite evita a recursão sem controle descrita no DEP-03. Não limita todos os custos de expressões regulares, largura de ASTs ou explosão combinatória de expansão. Padrões acima de 128 níveis passam a ser inválidos; chamadores precisam tratar o erro de entrada inválida. A correção não promete manter um processo vivo se qualquer erro de entrada for deixado sem tratamento.

A cópia local permanece em 3.0.3 e exige manutenção até existir uma solução upstream adequada. A auditoria npm não é uma prova de aplicação desse patch: conferir a resolução local, os hashes e os testes. Não considerar eventual queda na contagem de avisos uma correção publicada pelo mantenedor.

Os Dockerfiles foram ajustados, mas Docker e imagens não foram executados. Não houve acesso à VPS, banco, segredos ou serviços externos da aplicação. DEP-04 a DEP-06 e a adoção/verificação das correções em produção continuam pendentes. O aviso upstream do DEP-03 permanece aberto e deve ser reavaliado quando houver release adequada.
