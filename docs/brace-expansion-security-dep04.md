# DEP-04 — brace-expansion nas árvores de ferramentas

Data: 20/10/2026. Base: `736465f`. Branch: `fix/brace-expansion-dep04`.
Status: correção e validação locais concluídas; adoção em produção pendente. Sem push, CI remoto ou deploy.

## Problema e correção

Os avisos do mantenedor descrevem [recursão em grupos aninhados](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-qhr7-859c-m2p7), [recursão e listas de argumentos em parseCommaParts](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-6j4f-fj2g-mc7p) e [reescrita com custo quadrático](https://github.com/juliangruber/brace-expansion/security/advisories/GHSA-q2hr-2g5m-vwhr). As versões 1.1.21 e 5.0.12 abrangem as três correções nas séries instaladas.

Raiz e site tinham três cópias vulneráveis cada: 1.1.18 consumida pelo `minimatch` 3, e duas 5.0.9 consumidas pelos `minimatch` de `@ts-morph/common` e `@typescript-eslint/typescript-estree`. Todas estão marcadas `dev:true`. O Radar já tinha 1.1.21 e 5.0.12 e não foi alterado. Não foi demonstrado uso desses padrões por um endpoint público nem ataque em produção.

Foram acrescentados overrides específicos por versão principal: `brace-expansion@1 → 1.1.21` e `brace-expansion@5 → 5.0.12`. Isso cobre as cópias aninhadas sem trocar a série usada por cada consumidor. Os registros dos demais pacotes, incluindo os DEP-01/02 e o vendor do DEP-03, foram preservados. Não foi usado `npm audit fix`.

## Arquivos e trechos

Caminhos relativos à raiz deste checkout.

| Arquivo | Trecho | Alteração |
|---|---|---|
| `package.json` | 46–47 | Fixa os patches de cada série na raiz |
| `make-it-fly-current/package.json` | 70–71 | Mesma política para a instalação independente do site |
| `package-lock.json` | 2479, 2857, 3768 | Versão, URL e integridade das três instâncias; nenhuma outra alteração no mapa de pacotes |
| `make-it-fly-current/package-lock.json` | 3562, 3941, 4982 | Mesmas três instâncias atualizadas no site |
| `scripts/brace-expansion-regressions.mjs` | 5–17 | Resolve a biblioteca pelo consumidor real, contemplando os três caminhos e os formatos de API das séries 1/5 |
| Mesmo arquivo | 19–36 | Grupos aninhados, alternativas, cadeias de parsing e listas largas; verifica término sem estouro de pilha e limites de saída |
| Mesmo arquivo | 38–44 | Verifica orçamento explícito e limite padrão de reescrita, sem teste frágil de duração |
| Mesmo arquivo | 45–49 | Conserva resultados literais esperados para intervalos, alternativas e matching dos consumidores |
| `tests/brace-expansion-security.test.mjs` | 1–2 | Inclui os cenários na suíte da raiz |
| `make-it-fly-current/tests/brace-expansion-security.test.mjs` | 1–2 | Inclui os mesmos cenários na suíte do site |
| `docs/security-remediation-status.md` | DEP-04 e contagens | Atualiza o inventário; demais achados ficam para tarefas separadas |

As integridades SHA-512 dos seis nós atualizados foram comparadas às respostas do registro oficial npm. As dependências declaradas por cada nó permanecem iguais às da base.

## Validações

- Antes: **18 falhas e 3 sucessos** nos 21 cenários da raiz com as versões antigas. As falhas incluíram `RangeError: Maximum call stack size exceeded`; os controles de padrões legítimos passaram.
- Depois: **21/21** testes direcionados passaram nas três instâncias da raiz. Suítes completas: **56/56 na raiz e 416/416 no site**, sem falhas, cancelamentos ou testes ignorados, incluindo regressões dos DEP-01/02/03.
- Instalação direcionada: **três pacotes alterados em cada aplicação**. Nenhuma instalação limpa com `npm ci` foi feita nesta tarefa; as duas instalações existentes foram reconciliadas com os lockfiles. Não se usou Docker.
- Tipos e lint passaram nas duas aplicações. O site conserva um aviso preexistente sobre `<img>` em `components/gallery/gallery-admin.tsx:81`; a raiz ficou sem avisos. O primeiro lint da raiz apontou o nome reservado `module` no helper novo; ele foi renomeado, e a suíte e o lint da raiz passaram novamente.
- Builds standalone e smokes HTTP passaram na raiz e no site. Os smokes iniciam/encerram somente seus próprios servidores em loopback e usam configuração sintética. [Evidências e resultados](evidence/security-dep04/validation.json).
- O Mac chegou a cerca de 150 MB livres. Os builds aguardaram a confirmação por leitura de espaço disponível novamente (3,9 GB). Nenhum arquivo, projeto ou dependência foi apagado para liberar espaço.

Os testes usam somente strings sintéticas: 4.500 níveis aninhados, 8.000 grupos encadeados e uma lista com 160.000 membros para alcançar também o antigo caminho de `push.apply`. As cargas são locais e sequenciais; não foram submetidas ao sistema publicado. O teste de CPU verifica a política de reescrita e o resultado literal, sem executar a carga de longa duração do aviso nem afirmar um benchmark de desempenho.

Comandos de projeto executados pela fila global obrigatória `npm-queue.py --command`, uma operação por vez:

```sh
node --test tests/brace-expansion-security.test.mjs
npm install --package-lock-only --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm install --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm test
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build
node scripts/security-smoke.mjs . # raiz; no site: node ../scripts/security-smoke.mjs make-it-fly-current
npm ls brace-expansion minimatch --all --json
npm audit --package-lock-only --json --registry=https://registry.npmjs.org
npm audit --package-lock-only --omit=dev --json --registry=https://registry.npmjs.org
```

## Auditoria final

| Aplicação | Altas antes → depois | Médias depois | Críticas depois | Total completo depois | Total com `--omit=dev` |
|---|---|---:|---:|---:|---:|
| Raiz | 10 → 9 | 3 | 0 | 12 | 0 |
| Site | 10 → 9 | 7 | 0 | 16 | 0 |
| Radar, somente leitura | 5 → 5 | 1 | 0 | 6 | 0 |

O pacote `brace-expansion` e os três identificadores alvo estão ausentes das respostas finais. `npm ls` confirmou as três instâncias resolvidas por aplicação afetada. Consultas completas continuam retornando código 1 pelos outros achados; consultas com desenvolvimento omitido retornaram 0. Contagens incluem pacotes indiretos e repetições, não falhas independentes. Zero avisos conhecidos nas dependências de produção não certifica a segurança do sistema publicado.

## Limites

As proteções upstream podem devolver grupos muito profundos ou reescritas excessivas literalmente, em vez de continuar expandindo. Os controles verificam compatibilidade dos padrões comuns; não certificam todas as entradas possíveis ou todos os comandos das ferramentas. Limites configuráveis podem ser alterados por um chamador; os testes de reescrita exercitam o padrão e um limite mais restritivo.

O Radar permaneceu sem alteração e não teve suíte/build repetidos nesta tarefa. A nova auditoria não certifica um sistema sem vulnerabilidades: DEP-03 continua com aviso upstream, e DEP-05 a DEP-09 continuam pendentes. Nenhum CI remoto, acesso à VPS, banco, segredos, publicação ou deploy foi realizado. As correções locais ainda precisam de adoção e verificação nos ambientes publicados.
