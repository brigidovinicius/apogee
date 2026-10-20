# SEC-04 — Validação e cotas de assinaturas do Radar

Data: 20/10/2026. Base: `ab8af45` (SEC-03). Branch: `fix/radar-alert-quotas-sec04`.

Correção local do SEC-04. Nenhum push, deploy, acesso à VPS, publicação ou envio real de e-mail foi realizado. A configuração em produção não foi alterada.

## Problema e reprodução

O endpoint público `/api/radar/alerts` consumia `radar-alerts:subscribe`, compartilhada entre todos os visitantes e limitada a 100/hora, antes de validar os campos da assinatura. Cem entradas `{action:"subscribe"}` podiam gastar essa cota e bloquear a próxima assinatura válida. Não havia limite por cliente nessa camada.

Na base anterior, os 12 testes direcionados terminaram com **9 falhas e 3 sucessos**. A reprodução das cem entradas inválidas fez a próxima solicitação válida receber 429. As demais falhas cobriram falta de validação estrita, normalização, limite por IP/destinatário e contexto de IP/segredo inválido. Apenas quotas e transporte externos foram substituídos; handler, parser limitado e política de IP foram executados de verdade.

## Alterações por arquivo e trecho

Os caminhos são relativos à raiz do repositório. As linhas correspondem à revisão local.

| Arquivo | Linhas/trecho | Mudança |
|---|---|---|
| `make-it-fly-current/app/api/radar/alerts/route.ts` | 10–19 | União de esquemas estritos por ação: UUID compatível com o receptor, e-mail normalizado de até 254 caracteres, consentimento literalmente `true`, token hexadecimal de 64 caracteres e rejeição de campos adicionais |
| Mesmo arquivo | 23–33 | Origem e `sec-fetch-site` checados; corpo e esquema validados antes de consultar a cota ou encaminhar ao Radar |
| Mesmo arquivo | 35–46 | IP confiável e segredo obrigatórios; limites persistentes de 10/IP/hora, 3/destinatário/hora e 100 globais/hora, nessa ordem |
| Mesmo arquivo | 39–44 | IP e e-mail entram nas chaves como HMAC-SHA-256 com namespaces distintos; destinatário limitado recebe `{ok:true}` sem encaminhamento adicional |
| Mesmo arquivo | 47–54 | Confirmação/cancelamento conservam cota própria de 20/token/ação/hora, sem depender de IP ou da cota de novas assinaturas; falhas inesperadas têm erro genérico |
| `make-it-fly-current/tests/radar-alert-controls.test.mjs` | arquivo | Amplia a regressão existente para 12 testes comportamentais; usa o handler, parser, transporte e política de IP reais, simulando armazenamento de cota e `fetch` |
| `make-it-fly-current/scripts/test-alert-quotas.mjs` | arquivo novo | Integração HTTP com standalone compilado, PostgreSQL descartável e Radar simulado em loopback; cobre concorrência, persistência após reinício, expiração e isolamento das ações |
| `make-it-fly-current/scripts/test-body-http.mjs` | 58–67 | Cem entradas malformadas na rota compilada devem retornar 400 antes de qualquer conexão ao banco; conserva regressões HTTP do SEC-03 |
| `make-it-fly-current/package.json` | scripts | Adiciona `test:alert-quotas`, sem mudar dependências ou lockfile |
| `.github/workflows/security-hardening.yml` | etapa SEC-04 após build | Prepara a integração no PostgreSQL sintético já disponível no CI; nenhuma execução remota foi disparada |

O contador atômico existente de `lib/members/rate-limit.ts`, sua tabela e o código do Radar não foram alterados. Não há nova migração de produção. O leitor de corpo do SEC-03 continua limitando JSON a 4 KiB e 5 segundos nesta rota.

## Política e privacidade

Entradas que não passam no esquema retornam 400 sem consultar o armazenamento de cota ou o Radar. Para uma assinatura válida no esquema, a sequência é:

1. Exigir IP da borda configurada e `BETTER_AUTH_SECRET` de pelo menos 32 caracteres; ausência resulta em 503.
2. Consumir até 10 tentativas por IP/hora. Acima disso, retornar 429 antes da cota por destinatário/global.
3. Consumir até 3 tentativas por e-mail normalizado/hora, independentemente da oportunidade ou IP. Acima disso, retornar 200 com `{ok:true}`, sem gastar a cota global ou chamar o Radar. Essa resposta preserva o reconhecimento genérico já usado pelo Radar para endereços ativos, pendentes ou limitados; não confirma envio ou entrega de e-mail.
4. Aplicar o limite global existente de 100/hora antes de encaminhar. Esgotamento retorna 429.

As cotas contam tentativas elegíveis, não mensagens entregues. Recusas posteriores e falhas do upstream não reembolsam os contadores anteriores. O `consumeRateLimit` existente incrementa também tentativas acima do limite; o limite impede encaminhamento adicional, não limita o valor numérico armazenado a 10/3/100.

A normalização é `trim` e minúsculas, compatível com o receptor. Não removemos `+tags`, pontos ou outras partes que poderiam distinguir caixas legítimas. E-mails/IPs não são gravados em texto puro nas novas chaves. HMAC é pseudonimização, não anonimização; a rotação do segredo muda essas identidades e reinicia suas cotas efetivas. Nenhum segredo foi criado ou alterado nesta tarefa.

## Validação

Consulte [evidence/security-sec04](evidence/security-sec04/) e `validation.json` para os resultados registrados. Comandos executados sequencialmente em `make-it-fly-current`, pela fila global obrigatória:

```sh
npm test
npm run typecheck
npm run lint
NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=3072 npm run build
MEMBERS_POSTGRES_BIN=<binarios-locais> npm run test:alert-quotas
npm run test:body-http
node ../scripts/security-smoke.mjs make-it-fly-current
git diff --check
```

A suíte passou com **364 testes**, incluindo os 12 direcionados do SEC-04. Tipos, build standalone, smoke HTTP e lint passaram. O único aviso de lint é o `<img>` preexistente em `components/gallery/gallery-admin.tsx:81`, arquivo não alterado.

A integração usa a definição versionada de `rate_limit` num banco novo e um pool de quatro conexões do aplicativo. Nenhuma tabela real de assinaturas ou provedor de e-mail participa. Resultados confirmados:

- 100 solicitações HTTP malformadas geram zero registros de cota e zero chamadas ao Radar simulado; a próxima assinatura válida passa e consome uma unidade global.
- 12 chamadas concorrentes do mesmo IP, com destinatários distintos, permitem exatamente 10 encaminhamentos e devolvem 429 às outras duas. Reiniciar o Next e forjar cabeçalhos de outros provedores não remove o limite. Outro IP continua permitido.
- Oito chamadas concorrentes para o mesmo e-mail, variando espaços/maiúsculas e IPs, geram apenas três encaminhamentos. Todas recebem a mesma resposta pública `{ok:true}`. As chaves persistidas não contêm IP/e-mail em texto puro.
- A expiração da janela persistida permite uma nova tentativa legítima.
- 100 tentativas distribuídas com e-mails distintos atingem o teto global e a seguinte recebe 429; confirmação e cancelamento ainda são encaminhados com suas cotas próprias.

As primeiras tentativas de criar o PostgreSQL falharam por falta de espaço no Mac, antes de executar os cenários. Depois de confirmado espaço livre suficiente, a execução completa passou. O cluster de teste usa WAL de 1 MiB e limites pequenos, somente no recurso descartável. Não houve remoção de projetos, worktrees, `node_modules`, históricos ou ambientes para liberar espaço. O script encerra apenas o Next, o servidor simulado e o cluster que criou.

## Limites e publicação

- Validar UUID não comprova que uma oportunidade existe, esteja publicada ou aceite alertas. A disponibilidade e a autorização continuam sendo verificadas pelo Radar. Uma tentativa bem formada para um ID indisponível pode consumir a cota de encaminhamento do site; o SEC-04 corrigido trata entradas malformadas e o esgotamento por um único IP/destinatário.
- A identificação por IP depende da borda sobrescrever o cabeçalho e do backend permanecer privado. Reutilizamos `memberClientIp`: Caddy aceita somente `x-apogee-client-ip`; Vercel, somente `x-vercel-forwarded-for`. Publicação deve incluir/conferir as proteções de borda do SEC-02. Sem contexto confiável em produção, novas assinaturas falham fechadas.
- Usuários sob o mesmo NAT compartilham 10 tentativas/hora. Os limites podem afetar uso legítimo concentrado. Ataques distribuídos e rotação de endereços continuam limitados pelo orçamento global; não foi demonstrada imunidade a negação de serviço.
- A cota existente da tabela `rate_limit` é compartilhada entre processos. Seus limites de armazenamento e a limpeza de chaves não foram redesenhados nesta tarefa.
- O upstream foi simulado na integração; emissão real de e-mail, registros de assinantes, TLS da borda, quotas do provedor e estado da produção não foram testados. A integração não confirma recebimento de e-mail.
- Nenhum push, CI remoto, merge ou deploy foi feito. O resultado é local; a verificação em produção depende de publicação autorizada separadamente.

Referências primárias: [validação de entradas — OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html) e [HMAC — Node.js](https://nodejs.org/api/crypto.html#cryptocreatehmacalgorithm-key-options). Os contratos do receptor e da borda foram conferidos no código local, sem consultar usuários ou configurações privadas.
