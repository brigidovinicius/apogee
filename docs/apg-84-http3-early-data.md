# APG-84 — IP confiável vazio em HTTP/3

O Caddy 2.10.2 deliberadamente retorna um valor vazio para `{remote_host}`
quando o handshake TLS ainda não terminou. Em HTTP/3 com retomada de sessão e
0-RTT, o proxy encaminhava esse valor em `X-Apogee-Client-IP`; o guard de
autenticação recusava corretamente a requisição com 503.

Referências da versão implantada:

- [Placeholder remoto](https://github.com/caddyserver/caddy/blob/v2.10.2/modules/caddyhttp/replacer.go#L136-L156).
- [Matcher remote_ip e resposta 425](https://github.com/caddyserver/caddy/blob/v2.10.2/modules/caddyhttp/ip_matchers.go#L144-L152).
- [RFC 8470, seção 5.2](https://www.rfc-editor.org/rfc/rfc8470.html#section-5.2): repetir após 425 sem usar early data.

O `reverse_proxy` agora exige o matcher nativo `remote_ip` cobrindo IPv4 e
IPv6. Esse matcher responde 425 antes de encaminhar requisições antecipadas.
Depois do handshake, a nova tentativa recebe o IP do peer verificado.
HTTP/3 permanece habilitado. Nenhum fallback de IP, cabeçalho fornecido pelo
cliente ou alteração na autenticação foi introduzido.

## Regressão reproduzível

```sh
python3 -m venv /tmp/apogee-http3-test-venv
/tmp/apogee-http3-test-venv/bin/python -m pip install --only-binary=:all: -r make-it-fly-current/scripts/http3-test-requirements.txt
CADDY_BIN=/caminho/caddy-2.10.2 /tmp/apogee-http3-test-venv/bin/python make-it-fly-current/scripts/test-http3-early-data.py
```

No Mac, executar o teste pelo executor da fila global `npm-queue.py --command`.
O CI executa esse teste junto dos testes existentes de autenticação com Caddy
real, Next compilado, PostgreSQL descartável e limites persistentes.

O teste HTTP/3 utiliza TLS com certificado temporário validado pelo cliente,
backend somente em loopback e o bloco de proxy da configuração de produção.
Uma sessão TLS inicial fornece o ticket para uma segunda conexão que envia
uma requisição antes do handshake. É obrigatório comprovar `session_resumed`
e `early_data_accepted`; um cabeçalho `Early-Data` falso não substitui 0-RTT.

Antes da correção, o teste falhou: 0-RTT aceito, status 503 e requisição
antecipada encaminhada ao backend. Depois: status 425 e nenhuma requisição
antecipada no backend. A repetição após o handshake passa com IP válido.
Controles HTTP/1.1, HTTP/2 e HTTP/3 e cabeçalhos de IP falsos também são
verificados. O teste imprime apenas status, protocolo e booleanos, sem valores
de cabeçalho, IP, cookies, URLs de confirmação ou dados pessoais. Não usa
banco, e-mail, Stripe nem credenciais de produção.

## Publicação e validação

Esta correção altera somente a configuração do proxy, além do teste e CI.
Publicar via Git + SSH, após o CI e merge autorizados. Conferir revisão,
checkout limpo, configuração Compose, hash do ambiente, mounts, imagem do
Caddy e serviços vizinhos. Preservar `.env`, certificados, volumes e redes.
Não é necessária migração nem reconstrução da aplicação.

O Caddyfile é um bind mount de arquivo: após trocar o commit, verificar que
o arquivo visto pelo container corresponde ao novo arquivo do host. Se o
mount mantiver o inode antigo, recriar somente `caddy` com Compose,
`--no-deps --force-recreate`; não executar `up` para o stack inteiro. Manter
o SHA anterior e sua configuração disponíveis para rollback pelo mesmo
procedimento. Validar/adaptar o novo Caddyfile antes da ativação.

Validar HTTPS público e o navegador interno com token sintético inválido:
401 após eventual repetição de 425, em vez de 503. Verificar sessão e Radar
com o acesso já existente, sem pagamento, envio de e-mail ou concessão.
Registrar o SHA do proxy separadamente da imagem web preservada. Registrar
resultado, evidências sem dados pessoais, rollback e limitações no runbook
da VPS e na APG-84; concluir a issue somente após validar produção.
