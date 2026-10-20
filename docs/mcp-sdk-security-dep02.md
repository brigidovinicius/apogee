# DEP-02 — vínculo de credenciais OAuth ao emissor no SDK MCP

Data: 20/10/2026. Base: `847f1c8`. Branch: `fix/mcp-sdk-dep02`.
Status: correção e validação locais. Sem push, CI remoto, merge ou deploy.

## Problema e alcance

O [aviso do mantenedor GHSA-6qxp-vccf-f47h](https://github.com/modelcontextprotocol/typescript-sdk/security/advisories/GHSA-6qxp-vccf-f47h) classifica como alta a possibilidade de um cliente OAuth HTTP entregar credenciais a um emissor escolhido por um servidor MCP não confiável. O SDK instalado era 1.30.0; a correção da série 1.x é 1.31.0.

As duas aplicações resolviam o pacote por `shadcn → @modelcontextprotocol/sdk`, marcado `dev:true`. A inspeção do `shadcn` instalado mostrou importações de servidor MCP e `StdioServerTransport`; a busca nos diretórios de código das aplicações não identificou clientes OAuth HTTP nem provedores próprios desse SDK. Não foi demonstrado acesso a essa falha por um usuário público do Apogee. A versão dos conectores MCP externos do Codex não foi auditada ou alterada por esta tarefa.

## Alterações por arquivo

Caminhos relativos à raiz do checkout; linhas da revisão local.

| Arquivo | Linhas | Alteração |
|---|---|---|
| `package.json` | 41–44 | Acrescenta override exato do SDK para 1.31.0, conservando `proxy-addr` 2.0.8 |
| `make-it-fly-current/package.json` | 65–68 | Mesmo override na árvore independente do site |
| `package-lock.json` | 1661–1664 | Atualiza somente versão, URL e integridade do nó do SDK |
| `make-it-fly-current/package-lock.json` | 2683–2686 | Mesma atualização no site |
| `scripts/mcp-oauth-regressions.mjs` | 11–20 | Resolve o SDK pelo consumidor `shadcn` e testa as distribuições CommonJS e ESM |
| Mesmo arquivo | 22–48 | Credenciais sintéticas, estado de descoberta em cache e substituição apenas do transporte HTTP; SDK real trata e serializa credenciais |
| Mesmo arquivo | 50–70 | Bloqueio de refresh token de outro emissor, `fetchToken` com credencial vinculada a outro emissor e provedor com `expectedIssuer` |
| Mesmo arquivo | 72–93 | Fluxos legítimos continuam funcionando; refresh persiste `issuer` após serialização JSON |
| `tests/mcp-oauth-security.test.mjs` | 1–2 | Inclui a regressão na suíte da raiz |
| `make-it-fly-current/tests/mcp-oauth-security.test.mjs` | 1–2 | Inclui a regressão na suíte do site |
| `docs/security-remediation-status.md` | inventário | Marca DEP-02 como validado localmente e atualiza contagens e próxima pendência |

A comparação programática com a base encontrou apenas `node_modules/@modelcontextprotocol/sdk` alterado em cada mapa de pacotes dos lockfiles. As dependências declaradas pela versão corrigida são iguais às da instalada anteriormente. O patch do DEP-01 foi preservado, nenhuma outra versão foi atualizada e o lockfile do Radar não mudou. Não foi usado `npm audit fix`.

## Reprodução e validação

Evidências em [security-dep02/validation.json](evidence/security-dep02/validation.json). Operações executadas sequencialmente pela fila npm global obrigatória.

- **Antes:** os dez testes direcionados na raiz produziram oito falhas e dois sucessos com 1.30.0. Os quatro cenários problemáticos falharam tanto em CommonJS quanto em ESM; os controles de client credentials com destino legítimo passaram.
- **Depois:** dez testes direcionados passaram com 1.31.0. Suítes completas: **18/18 na raiz e 378/378 no site**, sem falhas, cancelamentos ou testes ignorados. As suítes também executaram as regressões do DEP-01.
- **Instalação:** atualização direcionada de um pacote em cada instalação existente, com scripts de instalação desabilitados. Não foi executado `npm ci` limpo nesta tarefa. `npm ls @modelcontextprotocol/sdk proxy-addr --all --json` confirmou SDK 1.31.0 e `proxy-addr` 2.0.8 nas duas árvores.
- **Compatibilidade:** CLI `shadcn --help` carregou e terminou com código 0 nas duas aplicações. Esse teste não certifica todos os comandos ou integrações externas da CLI.
- **Aplicações:** tipos, lint, builds standalone e smoke HTTP passaram nas duas árvores. O site conserva somente o aviso preexistente de `<img>` em `components/gallery/gallery-admin.tsx:81`; a raiz não teve avisos de lint.
- O primeiro build do site foi interrompido antes de concluir. Após confirmar a fila sem processos ativos, a repetição completa passou. O build incompleto permanece registrado separadamente; ele não foi contado como aprovação.
- Uma consulta inicial não conseguiu criar seu arquivo temporário por falta de espaço, antes de instalar ou alterar dependências. Com espaço livre novamente disponível, a tarefa prosseguiu. Nenhum projeto, dependência, histórico ou ambiente foi apagado para liberar espaço.

Comandos principais, sempre por `npm-queue.py --command` e em cada aplicação afetada:

```sh
node --test tests/mcp-oauth-security.test.mjs # reprodução/checagem direcionada na raiz
npm install --package-lock-only --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm update @modelcontextprotocol/sdk --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org
npm test
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build
node node_modules/shadcn/dist/index.js --help
npm ls @modelcontextprotocol/sdk proxy-addr --all --json
npm audit --package-lock-only --json --registry=https://registry.npmjs.org
npm audit --package-lock-only --omit=dev --json --registry=https://registry.npmjs.org
```

Smokes: `node scripts/security-smoke.mjs .` na raiz e `node ../scripts/security-smoke.mjs make-it-fly-current` no site. Esses smokes usam servidores próprios em loopback e ambiente sintético. A regressão OAuth usa estado de descoberta em cache e `fetchFn` sintéticos, sem conexão de rede: não testa descoberta OAuth real, consentimento interativo ou persistência em armazenamento externo. Somente o armazenamento JSON em memória do teste foi exercitado.

## Resultado npm e limites

| Aplicação | Críticas depois | Altas antes → depois | Médias depois | Total completo depois | Total com `--omit=dev` |
|---|---:|---|---:|---:|---:|
| Raiz | 0 | 10 → 9 | 2 | 11 | 0 |
| Site | 0 | 10 → 9 | 6 | 15 | 0 |

O identificador alvo e o pacote SDK deixaram de aparecer nas respostas de auditoria. Consultas completas continuam retornando código 1 pelos outros achados; consultas de produção retornaram 0. As contagens incluem ancestrais e repetições entre aplicações. Zero avisos conhecidos no lockfile de produção não certifica segurança do sistema nem os pacotes efetivamente publicados.

**Credenciais legadas:** o mantenedor exige cuidados além da atualização para clientes OAuth existentes: preservar `issuer` no armazenamento, vincular ou limpar credenciais antigas sem essa informação e configurar `expectedIssuer` nos provedores fornecidos pelo SDK. Chamadas diretas a `refreshAuthorization`/`exchangeAuthorization` e novo consentimento interativo não estão cobertos da mesma forma. Não identificamos esses fluxos no código examinado das aplicações e não consultamos, migramos ou revogamos credenciais reais. Portanto, esta entrega valida a dependência local e os cenários sintéticos; não certifica clientes OAuth externos ou históricos.

DEP-03 a DEP-06 continuam pendentes. Adoção/verificação em produção dos SEC-01 a SEC-06 e das correções de dependências permanecem gates separados, conforme o [inventário](security-remediation-status.md).
