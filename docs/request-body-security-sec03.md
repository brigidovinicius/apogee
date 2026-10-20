# SEC-03 — Prazo e cancelamento da leitura de corpos HTTP

Data: 20/10/2026. Base: `0546494` (SEC-01). Branch: `fix/request-body-deadlines-sec03`.

Escopo: somente SEC-03. Correção e validação locais; publicação e verificação na VPS dependem de autorização separada. O SEC-04, sobre consumo da cota global de assinaturas por dados inválidos, permanece fora desta tarefa.

## Problema reproduzido

Os limites de bytes não encerravam requisições que parassem de enviar dados antes do fim do corpo. Sete leitores aguardavam `reader.read()` sem prazo. Convites e solicitação de verificação consumiam o corpo antes de consultar a sessão. O leitor de alertas possuía um timer de cancelamento, mas podia interpretar um prefixo JSON válido como corpo completo quando o cancelamento produzisse EOF.

Antes da correção, as 11 reproduções iniciais falharam: sete leituras permaneceram pendentes, o leitor de alertas não distinguia timeout de término normal, um JSON parcial válido foi aceito e as duas rotas privadas chegaram ao parsing antes da autenticação. Foram usados streams e dados sintéticos, sem carga ou tentativas contra produção.

## Alterações por arquivo e trecho

Os caminhos abaixo são relativos à raiz do repositório. As linhas correspondem à correção local.

| Arquivo | Linhas/trecho | Alteração |
|---|---|---|
| `make-it-fly-current/lib/request-body.ts` | 3–9 | Erro HTTP reconhecível; orçamento total de 5 s para JSON e 30 s para uploads |
| Mesmo arquivo | 11–28 | Validação de Content-Length, aquisição do leitor e interrupção por timeout/abort |
| Mesmo arquivo | 30–41 | Corrida entre leitura e interrupção, prazo monotônico e contagem dos bytes efetivamente recebidos |
| Mesmo arquivo | 42–50 | Cancelamento sem aguardar uma fonte travada; tratamento da rejeição de cancelamento; remoção do timer/listener e liberação do leitor |
| `make-it-fly-current/lib/members/invitation-http.ts` | 13–24 | JSON de até 4 KiB pelo leitor comum; erros controlados preservam o status |
| `make-it-fly-current/app/api/members/invitations/route.ts` | 20–21 | Consulta de sessão antes da leitura e validação do corpo |
| `make-it-fly-current/app/api/members/verification/route.ts` | 16–17 | Mesma ordem de autenticação antes da leitura |
| `make-it-fly-current/lib/applications.ts` | 185–195 | JSON de até 16 KiB, prazo total de 5 s |
| `make-it-fly-current/lib/journey.ts` | 47–58 | JSON de até 12 KiB, prazo total de 5 s |
| `make-it-fly-current/lib/gallery.ts` | 116–130 e 204–220 | Multipart de até 3 MiB em 30 s; exclusão com JSON de até 1 KiB em 5 s |
| `make-it-fly-current/lib/members/avatar.ts` | 28–49 | Multipart de até 6 MiB em 30 s; parsing sobre buffer já limitado |
| `make-it-fly-current/lib/blog/media.ts` | 26–41 | Multipart de até 6 MiB em 30 s; parsing sobre buffer já limitado |
| `make-it-fly-current/lib/opportunities/radar-alerts-client.ts` | 14–19 | JSON de até 4 KiB em 5 s; timeout deixa de ser tratado como EOF válido |
| `make-it-fly-current/infra/site/Caddyfile` | 1–9 | Prazo de 10 s para cabeçalhos e 35 s para leitura de corpo na borda versionada |
| `make-it-fly-current/tests/request-body-security.test.mjs` | arquivo novo | Reproduções e regressões comportamentais dos consumidores e do leitor comum |
| `make-it-fly-current/tests/{applications-backend,applications-export,journey-backend}.test.mjs` | carregamento dos módulos | Reutiliza o carregador TypeScript existente para resolver a nova dependência real |
| `make-it-fly-current/tests/{gallery-backend,members-avatar}.test.mjs` | carregamento dos módulos | Resolve o leitor real nos testes existentes, sem simular sua implementação |
| `make-it-fly-current/scripts/test-body-http.mjs` | arquivo novo | Rotas compiladas com conexões incompletas em loopback e configuração sintética |
| `make-it-fly-current/scripts/test-body-proxy.mjs` | arquivo novo | Caddy real em loopback; requisição completa, cabeçalho suspenso e corpo suspenso |
| `make-it-fly-current/package.json` | scripts | Comandos reproduzíveis `test:body-http` e `test:body-proxy` |
| `.github/workflows/security-hardening.yml` | etapas SEC-03 | Prepara os dois testes para o CI já existente; nenhuma execução remota foi disparada |

Os limites de tamanho existentes e as regras de formato, origem, autorização, elegibilidade e persistência continuam nos respectivos consumidores. O orçamento é para a leitura completa, sem renovação a cada chunk. O cancelamento de uma fonte que nunca resolve ou rejeita não mantém a resposta aguardando cleanup.

## Validação e evidências

Resultado final: **353 testes passaram**, incluindo 22 regressões do SEC-03; zero falhas, cancelamentos ou skips. Checagem de tipos, build standalone, smoke HTTP, quatro cenários HTTP compilados e três cenários reais de Caddy passaram. Lint terminou com zero erros e um aviso preexistente de `<img>` em `components/gallery/gallery-admin.tsx:81`, arquivo não alterado.

No HTTP compilado, convites/verificação responderam 401 em 19 ms/4 ms; candidaturas/eventos responderam 408 em 5.010 ms/5.015 ms. Nenhuma conexão ao banco foi aberta. Na borda isolada, cabeçalhos incompletos fecharam em 10.002 ms e corpo incompleto em 35.008 ms, sem conclusão do upload no upstream.

Os comandos são executados sequencialmente em `make-it-fly-current` pela fila global de npm. Os registros estão em [evidence/security-sec03](evidence/security-sec03/). `validation.json` discrimina resultados e limites.

```sh
npm test
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=3072 npm run build
npm run test:body-http
CADDY_BIN=<binario-local-2.10.2> npm run test:body-proxy
node ../scripts/security-smoke.mjs make-it-fly-current
git diff --check
```

O teste HTTP inicia o standalone recém-compilado com configuração sintética e uma porta de banco que apenas detecta conexões inesperadas. Convites e verificação sem cookie devem retornar 401 sem esperar o corpo. Candidaturas e eventos incompletos devem retornar 408 em cerca de 5 s, sem persistência. Os testes de streams cobrem os uploads, prazo absoluto, bytes UTF-8, cabeçalho de tamanho enganoso, abort, falha da fonte, limpeza travada e preservação de parsing válido.

O teste de borda adapta o Caddyfile versionado com Caddy 2.10.2 e usa seus prazos reais em um listener HTTP isolado. Certificados, ACME, DNS, TLS e upstreams reais não participam. Confere que uma requisição completa chega ao fim no upstream e que o upload truncado não chega ao handler de conclusão.

## Limites e publicação

- O Caddy 2.10.2 pode encerrar o corpo suspenso no prazo com **200 e corpo vazio**. Isso foi observado no upstream isolado. A garantia testada nessa camada é o encerramento da conexão e a ausência de conclusão no upstream; não se deve interpretar esse status vazio como confirmação de gravação. Nas rotas compiladas de candidaturas/eventos, o leitor da aplicação devolve 408 explícito antes do prazo da borda.
- A rota de alertas preserva seu envelope de erro genérico 400 ao capturar falha de leitura. O leitor comum classifica timeout como 408 internamente. Nenhuma confirmação ou assinatura é encaminhada a partir de corpo incompleto.
- O prazo do leitor começa quando a função é chamada. Não é um limite para consultas de sessão, processamento de imagens, persistência ou a duração integral do handler. O Caddy limita também conexões que ainda não chegaram ao leitor, quando essa configuração vier a ser publicada.
- Clientes legítimos que ultrapassarem 5 s de JSON ou 30 s de upload precisarão tentar novamente. Para 6 MiB, o orçamento exige aproximadamente 205 KiB/s; conexões mais lentas podem ser afetadas. A borda usa 35 s para acomodar o orçamento de upload da aplicação.
- Há limites por requisição; isso não certifica resistência a ataques distribuídos ou saturação por concorrência. Não foi feito teste de carga em produção.
- Não houve migração, alteração de banco, segredo, `.env`, acesso à VPS, reativação de integração, push ou deploy. Nenhuma dependência ou lockfile foi alterado. A configuração da borda em produção continua pendente de publicação autorizada e verificação posterior.

Referências primárias usadas: [Node Web Streams](https://nodejs.org/api/webstreams.html#class-readablestreamdefaultreader), [opções de timeout do Caddy](https://caddyserver.com/docs/caddyfile/options#timeouts) e guia de Route Handlers da versão Next instalada em `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`. A sintaxe e o comportamento dos prazos foram conferidos no binário 2.10.2; opções novas de outras versões não foram adicionadas.
