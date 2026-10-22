# Retornos após login — validação local com autenticação real

## Problemas e correções

O login por senha adicionava o destino ao histórico com o comportamento padrão
`push` das Server Actions. Ao voltar do Radar, a página de login era revisitada
e, encontrando uma sessão válida, redirecionava novamente à área autenticada.
`signIn` agora usa `RedirectType.replace`: um único Voltar recupera a origem,
mantendo filtros, busca e paginação; Avançar recupera o destino autenticado.

O validador `safeNextPath` aceitava somente a área de membros. Por isso, um
login iniciado em `/admin`, `/admin/posts` ou `/gerenciar-galeria` terminava no
fórum. A lista de destinos agora inclui `/admin`, seus descendentes e a rota
exata `/gerenciar-galeria`. Origem externa, caminhos parecidos e escapes para
rotas não permitidas continuam rejeitados. A seleção do destino não concede
privilégios: os guards de sessão e papel administrativo continuam no servidor.

Não foram alterados credenciais, schema, papéis de produção, estilos, conteúdo
ou animações. O ajuste da política de histórico vale para o login por senha;
Google OAuth não foi exercitado nesta validação.

## Regressões e checagens

Antes da correção, `tests/login-return.test.mjs` apresentou duas falhas esperadas:
destino `/admin` convertido em `/membros` e histórico `push` em vez de `replace`.
Os testes também cobrem origem externa, caminhos semelhantes, senha rejeitada
sem navegação e recusa de membro comum pelo guard administrativo.

Após a correção, pela fila global e sem concorrência com o servidor dev:

- `npm test`: **462 passaram, zero falhas**.
- `npm run typecheck`: passou.
- `npm exec -- eslint app/membros/actions.ts lib/members/validation.ts tests/login-return.test.mjs tests/members-validation.test.mjs tests/browser/login-return-history.mjs`: passou.
- `git diff --check`: passou.

Não houve build, CI remoto, push, merge ou deploy.

## Navegador e backend real

**46 verificações passaram** no navegador em 1440×900 e 390×844:

- Radar: filtros e página 2, login novo pelo cabeçalho desktop e CTA móvel,
  um único Voltar, Avançar, sessão após recarregar, paginação de membros,
  menu móvel com sessão ativa e atalho acessível.
- Administração: login direto no painel e em `/admin/posts`, retorno exato,
  histórico após login, seis destinos móveis com fechamento e foco, marca,
  sidebar e atalho acessível.
- Retornos: gerenciador da galeria e galeria pública com Voltar/Avançar em
  desktop e celular; login direto em `/gerenciar-galeria`; leitura da API
  protegida; Programação, Experiência, marca, topo, cabeçalho e rodapé do
  Make It Fly, posição restaurada, entrada direta móvel e retorno da galeria.

A aplicação isolada em `http://127.0.0.1:4381` executou os formulários, Server
Actions, Better Auth, proxy, DAL e guards originais, sem mocks de autenticação.
Os 330 arquivos de aplicação foram comparados por SHA-256 com o código corrigido.
O PostgreSQL exclusivo em 127.0.0.1:55439 contém duas contas sintéticas, hashes
de credencial, sessões persistidas e as sete migrations existentes. Nenhuma
operação atingiu produção.

O catálogo contém 72 oportunidades fictícias servidas pelo adaptador HTTP local
do contrato v3. Ingestão e edição do Radar, pagamentos, OAuth, envio de e-mail e
telemetria externa não foram validados. E-mail e cobrança estão desabilitados.

O Next dev atingiu o limite de memória e reiniciou durante uma repetição do
histórico da galeria. Foram observados erros transitórios de chunks do Webpack
e perda da conexão local. A sessão permaneceu no banco; a navegação entre as
galerias foi revalidada em uma nova aba HTTP e os cenários do Make It Fly foram
concluídos depois disso. O preview de desenvolvimento continua sujeito ao limite
de memória; esta rodada não é uma validação de estabilidade de produção.

O helper `tests/browser/login-return-history.mjs` exercita o formulário real e
confere origem, destino e um único Voltar/Avançar sem registrar credenciais.

Evidências desta rodada ficam na pasta de visualizações do chat, em
`navigation-login-fixes/`: `browser-results.json`, `backend-proof.json`,
`source-manifest.json`, `unit-tests.log`, `typecheck.log`, `lint.log` e
`admin-retorno-corrigido.png`. Configuração e credenciais locais continuam em
arquivos privados fora do repositório.
