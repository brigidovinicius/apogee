# Diagnóstico seguro do 503 de autenticação — 20/10/2026

## Escopo e estado

Instrumentação local do 503 emitido pela rota `/api/auth/[...all]` quando
`memberClientIp` recusa o contexto de IP da borda. Não modifica a política de
confiança, o proxy, o banco ou a liberação do Radar. Publicação depende de
autorização específica; este documento não comprova deploy.

## Registro e correlação

O evento JSON `member_auth_trust_rejected` usa somente campos permitidos:

| Campo | Conteúdo |
| --- | --- |
| `version` | Versão do esquema, inicialmente 1 |
| `timestamp` | Horário UTC gerado no servidor |
| `id` | UUID aleatório gerado no servidor, sem reutilizar IDs recebidos |
| `provider` | `caddy`, `vercel` ou `unknown` |
| `reason` | `missing`, `empty`, `ambiguous`, `zone_id`, `invalid` ou `unsupported_provider` |
| `method` | `GET`, `POST` ou `other` |
| `endpoint` | `verify_email`, `get_session`, `sign_in_email`, `sign_in_username`, `sign_up_email` ou `other` |
| `alternateIpHeadersPresent` | Booleano: há algum cabeçalho de IP diferente do confiável para este provedor |
| `suppressedSinceLastLog` | Quantidade de eventos omitidos pelo limite desde o último registro |

O 503 continua com a mesma mensagem pública e `Cache-Control: no-store`.
Quando um registro é emitido, seu UUID também aparece no cabeçalho de resposta
`X-Apogee-Error-Id`. O operador pode localizar esse ID no log do serviço web,
sem copiar a URL de confirmação. Um ID não representa uma conta ou sessão e
não é persistido no banco.

Não há valores de cabeçalhos, IPs, hashes de IPs, cookies, autorização, tokens,
URL/query/callback, e-mail, identificador de usuário, corpo, User-Agent,
Referer ou detalhes de exceções nos registros. O caminho só serve para escolher
um rótulo fixo; caminhos desconhecidos viram `other`. Valores de ambiente não
são serializados. O corpo da requisição não é lido pelo diagnóstico.

## Volume e falhas do transporte de logs

Cada instância do módulo admite no máximo 20 tentativas de registro por janela
de 60 segundos. O estado contém somente contadores e horário, sem chaves por
IP ou usuário. O primeiro registro após a reabertura da janela informa a
quantidade de eventos omitidos. Reinícios e múltiplos workers têm orçamentos
independentes; não é um limite global distribuído.

Requisições omitidas pelo limite continuam recebendo 503 e não têm
`X-Apogee-Error-Id`, pois não há registro individual para localizar. Se o
transporte de logs lançar uma exceção, a resposta continua 503 sem expor o erro
ou anunciar um ID sem registro. A instrumentação nunca inicializa a
autenticação/banco para permitir uma requisição que o guard já recusou.

## Interpretação

- `missing`/`empty`: verificar se a requisição passou pela borda esperada e se
  a configuração em execução sobrescreve o cabeçalho confiável.
- `ambiguous`/`zone_id`/`invalid`: a borda entregou um formato não aceito;
  conferir a configuração e a topologia sem habilitar fallback para cabeçalhos
  enviados pelo cliente.
- `unsupported_provider`: conferir a seleção do provedor no ambiente protegido;
  o valor original não aparece no log.
- `alternateIpHeadersPresent` é uma pista de topologia; não comprova origem ou
  autenticidade desses cabeçalhos. A ausência de logs pode indicar limite,
  transporte indisponível ou outro ponto gerando o erro.

Não ativar logs genéricos de requisição nem registrar URLs de confirmação para
investigar. A causa histórica do 503 anterior continua sem evidência dos
cabeçalhos daquela tentativa.

## Validação local

Testes usam somente requisições e identificadores sintéticos, sem banco,
Stripe, rede externa, envio de e-mail ou cobrança. A rota real, seu guard de IP
e a instrumentação são carregados; a inicialização do provedor/banco é
substituída por um destino local de resposta para verificar o encaminhamento.

- Teste inicial falhou por ausência do evento, antes da implementação.
- Novos testes cobrem privacidade, correlação, razões de recusa, rótulos
  permitidos, provedor desconhecido/Vercel, IPv4/IPv6 válidos sem logs,
  orçamento/reabertura da janela e falha do transporte de logs.
- A primeira suíte completa encontrou 43 falhas de dependências antigas em
  `node_modules` (brace-expansion, braces, SDK MCP e proxy-addr).
  `npm install --ignore-scripts --no-audit --no-fund` sincronizou seis pacotes
  com o lockfile existente. `package.json` e `package-lock.json` permaneceram
  byte a byte iguais. Nenhuma atualização de dependência foi versionada.
- Reexecução de `npm test`: **423 testes aprovados, zero falhas**, incluindo
  sete novos testes de diagnóstico e as regressões de autenticação existentes.
- Lint dos três arquivos de código/teste alterados, TypeScript completo
  (`tsc --noEmit --incremental false`) e `git diff --check` aprovados.

Todos os comandos de Node/npm foram serializados pelo executor obrigatório
`/Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command ...`.
Não foi necessário build local, banco, pagamento sandbox ou cobrança real.
Não houve push, PR, CI remoto ou deploy desta instrumentação.

Evidências locais: `/private/tmp/apogee-auth-diagnostics-tests.log` (primeira
suíte), `apogee-auth-diagnostics-tests-final.log` (reexecução),
`apogee-auth-diagnostics-typecheck-final.log` e `apogee-auth-diagnostics-lint-final.log`.
