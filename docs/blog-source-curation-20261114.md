# Otimização do fluxo editorial — 14/11/2026

Base: main `69d31d3`. Branch isolada `feat/blog-source-curation-20261114`.
As dez matérias 31–40 foram publicadas separadamente pelo painel, após confirmação
explícita do titular. Esta alteração não concede aprovação a nenhum artigo futuro.

## Comportamento e arquivos

1. **Busca e curadoria:** `automatic-research.mjs`, `research-service.mjs` e
   `store.mjs`: excluir ofertas e notícias sem pertinência; priorizar referências
   primárias, veículos distintos e conteúdo recente. Descobrir links das páginas
   públicas para referências cadastradas, incluindo cobertura independente, no
   mesmo orçamento de oito requisições/30 segundos. Site desconhecido vira apenas
   indicação para avaliar; não é acessado, cadastrado ou aprovado automaticamente.
2. **Imagens incluídas:** `article-research.mjs`: guardar sugestões de imagem da
   própria página, crédito e licença declarados quando presentes. São indicações,
   nunca licença presumida nem autorização de download/republicação.
3. **Produção e revisão:** `editorial.mjs`, `images.mjs`, `google-provider.mjs`:
   melhorar instruções de contexto, temporalidade, atribuição e fotografia
   ilustrativa por assunto; rejeitar capas minúsculas ou uniformes antes de
   importá-las. Uma geração por artigo, sem repetição automática.
4. **Painel:** tipos/consulta em `lib/blog/pipeline.ts` e apresentação na Central
   Editorial: mostrar referências encontradas e sugestões de mídia com direitos
   pendentes, sem acionar busca ou geração adicional ao abrir a página.

## Invariantes

- Assinatura Google oficial, APIs e serviços pagos bloqueados; sem aumento de
  limites diários, semanais, reserva de cota ou tamanho do pedido de IA.
- Mínimo de 90%, fatos críticos resolvidos, independência e citações literais.
  Cadastro, reputação e popularidade não confirmam um fato.
- Capturas e versões anteriores preservadas; fontes com restrição de acesso
  continuam bloqueadas. Sem mudança em credenciais ou permissões.
- Tudo novo entra em rascunho. Publicar exige revisão humana dessa versão.
- Sem migração de banco. Deploy e push ficam separados da validação local.

## Validação concluída

- Worker: **116 testes aprovados**, sem rede ou credenciais.
- Integração: **73 cenários aprovados**, em PostgreSQL 15 novo e isolado dentro
  de contêiner sem rede externa. Nenhum banco preexistente foi usado pelos testes.
  Inclui dez tópicos completos, texto/capa creditada, 90%, revisão, limites e
  preservação das sugestões de fontes após a importação do rascunho.
- Site: tipos gerados, TypeScript integral, lint dos arquivos alterados e
  **14 testes de blog/painel aprovados**, incluindo URL maliciosa, escape de
  crédito e ausência de download/importação automática da imagem indicada.
- Navegador interno: componente real renderizado com fixtures e CSS existente,
  em prévia privada por localhost. Desktop 1280 px; mobile 390 px, conteúdo com
  390 px e título dentro dos limites da página. Nenhum navegador externo usado.
- O teste detectou releitura redundante de página bloqueada e falta de
  reconhecimento de “computacional”; ambos corrigidos e revalidados.
- Nenhuma chamada real de IA, nenhum aumento de teto, nenhuma dependência nova
  de aplicação. A fila e os previews dos outros chats no Mac foram preservados;
  a validação foi executada sequencialmente em contêineres temporários na VPS.
- Build completo de produção, CI remoto, push, PR, merge e deploy das melhorias
  permanecem gates separados. A versão ativa do site/worker segue em `787920b`.

SEO para pesquisa com IA conserva as práticas de SEO, com conteúdo útil e
original, conforme o [guia oficial do Google](https://developers.google.com/search/docs/fundamentals/ai-optimization-guide).
As orientações de imagem e texto alternativo seguem o
[Google Search Central](https://developers.google.com/search/docs/appearance/google-images).
Não há promessa de posição ou citação. Crédito e indicação de licença são dados
declarados pela fonte, não uma autorização presumida de republicação.
