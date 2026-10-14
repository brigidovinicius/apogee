# Contagem regressiva das oportunidades

Implementação local em 14/10/2026.

## Comportamento

- Cards completos do mural de membros e da curadoria mostram um relógio compartilhado, atualizado a cada segundo e ao voltar para a aba.
- Bolsas, programas e demais chamadas contam até o encerramento das inscrições. O adaptador preserva o timestamp original para prazos com horário, normalizando o formato PostgreSQL para ISO.
- Cards da categoria `eventos` contam até `eventStartsAt`, independentemente do encerramento das inscrições. O início é opcional e pode ser cadastrado/editado no formulário administrativo com data, horário e fuso, ou somente data.
- Datas sem horário usam dias de calendário em Brasília. No dia informado, mostram “Evento hoje” ou “Encerra hoje”, com horário não informado. Nenhum horário é presumido.
- Sem início confirmado, eventos mostram “Data de início não informada”. Fluxos contínuos mostram “Sem prazo definido”.
- Ao zerar o horário exato, o contador mostra “Evento iniciado” ou “Inscrições encerradas”, sem valores negativos. Prazos de até 24 horas recebem destaque.
- A prévia pública continua usando seu DTO restrito. Datas não são inferidas do título nem do prazo de inscrição.

## Dados e publicação

`0012_opportunity_event_start.sql` adiciona `opportunities.event_starts_at` como texto opcional para preservar a precisão da fonte (`YYYY-MM-DD` ou ISO com fuso). O campo passa pelo formulário, Server Action, validação do Radar, persistência, catálogo e adaptador do mural. Campos editados/removidos pelo administrador são preservados nas coletas seguintes. A data exige a categoria de eventos e o trecho de evidência no cadastro administrativo.

A migração está preparada e foi exercitada apenas no banco isolado PGlite. Não houve migração remota, push ou deploy. Antes de publicar, aplicar a migração no Radar seguindo o runbook de backup e autorização existente, depois atualizar Radar e Apogee. Eventos existentes sem início confirmado precisam de informação da fonte oficial para exibir essa contagem.

## Validação

- Apogee: `npm test` — 249 testes passaram.
- Radar: `npm test` — 128 testes passaram, incluindo migrações, persistência/edição/remoção do início, bridge e preservação após nova coleta.
- `npm run typecheck` em ambas as aplicações; ESLint direcionado aos arquivos alterados; `git diff --check`.
- Navegador local, com dados demonstrativos e conexão de banco apontada para endereço local inválido: segundos diminuindo; distinção entre início e encerramento; ausência de data; sem transbordamento horizontal em largura de 390 px. A rota temporária e seu tipo gerado foram removidos e o servidor foi encerrado.
- Não foi exercitado um cadastro real nem alterada uma oportunidade em produção.
