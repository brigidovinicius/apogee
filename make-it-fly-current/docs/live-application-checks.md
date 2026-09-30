# Verificação manual com Supabase real

O script `scripts/verify-live-applications.mjs` **não faz parte de `npm test`** e não foi executado contra serviços reais na preparação. Ele usa apenas o ambiente do processo, sem ler arquivos `.env` automaticamente, e não registra chaves, tokens, corpos de respostas ou dados de participantes.

## Pré-condições

- Migração aplicada somente ao projeto Make It Fly `oqvartwafnclxuqpkltp` e configuração privada concluída.
- Servidor de teste iniciado com as variáveis corretas. Para `http://127.0.0.1:3017`, usar `npm run dev -- --hostname 127.0.0.1 --port 3017`: o backend rejeita HTTP local em modo produção (`next start`).
- Confirmar que **o servidor testado também aponta para esse projeto**. A API não divulga sua identidade de banco; o script só consegue confirmar a correspondência ao conferir as linhas gravadas.
- Autorizar quatro registros sintéticos retidos, identificados por `TESTE INTERNO`, e-mails `@example.com` e telefones fictícios `+1 202 555 0101` a `0104`.
- Usar somente localhost ou a cópia isolada `netlify.app`. O script recusa o domínio de produção Vercel e outros destinos. Nenhuma alteração de hospedagem é executada.

## Executar explicitamente

Fornecer `SUPABASE_URL`, `SUPABASE_SECRET_KEY` (ou `SUPABASE_SERVICE_ROLE_KEY`) e `APPLICATION_ORIGIN` através do ambiente seguro. Opcionalmente fornecer `SUPABASE_PUBLISHABLE_KEY` (ou `SUPABASE_ANON_KEY`) para a verificação de leitura pública negada. Não colocar valores privados em comandos, mensagens ou documentação.

Se as variáveis já estiverem em `.env.local` privado e ignorado pelo Git, Node 22 pode carregá-las explicitamente:

```sh
MAKEITFLY_RUN_LIVE_TESTS=1 MAKEITFLY_TEST_ORIGIN=http://127.0.0.1:3017 node --env-file=.env.local scripts/verify-live-applications.mjs
```

Sem arquivo, omitir `--env-file=.env.local` e fornecer o ambiente por um mecanismo seguro. `APPLICATION_ORIGIN` e `MAKEITFLY_TEST_ORIGIN` precisam ser idênticas, sem barra final. O servidor não usa nem precisa do link da Sympla; a liberação do ingresso é manual.

## Cobertura e limites

| Verificação | Resultado esperado |
| --- | --- |
| GET privado filtrado por UUID sintético ainda não usado | 200, lista vazia |
| GET com chave pública, se fornecida | 401/403 e código PostgreSQL `42501` |
| Não/Não, Não/Sim, Sim/Não | 201 `{ "received": true }`; linha `NOT_ELIGIBLE` preservada |
| Sim/Sim | 201 `{ "received": true }`; linha `APPROVED` preservada |
| Repetição do mesmo UUID e dados | 200, nenhuma linha adicional |
| Mesmo UUID com nome diferente | 409, linha original intacta |
| Conferência privada dos quatro UUIDs | Quatro linhas; score correto; nenhum checkout ou pagamento marcado |

São seis POSTs ao formulário. Envios anteriores podem consumir o limite de 12 tentativas em dez minutos; em HTTP 429, aguardar a janela, sem contornar a proteção. Falha de rede pode ocorrer depois de uma gravação: o script interrompe e não tenta de novo automaticamente. Conferir o marcador da execução no banco antes de decidir reexecutar; uma nova execução cria novos registros.

O teste confirma que todos recebem o mesmo recibo, sem score ou checkout. Não abre a Sympla, não compra, não envia e-mails/WhatsApp e não faz DELETE. As quatro linhas permanecem no banco (ou parte delas, se houver falha). Remoção exige autorização separada.

O teste de ACL cobre apenas leitura anônima e, por exigir a negação `42501`, não considera uma chave inválida ou uma lista vazia prova suficiente. Não testa escrita anônima, papéis autenticados, todos os grants, constraints inválidas, concorrência entre instâncias, experiência de navegador ou o envio manual do link. Conferir grants/RLS no SQL e testar o fluxo visual separadamente antes de publicar.
