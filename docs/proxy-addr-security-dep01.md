# DEP-01 — proxy-addr nas ferramentas de desenvolvimento

Data: 20/10/2026. Base: `40eaa3e`. Branch: `fix/proxy-addr-dep01`.
Status: corrigido e validado localmente. Sem push, CI remoto ou deploy.

## Problema e escopo

O [aviso do mantenedor GHSA-jqcg-44mw-7w3h](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h) classifica como crítica a falsificação de IP em `proxy-addr >=1.1.0 <2.0.8` sob determinadas políticas de confiança IPv6. A versão corrigida é 2.0.8. Uma configuração como `::ffff:10.0.0.0/8` podia confiar em um cliente IPv4 externo e aceitar seu `X-Forwarded-For`. A representação correta da rede IPv4 /8 em IPv6 mapeado usa /104.

Raiz e site tinham 2.0.7 na cadeia de desenvolvimento `shadcn → @modelcontextprotocol/sdk → express → proxy-addr`. O Radar não tinha esse pacote. O uso dessa configuração vulnerável por um servidor do Apogee não foi demonstrado. A reprodução usa Express real em loopback e dados sintéticos; confirma o defeito da dependência na condição descrita, sem comprovar exploração em produção. O login do Apogee e sua política de borda são tratados separadamente pelo SEC-02.

## Alterações por arquivo

Os caminhos abaixo são relativos à raiz deste checkout.

| Arquivo | Linhas | Alteração |
|---|---|---|
| `package.json` | 41–43 | Override exato de `proxy-addr` para 2.0.8 |
| `make-it-fly-current/package.json` | 65–67 | Mesmo override na aplicação instalada/construída de forma independente |
| `package-lock.json` | 8585–8602 | Nó de `proxy-addr`: versão, URL, integridade e metadado de financiamento oficiais |
| `make-it-fly-current/package-lock.json` | 10068–10085 | Mesmo nó atualizado na árvore do site |
| `scripts/proxy-addr-regressions.mjs` | 6–10 | Resolve a biblioteca consumida pelo Express da aplicação em teste |
| Mesmo arquivo | 12–24 | Rejeita confiança indevida entre famílias IP e falsificação do endereço encaminhado |
| Mesmo arquivo | 25–35 | Conserva políticas legítimas IPv4 /8, IPv6 mapeado /104 e IPv6 nativo |
| Mesmo arquivo | 36–47 | Servidor Express em loopback rejeita IP forjado sob configuração anteriormente vulnerável |
| `tests/proxy-addr-security.test.mjs` | 1–2 | Executa a regressão na raiz |
| `make-it-fly-current/tests/proxy-addr-security.test.mjs` | 1–2 | Executa a regressão na árvore própria do site |

A comparação programática dos dois lockfiles com a base confirma que somente `node_modules/proxy-addr` mudou em cada mapa de pacotes. Nenhuma outra versão foi atualizada; o lockfile do Radar permaneceu intacto. O pacote continua marcado `dev:true`. Não foi usado `npm audit fix`.

O override segue o mecanismo documentado pelo [npm](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/#overrides). Ele permanece necessário enquanto ancestrais puderem resolver uma versão anterior ao patch; revisar sua necessidade em futuras atualizações da cadeia.

## Validação executada

Evidências: [security-dep01](evidence/security-dep01/validation.json). Todas as operações de projeto foram sequenciais pela fila global obrigatória.

- Antes: quatro regressões no site com 2.0.7, **três falhas e um sucesso**. Express aceitou o IP forjado; políticas corretas já funcionavam. O helper foi depois movido para `scripts/` da raiz para reutilização pelas duas aplicações; o log histórico conserva o caminho inicial.
- Depois: as quatro regressões passaram com 2.0.8. Suítes completas: **8/8 na raiz e 368/368 no site**, sem falhas, cancelamentos ou testes ignorados. O workflow existente executa esses globs, mas nenhum CI remoto foi disparado.
- Instalação: `npm ci --ignore-scripts --no-audit --no-fund` na raiz, que estava sem `node_modules`; no site, atualização direcionada de um pacote na instalação existente. Não foi executado `npm ci` limpo no site. `npm ls proxy-addr express --all --json` confirma Express 5.2.1 consumindo 2.0.8 em ambas as árvores.
- Tipos, lint, builds standalone e smoke HTTP passaram nas duas aplicações. O site conserva um aviso preexistente de `<img>` em `components/gallery/gallery-admin.tsx:81`; a raiz não teve avisos de lint.
- Na raiz recém-instalada, a primeira checagem de tipos encontrou `LayoutProps` ainda não gerado; `npm run typegen` seguido de `npm run typecheck` passou, conforme a sequência do CI. Nenhum arquivo de aplicação foi alterado por isso.
- A primeira tentativa de build da raiz encerrou com código 1 durante a compilação sem diagnóstico. A repetição com `--debug` e heap de 2048 MiB passou; a causa inicial não foi estabelecida. O site também passou com heap de 2048 MiB. O Mac apresentou pouco espaço livre durante a validação; nenhum projeto, dependência ou histórico foi apagado.
- Os smokes iniciam e encerram somente seus próprios servidores em loopback, com ambiente sintético, e verificam páginas, assets, cabeçalhos e respostas/redirects privados. Nenhum banco, provedor de e-mail ou serviço de produção foi acessado.

Comandos principais, executados com `npm-queue.py --command` em cada aplicação:

```sh
npm test
npm run typegen # raiz fresca, antes do typecheck
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build
npm ls proxy-addr express --all --json
npm audit --package-lock-only --json --registry=https://registry.npmjs.org
npm audit --package-lock-only --omit=dev --json --registry=https://registry.npmjs.org
```

Build bem-sucedido da raiz incluiu `-- --debug`. Smokes: `node scripts/security-smoke.mjs .` na raiz e `node ../scripts/security-smoke.mjs make-it-fly-current` no site. O Radar recebeu apenas consultas de auditoria do lockfile.

## Resultado da nova consulta npm

| Aplicação | Críticas antes → depois | Altas restantes | Médias restantes | Total completo restante | Total com `--omit=dev` |
|---|---|---:|---:|---:|---:|
| Raiz | 1 → 0 | 10 | 2 | 12 | 0 |
| Site | 1 → 0 | 10 | 6 | 16 | 0 |
| Radar | 0 → 0 | 5 | 0 | 5 | 0 |

As consultas anteriores de raiz/site e todas as consultas posteriores foram feitas nesta tarefa; o valor anterior do Radar é o inventário original de 20/10. O alerta alvo e o pacote `proxy-addr` não aparecem nas respostas posteriores. Auditorias completas continuam retornando código 1 devido aos outros achados; as de produção retornaram 0. Contagens incluem dependências indiretas e ocorrências repetidas entre aplicações, não ataques distintos.

Zero avisos conhecidos de dependências de produção não certifica ausência de vulnerabilidades na aplicação, no ambiente ou no bundle efetivamente publicado. DEP-02 a DEP-06 e a adoção/verificação em produção dos SEC-01 a SEC-06 continuam pendentes, detalhados no [inventário atualizado](security-remediation-status.md).
