# Comunidade e captura Codex Community — release

## Pedido e base

Publicar a evolução de branding e as páginas da comunidade e de captura do evento OpenAI. O pedido de deploy desta conversa substitui a restrição de publicação da prévia anterior.

Branch isolada `release/community-funnel-20261112`, base `148d003`, com os quatro commits da página já revisada. O worktree e servidor da prévia anterior são preservados. Testes pesados serão executados em CI remoto, pois a fila local está ocupada por um servidor contínuo.

## Decisões preservadas

- Grupo da comunidade gratuito; turma de IA paga e futura, com oferta separada.
- Radar mantém as condições atuais.
- Benefícios ainda não confirmados permanecem identificados como planejados.
- Nome, paleta e estrela da Apogee preservados; nenhuma alteração no Make It Fly.
- O usuário definiu a chamada do evento sem distinguir transmissão ou gravação. URL pública: `/evento-openai`. Convite do WhatsApp permanece pendente, sem link e sem lista de interesse do grupo. Nenhum horário ou URL de conteúdo foi inventado.

## Implementação planejada

1. Remover as guardas exclusivas de prévia das páginas autorizadas, ajustar metadados e eliminar confirmações demonstrativas.
2. Implementar captura real no servidor com origem restrita, limite de corpo, validação de campos, consentimento específico para os avisos do evento, proteção de frequência e gravação idempotente.
3. Persistir os contatos em tabela própria com campanha Codex, sem conceder acesso a contas, alterar cobrança ou misturar leads com inscrições presenciais.
4. Disponibilizar consulta administrativa protegida por autorização no servidor; nunca expor contatos no HTML público.
5. Ligar homepage e navegação à comunidade, com ação principal visível, mantendo o restante da composição.
6. Retirar Make It Fly da navegação e sitemap e aplicar redirecionamento temporário de `/makeitfly/:path*` e `/participar` para `/comunidade`, sem editar a página, formulários ou assets arquivados.
7. Incluir “Energizados por Red Bull” na home e comunidade, com a arte existente e o patrocínio oficial da Apogee confirmado pelo usuário. Não atribuir esse patrocínio à OpenAI.
8. Cobrir sucesso, repetição, falha de banco, entradas inválidas e acesso administrativo em testes com dados sintéticos. Validar layout e fluxo sem enviar e-mail real nem cadastrar pessoa real.

## Arquivos e reaproveitamento

- `content/community.ts` e `components/community/*`: páginas revisadas e formulários.
- `app/comunidade`, página do evento e `app/api/comunidade/contatos`: rotas públicas e captura.
- `lib/community/*`: consentimento, processamento e persistência.
- `sql/community-contacts.sql` e script de migração direcionada: tabela exclusiva dos contatos.
- `app/admin/comunidade` e navegação administrativa: operação dos cadastros.
- Homepage, cabeçalho e rodapé: pontos de entrada.

Reutilizar `readRequestBody`, `memberClientIp`, `consumeRateLimit`, `getSql` e a autorização administrativa existente. E-mail de gravação ou transmissão terá finalidade própria, sem inscrição automática em marketing ou no WhatsApp.

## Publicação e limites

O serviço ativo usa um checkout em `/opt/apogee-site/releases/blog-dashboard-7994dee`, SHA de imagem `7994dee`; o checkout histórico `/opt/apogee-site/repo` está em outro SHA e não representa sozinho a versão servida. O deploy deve preservar o checkout ativo e confirmar a revisão exata do novo serviço. Banco e operação de contatos serão documentados antes de qualquer migração.

Status: implementação em andamento; nenhum push, migração ou deploy desta release foi executado.
