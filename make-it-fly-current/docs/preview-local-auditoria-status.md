# Prévia local para auditoria — 27/09/2026

## Forma de execução

O servidor da loja foi iniciado como job temporário da sessão do usuário do macOS (`com.makeitfly.audit-local`), independente da sessão de comandos do chat. Não foi instalado um arquivo de inicialização automática e não foi feita publicação ou abertura da porta para a rede externa.

- URL: `http://127.0.0.1:3001/loja`
- Projeto: `/Users/viniciusbrigido/Site interativo Rosa teste /make-it-fly-current`
- Runtime: Node 20.19.6, Next.js 16.3.4, webpack.
- Interface de escuta: somente `127.0.0.1:3001`.
- Saída do servidor: `/private/tmp/makeitfly-audit.XZKPBY/stdout-project.log`
- Erros do servidor: `/private/tmp/makeitfly-audit.XZKPBY/stderr-project.log`

O Mac deve continuar ligado e disponível durante a auditoria. Um navegador executado em outra máquina/nuvem não acessa este localhost. A execução foi desacoplada do chat, mas isso não garante disponibilidade se o Mac dormir, desligar ou se o processo for encerrado.

Para encerrar apenas esta prévia, no Terminal do Mac:

```sh
launchctl remove com.makeitfly.audit-local
```

Depois de encerrá-la, para iniciar manualmente em um terminal que permaneça aberto:

```sh
cd '/Users/viniciusbrigido/Site interativo Rosa teste /make-it-fly-current'
npm run dev -- -p 3001 --hostname 127.0.0.1
```

## Verificação executada

Em 27/09/2026, às 22:45 BRT, os quatro downloads abaixo retornaram HTTP 200, com corpo integral lido:

| Recurso | Bytes |
| --- | ---: |
| `/loja` | 61.586 |
| `/_next/static/chunks/main-app.js` | 13.246.172 |
| `/_next/static/chunks/app/loja/page.js` | 660.736 |
| `/_next/static/chunks/webpack.js` | 142.828 |

O navegador abriu a loja com o título `Loja | Make it fly`; o componente de vidro informou `data-renderer="webgl"`.

## Limites e avisos

- A causa exata do encerramento da execução anterior não foi comprovada. Sua sessão já não existia; não há evidência suficiente para atribuir a queda a WebGL, falta de memória ou HMR.
- O novo processo registrou um aviso ao tentar ler `.env.local`: `Unknown system error -11, read`. A rota da loja e seus bundles responderam normalmente depois disso. Nenhuma credencial foi lida, copiada ou alterada para contornar o aviso. Integrações e rotas que dependem dessas variáveis não foram validadas nesta execução.
- Esta verificação libera a inspeção da loja, mas não substitui a auditoria visual e de código.
- Para leitura dos fontes sem Desktop Commander, anexe `docs/loja-fontes-para-auditoria.md`. O pacote `docs/loja-auditoria-2026-09-27.zip` continua disponível como alternativa.
