# Contagem regressiva das oportunidades

Implementação local em 14/10/2026.

## Comportamento

- Cards do mural público em `/oportunidades`, de membros e da curadoria mostram um relógio compartilhado, atualizado a cada segundo e ao voltar para a aba.
- Bolsas, programas e demais chamadas contam até o encerramento das inscrições. O adaptador preserva o timestamp original para prazos com horário, normalizando o formato PostgreSQL para ISO.
- Cards da categoria `eventos` contam até `eventStartsAt`, independentemente do encerramento das inscrições. O início é opcional e pode ser cadastrado/editado no formulário administrativo com data, horário e fuso, ou somente data.
- Datas sem horário usam dias de calendário em Brasília. No dia informado, mostram “Evento hoje” ou “Encerra hoje”, com horário não informado. Nenhum horário é presumido.
- Sem início confirmado, eventos mostram “Data de início não informada”. Fluxos contínuos mostram “Sem prazo definido”.
- Ao zerar o horário exato, o contador mostra “Evento iniciado” ou “Inscrições encerradas”, sem valores negativos. Mais de 7 dias: verde. De 7 dias até o prazo: vermelho. Datas ausentes ou já ultrapassadas ficam neutras. A classificação de horários exatos usa o tempo real, antes do arredondamento dos segundos.
- A rota pública atual `/oportunidades` usa `OpportunitiesBoard`, compartilhado com os membros. Datas não são inferidas do título nem do prazo de inscrição.

## Dados e publicação

`0012_opportunity_event_start.sql` adiciona `opportunities.event_starts_at` como texto opcional para preservar a precisão da fonte (`YYYY-MM-DD` ou ISO com fuso). O campo passa pelo formulário, Server Action, validação do Radar, persistência, catálogo e adaptador do mural. Campos editados/removidos pelo administrador são preservados nas coletas seguintes. A data exige a categoria de eventos e o trecho de evidência no cadastro administrativo.

A migração está preparada e foi exercitada apenas no banco isolado PGlite. Não houve migração remota, push ou deploy. Antes de publicar, aplicar a migração no Radar seguindo o runbook de backup e autorização existente, depois atualizar Radar e Apogee. Eventos existentes sem início confirmado precisam de informação da fonte oficial para exibir essa contagem.

## Validação

- Apogee: `npm test` — 249 testes passaram.
- Radar: `npm test` — 128 testes passaram, incluindo migrações, persistência/edição/remoção do início, bridge e preservação após nova coleta.
- `npm run typecheck` em ambas as aplicações; ESLint direcionado aos arquivos alterados; `git diff --check`.
- Navegador local, com dados demonstrativos e conexão de banco apontada para endereço local inválido: segundos diminuindo; distinção entre início e encerramento; ausência de data; sem transbordamento horizontal em largura de 390 px. A rota temporária e seu tipo gerado foram removidos e o servidor foi encerrado.
- Não foi exercitado um cadastro real nem alterada uma oportunidade em produção.

## Teste manual local

Rota de demonstração: `http://127.0.0.1:3178/dev/oportunidades`. Disponível apenas com `NODE_ENV=development`; em produção responde 404. Usa somente dados fictícios e os componentes reais do mural. O botão “Reiniciar contadores” reinicia os exemplos, inclusive o encerramento em 15 segundos. O navegador confirmou a transição para “Inscrições encerradas”.

Servidor de demonstração restrito a `127.0.0.1`, com a conexão de banco sobrescrita para um endereço local inválido e as credenciais do Radar desabilitadas no processo. Sem migração ou escrita em dados reais.

## Ajuste de cores em 14/10/2026

Verde acima de 7 dias; vermelho em 7 dias ou menos (limite inclusivo adotado). No navegador local foram confirmados os valores de CSS vermelho `rgb(252, 165, 165)` e verde `rgb(134, 239, 172)`, com estados sem prazo neutros. Os 7 testes direcionados do contador passaram, incluindo limites de 7 dias em milissegundos e datas sem horário; typecheck e ESLint direcionado passaram. A demonstração inclui um prazo de 10 dias. Produção permanece sem atualização.
