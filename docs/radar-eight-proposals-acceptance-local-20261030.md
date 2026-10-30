# Validação local dos oito pontos — 30/10/2026

Versão testada: `4c11f50`, branch `feat/radar-calendarios-local-20261029`. Nenhuma alteração funcional foi necessária nesta rodada. Produção, deploy e push permaneceram fora do escopo. O preview continuou ativo em `http://127.0.0.1:4381`.

| Proposta | Resultado | Evidência e limite |
| --- | --- | --- |
| Radar e calendários usando a mesma base | Aprovado | Catálogo aberto, calendário e painel leem `opportunities`; o calendário amplia o filtro de status para acompanhamento. Os quatro IDs permaneceram iguais após nova coleta, sem cadastro paralelo nem duplicação. O mesmo ID da oportunidade fictícia foi visto no card, URL pública, detalhe autenticado, salvo e ICS. |
| Separar tipo, subtipo e área | Aprovado | Campos independentes no dado e no editor. Quatro fichas conferidas no painel: formação/vestibular para Unicamp e Fuvest; competições/olimpíada para OBMEP e OBI; Matemática e Tecnologia somente onde confirmadas. Filtro Matemática no Radar passou de três para dois cards; limpar restaurou três. Dados antigos sem evidência não foram classificados artificialmente. |
| Calendários de Olimpíadas e Vestibulares | Aprovado | Rotas reais, próximas etapas, filtro por área e estado vazio verificados. Tecnologia no calendário de olimpíadas mostra somente a OBI. Vestibulares mostra Unicamp, Fuvest e o exemplo fictício, distinguindo acompanhamento de inscrição. |
| Edições e etapas | Aprovado | 45 etapas nas quatro fontes: OBMEP 8, OBI 16, Unicamp 13 e Fuvest 8. Inscrição, prova, resultado e matrícula permanecem distintos; virada para 2027 e horários existentes preservados. Nenhum horário preenchido quando ausente. |
| Cards mais limpos e títulos melhores | Aprovado no recorte testado | Cards com título, instituição, informação essencial e data de conferência; campos protegidos ficam no detalhe. Sem transbordamento horizontal em 1280 px. A limpeza de títulos também tem cobertura automatizada. Qualidade editorial de todo o acervo não é inferida a partir das fichas locais. |
| Ampliar e diversificar fontes | Aprovado no ambiente local | Nova coleta real sequencial de OBMEP, OBI, Comvest via Portal Unicamp e Fuvest via Jornal da USP: quatro páginas, quatro registros extraídos. OBI respondeu nesta rodada, superando a falha de rede anterior. Robots, TLS, DNS e escopo não foram relaxados. Nenhuma ativação em produção. |
| Detalhes públicos, URLs legíveis e SEO | Conforme a decisão comercial | URLs legíveis, título, descrição, canonical, sitemap, redirecionamento de slug antigo e ausência de dados protegidos no HTML público verificados. Apresentação pública acessível; detalhes completos continuam exigindo login/permissão. Conta gratuita abre uma oportunidade por ação explícita, reabre a mesma e encontra a oferta ao tentar uma segunda. Indexação e desempenho em buscadores não podem ser comprovados em localhost. |
| Salvar, calendário pessoal e assinatura `.ics` | Aprovado | Ações reais HTTP: salvar, repetição idempotente, listar etapas, remover com cancelamento, salvar novamente conservando UIDs, gerar link privado, rotacionar e invalidar link antigo. Revogação de acesso bloqueia feed e calendário pessoal. Conta gratuita não recebe esses recursos. |

## O que foi executado nesta rodada

- **48 verificações HTTP locais aprovadas**: 18 de rotas públicas/SEO/filtros, 21 de login/permissões/salvos/ICS e 9 do painel integrado em leitura.
- **Quatro coletas reais adicionais aprovadas**, uma por fonte, pela API editorial do backend local já em execução, com limite de uma página e um candidato por chamada.
- Conferência do banco após coleta: mesmos quatro IDs, 45 etapas, inscrições encerradas e nenhuma conta QA remanescente.
- Navegação no navegador: filtro e limpeza no Radar, card → URL legível → detalhe autenticado como `local_vitalicio`, calendário de olimpíadas com filtro Tecnologia e data de conferência atualizada.
- **984 testes automatizados já aprovados na mesma versão** na rodada imediatamente anterior: 539 Apogee, 430 Radar e 15 PostgreSQL. TypeScript, lint e builds já passaram nessa versão. Eles não foram reexecutados nem somados às verificações HTTP desta rodada, pois não houve alteração funcional.

O campo `blocked: 1` retornado em cada coleta refere-se à publicação na vitrine de inscrições abertas: todas as inscrições terminaram. Não é bloqueio de robots ou erro de extração. Cada chamada retornou `discovered: 1`, e os registros permanecem disponíveis no calendário com suas próximas etapas.

## Isolamento e limites

As ações de gravação usaram contas locais descartáveis. A conta vitalícia existente não teve salvos, token ICS, sessão ou conexão Google alterados por estes testes. Contas QA foram removidas com seus dados vinculados; a sessão vitalícia existente foi confirmada no navegador. O painel foi lido com administrador temporário, sem editar as quatro fichas.

Esta rodada valida o protocolo e ciclo de vida do ICS pelo endpoint real. Não repetiu sincronização em clientes Mac/Google externos nem realizou novas gravações na agenda Google. O teste anterior da integração Google com API simulada e as validações reais anteriores estão nos relatórios próprios. Edições futuras e retificações publicadas em outras páginas não são descobertas automaticamente por estes adaptadores vinculados à edição.

## Evidências

- [Resultados estruturados](radar-eight-proposals-evidence-20261030.json).
- [Implementação das fontes alternativas e bateria automatizada](radar-calendar-alternatives-local-20261030.md).
- Scripts e resultados locais: `.local/radar-calendar/qa-eight-points.py`, `qa-eight-admin.py`, `qa-http.py`, `qa-eight-*-results.json`, `qa-eight-live-sources.json` e `qa-eight-source-snapshot.json`. Scripts recusam banco fora de `127.0.0.1:48763`, verificam marcador e usam somente requisições locais para as ações da aplicação. Cookies e tokens ICS não foram impressos nem incluídos neste relatório.
- Capturas no diretório de visualizações desta tarefa: `checklist-radar-cards-20261030.png` e `checklist-calendario-area-20261030.png`.

Não foram identificadas falhas funcionais bloqueantes nos fluxos exercitados. A publicação integral dos detalhes continua deliberadamente desativada conforme a escolha comercial do usuário.
