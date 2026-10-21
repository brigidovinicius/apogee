# Cadastros dos drops e cadastro após intenção de compra

## Escopo solicitado

O administrador pode consultar nome, telefone, e-mail e data dos contatos que autorizaram novidades da loja. Durante a implementação, o usuário também pediu que o CTA/formulário de cadastro saísse da vitrine e aparecesse somente depois do clique em Comprar.

## Implementação

- Menu administrativo: Cadastros dos drops, em `/admin/loja/drops`.
- Busca por nome, e-mail e telefone (incluindo entrada com máscara), paginação de 50 linhas, ordenação por data e ID decrescentes. Datas em America/Sao_Paulo.
- Leitura da tabela existente `store_drop_signup`; nenhuma migração ou modificação dos contatos.
- Exportação pelo endpoint `/api/admin/loja/drops/exportar`, com verificação da sessão e do papel administrativo atual antes de consultar os contatos. A página também autoriza na camada de dados, independentemente do layout/proxy.
- CSV UTF-8 com BOM, separador ponto e vírgula, nomes de colunas em português e telefone como texto. Células que poderiam executar fórmulas são neutralizadas. A exportação respeita a busca e inclui todas as páginas; acima de 10.000 resultados recusa com orientação para refinar o filtro, sem truncamento silencioso.
- Download com tratamento de sessão expirada, erro e limite; respostas privadas sem cache. Nenhuma ação de envio de mensagens ou alteração de papéis.
- Vitrine sem formulário/CTA de novidades visível. Cada produto tem Comprar; o clique abre um diálogo nativo com o nome do produto, a mensagem de indisponibilidade e o formulário existente. Não há checkout, pedido ou cobrança.
- Mensagem: “Este produto ainda não está disponível para compra. Cadastre-se para receber novidades dos próximos drops.”
- Fechar, Escape e clique no fundo fecham o diálogo. O foco retorna ao botão do produto. A rolagem da página fica contida durante o diálogo.

## Verificação local

- `next typegen --webpack`, TypeScript, ESLint dos arquivos alterados e build de produção aprovados.
- Suíte completa final: 448 testes aprovados após integrar a atualização de autenticação da PR #83, incluindo autorização antes da leitura, negação a visitantes/membros, busca literal parametrizada, telefone formatado, paginação, exportação além da primeira página, datas, proteção de fórmulas, limite explícito, erros, escape de HTML e ausência inicial do formulário na vitrine.
- Fila global usada para toda execução Node/build/teste/preview; etapas sequenciais.
- Navegador com build de produção: três botões Comprar, mensagem correta para cada produto, campos obrigatórios, consentimento desmarcado, fechamento com Escape e foco restaurado. Em 390 × 844, largura da página de 390 px e diálogo de 359 px; sem overflow horizontal. Desktop em 1440 × 1000 conferido.
- Falha de envio no preview de produção local (origem local recusada) exibiu erro e preservou os campos; não foi tratada como prova de persistência. O backend de cadastro não foi alterado.
- Rota administrativa sem cookie redirecionou ao login. Exportação sem configuração de banco retornou 503 sem dados e com no-store; respostas 401/403 e sucesso foram exercitadas pelos testes do handler com sessão controlada.
- Revisão visual do painel em harness isolado, usando os componentes reais com contatos explicitamente fictícios e sem autenticação/banco de produção: lista, busca, limpeza, estado vazio e download conferidos. CSV baixado pelo navegador validado com BOM UTF-8, quatro colunas, somente o contato filtrado e telefone preservado. Em 390 px, documento com 390 px e tabela com rolagem interna; desktop de 1440 px sem overflow. A verificação autenticada posterior em produção está registrada abaixo.

## Publicação autorizada e verificada

Após a revisão local, o usuário respondeu “Sim” ao pedido de enviar e publicar os dois ajustes. A [PR #84](https://github.com/brigidovinicius/apogee/pull/84) foi integrada depois de todos os seis jobs do [CI 39521790590](https://github.com/brigidovinicius/apogee/actions/runs/39521790590) passarem, incluindo as integrações PostgreSQL. A publicação ocorreu em 20/10/2026, no horário de Brasília.

- Head validado: `db7a0a00c6b73d2f24015980ade78437be911541`.
- Merge publicado: `63fb1ae088f88a84bc8d14d447921722516a89a9`.
- Árvore idêntica entre head e merge: `e687de58328928c6ea96e0b480292fc874fe8274`, conferida localmente e na VPS.
- Revisão anterior de rollback: `132597f27799bbd9d694e69f02cd74e3912c4489`; imagem preservada `sha256:74961c741fe88f81394ef146993a9e0ae22e2e5d5f1fd84d7532d2960b487423`.
- Nova imagem: `sha256:618a81e2bc1905a82f7b5a00752ed071abd53b21a53ce6c0de95e1ca6e8f7d88`.

O preflight confirmou checkout limpo, web saudável, rollback disponível, `.env` modo 600 e capacidade. Uma transação somente leitura confirmou as cinco colunas usadas, permissão SELECT do papel da aplicação e sete migrações existentes, sem imprimir contatos. O deploy usou fetch e SHA exato, verificou a árvore e o escopo, compilou e recriou somente `web`, sem migração. Web saudável, zero reinícios, 12 containers vizinhos e hash do `.env` preservados. Make It Fly, fotos, dados, DNS, proxy, certificados, redes e volumes não foram alterados.

Em produção, `/loja`, as duas fotos da camiseta, `/makeitfly` e `/membros/entrar` responderam 200. Sem cookies, a página administrativa respondeu 307 para login e o endpoint CSV respondeu 401.

No navegador público, a loja mostrou três botões Comprar e nenhum formulário antes do clique. Comprar Camiseta Apogee abriu a mensagem correta, nome, telefone, e-mail e consentimento desmarcado. Escape removeu o formulário e devolveu o foco ao botão. Em 390 × 844, a página mediu 390 px e o diálogo 358,8 px, sem overflow horizontal; captura desktop também conferida. Nenhum cadastro foi submetido nesta validação.

A sessão administrativa preexistente no navegador permitiu conferir a lista real em `/admin/loja/drops`, com as quatro colunas e a data no horário de Brasília. Uma busca sem correspondência mostrou estado vazio e desabilitou a exportação; Limpar busca restaurou a lista. O botão Exportar para planilha baixou o CSV autenticado, com BOM UTF-8, quatro colunas, telefone como texto e quantidade de linhas igual à lista. Os valores pessoais não foram copiados para este relatório ou para o Git. O arquivo baixado permanece no computador do usuário. Nenhuma credencial foi inserida, permissão alterada ou mensagem enviada.

As abas temporárias foram fechadas e o viewport restaurado. O registro documental posterior não implica novo deploy.

Evidências locais anteriores: `/Users/viniciusbrigido/.codex/visualizations/2026/10/20/01a15b62-58e9-77c1-9e1c-82c3fa85022d/`. Capturas públicas de produção: `/tmp/apogee-drops-published-20261020.jpg` e `/tmp/apogee-drops-published-mobile-20261020.jpg`. Logs: `/tmp/apogee-admin-drops-validation-20261020.log` e `/tmp/apogee-admin-drops-deploy-20261020.log`. Runbook remoto: `/opt/apogee-site/releases/20261020-loja-admin-drops.md`.
