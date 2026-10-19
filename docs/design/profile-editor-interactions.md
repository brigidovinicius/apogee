# Interações mobile — perfil e editor de artigos

18/10/2026. Trabalho local, sem push, publicação ou deploy.

## Correções na aplicação

1. Após a validação do servidor, o perfil e o editor levam o foco ao primeiro campo inválido. Mensagens gerais também podem receber foco. Isso evita deixar um erro fora da tela após o envio.
2. Os erros do editor agora estão associados aos campos por `aria-invalid` e `aria-describedby`, incluindo vídeo, tema, SEO e agendamento.
3. O tema selecionado é preservado quando a ação retorna um erro. O select recebe a seleção submetida como padrão ao ser recriado, antes da restauração automática do formulário pelo React. Antes, Tecnologia chegava à validação, mas Estudos reaparecia na tela.
4. A prévia de busca utiliza o mesmo `blogSlug` do salvamento: deriva o endereço do título quando o campo está vazio e normaliza endereços personalizados.

## Testes no navegador

As amostras anteriores eram HTML estático. As duas páginas de formulário agora têm um bundle de revisão interativa que importa os componentes React reais e executa as ações reais de validação com dependências de autorização, persistência e navegação substituídas exclusivamente no teste. As rotas normais do Next não importam esse bundle.

Foram exercitados 17 cenários registrados no JSON da entrega:

- Perfil: nome vazio com foco e erro acessível, bio acima de 500 caracteres rejeitada e dados válidos interrompidos antes da persistência.
- Foto: ausência, arquivo TXT e imagem acima de 5 MB rejeitados; uma imagem sintética válida chega apenas ao transporte simulado, que responde com erro e reabilita o botão.
- Editor: campos obrigatórios bloqueiam o envio e levam o foco ao título; título, resumo e corpo alimentam a prévia.
- Vídeo inválido: erro associado ao campo, foco visível e tema/destaque/noindex preservados.
- Agendamento: data vazia e passada rejeitadas; data futura validada e interrompida antes de qualquer gravação.
- Publicação: botão exercitado somente no sandbox; dados válidos encontram a barreira de persistência, sem criar artigo ou publicar.
- SEO: título e descrição personalizados, endereço normalizado e checklist da palavra-chave atualizados.
- Toque duplo no botão salvar: uma única ação simulada registrada.
- Tela baixa de 390×320: campo de vídeo em y=142,27 px, erro terminando em y=265,36 px e cabeçalho terminando em y=79,40 px. Campo e mensagem permanecem visíveis. Botões reabilitados e sem overflow horizontal.

O reteste do build final em 390×844 confirmou `focus=videoUrl`, `aria-invalid=true`, tema Tecnologia e ausência de overflow. As duas abas foram deixadas em 390×844 com os valores fictícios iniciais, sem arquivos selecionados.

## Barreiras contra gravações

- O adaptador de persistência do bundle lança `REVIEW_WRITE_BLOCKED`; o adaptador de fetch simula falha e não delega à rede.
- O builder inspeciona o grafo: 53 módulos, nenhum módulo real de banco, autenticação ou transporte.
- O proxy local responde HTTP 403 a qualquer método diferente de GET/HEAD. Foram conferidos POSTs vazios para avatar, artigos e a própria amostra, todos rejeitados.
- As páginas de revisão recebem CSP `connect-src 'none'; form-action 'none'`.
- Os valores e eventos do formulário ficam apenas na memória da amostra e são descartados ao recarregar.

Nenhum perfil real foi alterado, nenhum arquivo foi enviado ao aplicativo, nenhum rascunho ou agendamento foi criado. A integração com banco real e a autorização de uma sessão real não foram exercitadas; a cobertura automatizada existente de autorização foi preservada. Biblioteca de mídia de artigo existente e remoção de foto já persistida não foram ativadas, pois as amostras partem de um artigo novo e perfil sem foto.

## Validação técnica

Lint sem erros (um aviso preexistente de `<img>` em gallery-admin), tipos, 268 testes e build aprovados. Inclui novos testes de foco, endereço canônico da prévia e transporte de revisão bloqueado. `git diff --check` passou.

Preview interativo de perfil: http://127.0.0.1:3109/__review/profileedit
Preview interativo do editor: http://127.0.0.1:3109/__review/editor
