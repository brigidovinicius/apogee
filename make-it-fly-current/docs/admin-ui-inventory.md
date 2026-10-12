# Inventário das telas administrativas Apogee

Referência visual inspecionada somente para leitura em 8 de outubro de 2026:
`https://claude.ai/design/p/a99591eb-ff06-449c-857f-76b93d48faa1?file=Apogee+Telas.dc.html&via=share`.

O protótipo é uma especificação visual. Valores marcados como `EXEMPLO`,
`DADOS DE EXEMPLO` ou `[PLACEHOLDER]` não foram tratados como dados ou regras
aprovadas. Nenhum arquivo da origem foi copiado ou alterado.

## Inventário do protótipo

| Prancha | Tela e estados | Componentes e navegação | Permissão indicada |
| --- | --- | --- | --- |
| A1 | Painel com KPIs, funil, exceções, operação e cadastros recentes | Shell lateral, cards de métrica, listas de exceção, tabela resumida | Administrador; números vindos do servidor e sem dados pessoais no resumo |
| A2 | Criação de post: rascunho, revisão e publicado; erro de acessibilidade da capa | Editor em blocos, inspector de publicação/acesso/SEO e checklist | Fluxo editorial com revisão; o protótipo não define backend nem papéis separados |
| A3 | Lista, busca, filtros, paginação, vazio implícito e detalhe de usuário | Tabela, painel de detalhe, acessos concedidos e auditoria | Administrador; alterações manuais pedem motivo e auditoria; dados privados do usuário ficam ocultos |
| A4 | Curadoria: novas, retificações, conflitos e falta de evidência | Fila, comparação campo a campo, evidências e impacto da publicação | Curador/editor ou administrador; publicar/rejeitar exige justificativa |

O menu do protótipo também cita Fontes, Moderação, Assinaturas, Conciliação,
Fila e jobs e Auditoria. A operação de fontes agora está disponível como
`/admin/radar`, ligada ao contrato editorial real do Radar. As demais telas
continuam indisponíveis, sem rotas ou ações fictícias.

## Relação com a UI e o PRD existentes

O diagnóstico vigente em `docs/ui-mockup-integration-plan.md` é a referência
interna de produto usada nesta fatia. Ele registra que o pacote visual anterior
não contém README, PRD ou brief adicional e que seus handoffs não definem
contratos de CMS, pagamentos, analítica, salvos ou acesso Premium. Portanto,
não há um PRD administrativo aprovado a sobrepor: o protótipo compartilhado foi
comparado com esse diagnóstico, com as rotas atuais e com os schemas/DALs que
de fato existem. Tokens navy, preto, branco e sky, Inter, Instrument Serif,
controles e alvos mínimos foram reutilizados da UI consolidada.

## Diferenças para o sistema atual

| Domínio visual | Contrato real encontrado | Adaptação implementada |
| --- | --- | --- |
| Painel | Schema atual contém usuários, sessões e fórum; não contém billing, alertas, analytics, fontes ou jobs | `/admin` usa apenas contagens reais de contas e fórum e separa lacunas conhecidas como pendências, sem reproduzir números demonstrativos |
| Usuários | Better Auth persiste nome, e-mail, usuário, verificação, papel e data; `role` aceita somente `member` ou `admin` | `/admin/usuarios` oferece leitura filtrada e limitada. Não existem mutações de papel, suspensão, entitlement ou exportação |
| Curadoria | O catálogo vigente é lido de conteúdo local e, quando configurado, do Radar remoto já autenticado; não há revisão/evidência persistida | `/admin/curadoria` é somente leitura e mantém a fonte oficial. Publicar, rejeitar e reprocessar não são simulados |
| Radar editorial | O Radar mantém fontes, evidência, UF/cidade estruturadas, estado de auditoria e fila de candidatos em banco próprio | `/admin/radar` permite confirmar os três itens de auditoria, ativar uma fonte já verificada e iniciar uma coleta limitada. A ponte usa token privado entre os dois serviços e nunca entrega a credencial ao navegador |
| Blog | Tabelas `blog_post`, `blog_post_event` e `blog_media`, DAL editorial, slug, categoria, visibilidade por data e autorização de admin | `/admin/posts` lista e edita; `/admin/posts/novo` cria rascunhos, publica e agenda. O editor aceita capa, imagens no texto, link de vídeo e revisão SEO. A revisão por papel separado ainda não existe |
| Galeria | `/gerenciar-galeria` e `/api/gallery/admin` aceitam uma sessão de membro com papel `admin`; a credencial operacional legada permanece como fallback server-side | A página e a API refazem a autorização no servidor. A interface não coleta nem serializa a credencial operacional |

## Controle de acesso

- O proxy faz somente a checagem otimista de presença da sessão em `/admin`.
- Cada página administrativa chama `requireAdmin()` no servidor antes de
  renderizar conteúdo operacional.
- As ações de salvar, publicar, agendar, retirar do ar e arquivar o blog repetem
  `requireAdmin()` antes de ler ou alterar o banco. O público recebe somente
  artigos cujo estado e data permitam a publicação.
- `/admin/radar` repete `requireAdmin()` na página e em cada Server Action
  antes de chamar a ponte privada do Radar.
- A ponte aceita apenas uma credencial editorial dedicada na rede
  `apogee_radar_bridge`; a URL e o token permanecem em módulos server-only e
  não são serializados para o navegador.
- `/gerenciar-galeria` e `/api/gallery/admin` também repetem a verificação do
  papel real da sessão no servidor.
- Usuário autenticado sem papel `admin` é redirecionado ao estado explícito
  `/admin/acesso-negado` e não executa as consultas administrativas.
- A criação de conta continua forçando `role = member`; o formulário de perfil
  não aceita alteração de papel.

## Alternância de apresentação

- O seletor aparece somente depois que o servidor confirma `role = admin`.
- `/admin` representa o modo Administrador e `/membros` representa a
  pré-visualização de Usuário. A rota mantém o modo após refresh sem criar
  estado cliente, cookie de permissão ou claim adicional.
- A troca altera somente shell e navegação. O papel persistido, as sessões e os
  checks de página, DAL, Server Component e Route Handler não são alterados.
- Nenhum papel, token, credencial ou registro privado é passado para Client
  Components. Uma sessão comum pode solicitar `/admin`, mas recebe o fluxo de
  acesso negado antes de qualquer leitura operacional e nunca recebe o seletor.

## Estados e acessibilidade

- `app/admin/loading.tsx`: carregamento com `aria-busy` e esqueleto sem depender
  de animação quando `prefers-reduced-motion` está ativo.
- `app/admin/error.tsx`: falha recuperável com nova tentativa e mensagem que
  não expõe detalhes internos.
- Listas de usuários e curadoria têm estados vazios explícitos.
- O acesso negado tem mensagem e rotas de retorno, sem depender de ocultação
  por CSS ou código cliente.
- A navegação usa `aria-current`, itens sem contrato usam `aria-disabled`, os
  filtros têm rótulos e o detalhe de usuário usa `details/summary` acessível.
- O layout troca a barra lateral por menu nativo em telas estreitas e mantém
  alvos com a altura mínima definida nos tokens globais.

## Limitações deliberadas

- O schema atual não representa curador, editor, moderador, financeiro ou
  atendimento documental; conceder esses papéis agora ampliaria privilégios
  sem contrato.
- Não há métricas de atividade útil, conversão, MRR, churn, fontes, custos de
  IA ou operação. Esses indicadores do protótipo não são exibidos como reais.
- Não foram criadas ações de exportar, suspender ou atribuir papel a usuários,
  nem de publicar, rejeitar ou reprocessar candidatos da curadoria/Radar.
- O blog não inclui fluxo de revisão por um papel editorial
  distinto. Seu editor aceita texto simples com marcadores de imagens e o registro de eventos identifica
  as ações administrativas, sem armazenar versões integrais do conteúdo.
- A ponte do Radar limita esta tela à auditoria de fonte, ativação e coleta
  controlada. Candidatos ainda exigem a revisão humana própria do Radar antes
  de qualquer publicação.
- A galeria continua sendo um sistema adjacente. A sessão administrativa pode
  abrir sua superfície, sem alterar armazenamento, credencial legada ou APIs
  públicas da galeria.
