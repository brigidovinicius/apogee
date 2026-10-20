# SEC-02 — identidade de IP e limites do login

Status: correção e validação locais. Sem push, CI remoto, alteração de banco/segredos,
Caddy da VPS ou deploy. O achado permanece aberto em produção até implantação
autorizada conjunta da imagem e do Caddyfile, seguida de verificação na borda real.

## Causa e escopo

Na base `e4e365a`, o auth priorizava `x-vercel-forwarded-for` em qualquer hospedagem.
O Caddy preservava esse cabeçalho fornecido pelo cliente. Rotacioná-lo mudava a chave
do limite por IP. A cota adicional por e-mail existia apenas na server action;
chamadas HTTP diretas a `/api/auth/sign-in/*` não passavam por ela.

Este lote trata somente SEC-02. Preserva a correção local SEC-05. Não modifica
bootstrap administrativo (SEC-06), receptor Sheets (SEC-01), leitores de corpo
(SEC-03), assinaturas Radar (SEC-04) ou versões de dependências.

## Arquivos e comportamento

| Arquivo em make-it-fly-current | Correção |
|---|---|
| `infra/site/Caddyfile` | Sobrescreve X-Apogee-Client-IP e X-Forwarded-For com o peer TCP; remove X-Vercel-Forwarded-For, X-Real-IP, CF-Connecting-IP e Forwarded |
| `lib/members/client-ip.ts` | Caddy aceita apenas X-Apogee-Client-IP; Vercel aceita apenas o cabeçalho da plataforma; nenhuma cadeia/fallback; valida IPv4/IPv6 |
| `lib/members/auth.ts` | Usa a lista de cabeçalhos correspondente à hospedagem e instala o hook comum de proteção |
| `lib/members/auth-abuse.ts` | Exige IP válido em login/cadastro; aplica 8 tentativas por identificador/método em 600 segundos, incluindo auth.api |
| `app/api/auth/[...all]/route.ts` | Em produção, GET/POST sem IP confiável falham com 503 antes de inicializar auth/banco |
| `lib/members/dal.ts` | Server actions usam a mesma origem de IP do auth |
| `app/membros/actions.ts` | Mantém cota de 20 tentativas/IP/600 s; cota por conta agora fica no hook comum, sem contagem duplicada na action |
| `tests/members-auth-abuse.test.mjs` | Regressão de configuração, fallback, ausência/ambiguidade de IP e cota de conta |
| `scripts/test-auth-proxy.mjs` | Integração real Caddy/standalone/PostgreSQL e chamada programática usada pela action |
| `.github/workflows/security-hardening.yml` na raiz | Executa a integração após o build já existente, com PostgreSQL sintético e Caddy 2.10.2 verificado por SHA-512 |

O limite por conta usa a tabela existente `rate_limit`, por UPSERT atômico; não
exige migração. As chaves contêm SHA-256 do identificador normalizado, sem e-mail
ou username em texto claro. Hash não é criptografia de dados pessoais. Os dois
métodos de login têm cotas próprias; não se trata de um bloqueio permanente da
conta nem de uma cota única somada entre e-mail e username. A resposta independe de
o identificador existir e não consulta existência para decidir o limite.

Mantêm-se as regras do Better Auth de cinco tentativas/IP/60 s para login e cinco
cadastros/IP/hora. A normalização e o agrupamento IPv6 /64 do provedor continuam
ativos. A server action mantém também seu limite de IP existente, além do hook.

A confiança exige que o backend seja acessível apenas pela borda autorizada. Um
cabeçalho com nome próprio não é autenticação entre serviços. A porta web continua
sem publicação no Compose; este lote não afirma isolar serviços internos entre si.
Não habilitar Cloudflare/outro proxy sem revisar o peer TCP e a cadeia confiável:
na configuração preparada, o Caddy usa o endereço da conexão direta e ignora IPs
declarados por cabeçalhos de outro intermediário. Em desenvolvimento/teste fora
de produção, ausência de IP usa loopback para permitir execução local.

Referências primárias consultadas: [Caddy reverse_proxy](https://caddyserver.com/docs/caddyfile/directives/reverse_proxy#defaults)
e [Better Auth rate limiting](https://better-auth.com/docs/concepts/rate-limit).
A configuração e a integração foram verificadas contra Better Auth 1.7.6 instalado,
não apenas contra a documentação da versão mais recente.

## Validação local

- Base: 309 testes passaram antes da mudança.
- Regressão antes da correção: quatro falhas esperadas; IP forjado aceito,
  fallback Vercel indevido, requisição sem IP aceita e ausência de hook por conta.
- Suíte completa: 314 testes passaram.
- Revisão do novo hook: um teste adicional falhou antes do ajuste; identificadores
  vazios, de tipo errado ou acima de 320 caracteres agora são rejeitados com 400,
  sem pular a política de login nem criar chaves na cota por conta.
- Integração: nove cenários e um teste pai (10 testes na contagem TAP), todos
  com PostgreSQL descartável, Next standalone em produção e dados sintéticos.
- Testes positivos: cadastro, login por e-mail/username e consulta de sessão.
- Testes negativos: 25 tentativas por cada um dos três endpoints com cabeçalhos
  forjados; a sexta em diante recebe 429 e a chave persistida usa o peer real.
- Nove IPs distintos e variação de caixa não reiniciam o limite por identificador.
  A chamada programática `auth.api.signInEmail`, usada pela action, também recebe
  429 na nona tentativa. IPv6 do mesmo /64 compartilha a cota.
- IP ausente, inválido, com porta ou cadeia é recusado com 503 sem consumir a tabela
  de limites. Configuração de hospedagem desconhecida também é recusada.
- Typegen, typecheck, build standalone e smoke HTTP passaram. Lint: zero erros;
  um aviso já existente de `<img>` em `components/gallery/gallery-admin.tsx:81`,
  arquivo sem alteração neste lote.
- `caddy adapt` aceitou o Caddyfile. Avisos não fatais: formatação do arquivo e
  sobrescrita explícita de X-Forwarded-For, que também tem tratamento padrão.

Dependências foram reutilizadas por cópia física APFS de node_modules, com
package-lock.json idêntico. Nenhuma versão/lockfile foi alterada. O standalone tem
zero symlinks externos. Caddy 2.10.2 nativo foi obtido da release oficial e seu
arquivo conferido pelo SHA-512 oficial. Não houve instalação global nem Docker.
PostgreSQL local: 16.14. CI remoto com PostgreSQL 17 está preparado, ainda não
executado. O teste HTTP usa loopback sem TLS; não certifica TLS, DNS, OAuth Google,
infraestrutura compartilhada ou comportamento na VPS/Vercel reais.

Comandos locais, sempre sequenciais e pela fila global:

```text
npm test
npm run typegen
npm run typecheck
npm run lint
npm run build
CADDY_BIN=<binário 2.10.2> MEMBERS_POSTGRES_BIN=<binários PG locais> npm run test:auth-proxy
node ../scripts/security-smoke.mjs make-it-fly-current
```

O runner não usa DATABASE_URL do operador. Cria seu próprio cluster/banco, recusa
bootstrap externo fora do destino sintético exato de CI e encerra apenas processos
que iniciou. Não envia e-mail, não executa OAuth e não chama a VPS. Mantém logs e
dados sintéticos temporários para revisão. Evidências resumidas estão em
`docs/evidence/security-sec02/`.

## Implantação futura — somente com autorização própria

1. Revisar o commit, concluir CI remoto e confirmar SHA/configuração/saúde atuais.
   Preservar imagem, Caddyfile e segredos anteriores para rollback.
2. Confirmar `APPLICATION_HOSTING_PROVIDER=caddy`, web sem porta publicada e Caddy
   como única borda. Inventariar qualquer intermediário novo antes do corte.
3. Validar a sintaxe do Caddyfile preparado e programar imagem + configuração na
   mesma janela. Imagem nova com proxy antigo falha com 503; não improvisar fallback.
   Não imprimir o `.env` ou configuração renderizada contendo segredos.
4. Conferir na borda real, com conta sintética aprovada, login/sessão e identidade
   observada; verificar que forjar cabeçalhos não muda a cota. Não realizar força
   bruta/teste de carga em produção. Encerrar SEC-02 somente com essa evidência.

Se for necessário rollback autorizado, restaurar o par inventariado de imagem e
Caddyfile. Restaurar só um lado pode interromper login ou reabrir o achado. Não
desativar limites, limpar cotas reais ou ampliar confiança em cabeçalhos como
contorno. A implantação SEC-05, migrações, credenciais e deploy continuam gates
separados, ainda sem execução em produção nesta conversa.
