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
- Suíte completa: 441 testes aprovados, incluindo autorização antes da leitura, negação a visitantes/membros, busca literal parametrizada, telefone formatado, paginação, exportação além da primeira página, datas, proteção de fórmulas, limite explícito, erros, escape de HTML e ausência inicial do formulário na vitrine.
- Fila global usada para toda execução Node/build/teste/preview; etapas sequenciais.
- Navegador com build de produção: três botões Comprar, mensagem correta para cada produto, campos obrigatórios, consentimento desmarcado, fechamento com Escape e foco restaurado. Em 390 × 844, largura da página de 390 px e diálogo de 359 px; sem overflow horizontal. Desktop em 1440 × 1000 conferido.
- Falha de envio no preview de produção local (origem local recusada) exibiu erro e preservou os campos; não foi tratada como prova de persistência. O backend de cadastro não foi alterado.
- Rota administrativa sem cookie redirecionou ao login. Exportação sem configuração de banco retornou 503 sem dados e com no-store; respostas 401/403 e sucesso foram exercitadas pelos testes do handler com sessão controlada.
- Revisão visual do painel em harness isolado, usando os componentes reais com contatos explicitamente fictícios e sem autenticação/banco de produção: lista, busca, limpeza, estado vazio e download conferidos. CSV baixado pelo navegador validado com BOM UTF-8, quatro colunas, somente o contato filtrado e telefone preservado. Em 390 px, documento com 390 px e tabela com rolagem interna; desktop de 1440 px sem overflow. Esta revisão visual não substitui a futura verificação autenticada em produção.

## Limite da entrega

Alteração local para revisão. Push, CI remoto, merge e publicação desta versão ainda não executados. Não foram lidos/exportados contatos de visitantes, modificados dados de produção ou usadas credenciais reais na validação visual. Make It Fly e fotos preservados.

Evidências locais: `/Users/viniciusbrigido/.codex/visualizations/2026/10/20/01a15b62-58e9-77c1-9e1c-82c3fa85022d/`. Log: `/tmp/apogee-admin-drops-validation-20261020.log`.
