# Sincronização real Google Agenda e Calendário do Mac — 30/10/2026

Validação executada no worktree `radar-calendarios-local-20261029`, sobre `8ad0c7b`, sem alterações funcionais no código, produção ou deploy. Resultado: criação, atualização, repetição sem duplicação, cancelamento de etapa e cancelamento ao remover dos salvos confirmados nas integrações reais.

## Escopo isolado

- Aplicação: `http://127.0.0.1:4381`, banco `apogee_radar_calendar_local` em `127.0.0.1:48763`, marcador `apogee-radar-calendar-local-v1` conferido antes das gravações.
- Google: conta fictícia vitalícia já conectada, agenda secundária existente **Apogee — TESTE LOCAL**. Autorização OAuth existente preservada, com escopo `calendar.app.created`. Nenhum convite, participante ou alerta criado.
- Mac: assinatura existente **Apogee QA local 29-10**, pertencente à conta fictícia administradora, armazenada **Em Meu Mac**, atualização configurada a cada cinco minutos. URL privada existente reutilizada, sem rotacionar token.
- Nova oportunidade sintética: `radar-demo-real-sync-20261030`, título **QA Sync 30-10 — Olimpíada fictícia**. As oportunidades salvas anteriores das duas contas foram comparadas antes/depois e preservadas.

O ambiente estava desligado no início. O PostgreSQL e o preview foram reabertos usando os scripts locais existentes, sem recriar os dados. A fila npm estava vazia antes do início; o preview foi iniciado pela fila e continua aberto. O aviso da assinatura local desapareceu após a atualização. Os avisos preexistentes de outras contas do aplicativo Calendário não foram tratados nem suas configurações alteradas.

## Casos observados

| Caso | Google Agenda real | Calendário do Mac real |
| --- | --- | --- |
| Salvar a oportunidade | Dois eventos confirmados na agenda secundária, consultados pelo conector independente | Prova de 06/11/2026, 14h–15h BRT, e resultado de 07/11, dia inteiro, visíveis no aplicativo |
| Alterar prova para 08/11, 16h–17h BRT | Mesmo identificador de evento, nova data e horário | Nova data recebida automaticamente, sem atualizar manualmente após a mudança; data antiga vazia |
| Repetir sincronização | Botão **Sincronizar agora** clicado na interface com a conta vitalícia; confirmação **Calendário atualizado**; continuam apenas dois eventos ativos | UIDs estáveis no feed e nenhuma duplicação visual na data antiga |
| Remover apenas a etapa resultado | Sincronizador periódico local marcou o resultado `cancelled`, preservando a prova ativa | Resultado exibido como **CANCELADO**, após atualização do aplicativo |
| Remover oportunidade dos salvos | Prova e resultado `cancelled`, confirmados por leitura dos respectivos IDs no Google | Prova e resultado cancelados, com texto riscado; assinatura continua ativa |
| Preservação | Os dois eventos anteriores de **QA Google 29-10** continuam ativos nas datas originais | As 12 opções de visibilidade temporariamente ocultadas foram restauradas; nenhuma agenda pessoal foi editada |

Horários da evidência, em Brasília: atualização solicitada às 10h09 e observada automaticamente no Mac às 10h10; remoção da etapa às 10h10min51s; ciclo automático do Google concluído às 10h11min29s; remoção dos salvos às 10h12; cancelamento final no Mac confirmado às 10h12min29s.

Para testar o ciclo automático do Google sem esperar o intervalo completo, somente `next_sync_at` da conexão fictícia foi antecipado no banco local. O temporizador real do preview executou a sincronização; não foi chamado o botão de sincronização entre a remoção da etapa e a confirmação no Google. Isso valida o mecanismo periódico, sem medir o intervalo completo de 15 minutos. No Mac, a mudança de data foi observada sem atualização manual; as etapas de criação e cancelamento também foram conferidas usando **Atualizar Calendários**.

A preparação inicial da fixture usou um timestamp Python com seis casas decimais, rejeitado pela validação de enriquecimento. O dado de teste foi corrigido para milissegundos antes da validação das duas etapas. O evento de prazo legado criado nessa preparação foi cancelado pelas integrações e permaneceu apenas no histórico. Não foi necessária mudança no código do produto.

## Evidências e verificações

16 verificações de consistência passaram, além da inspeção visual no aplicativo nativo e na interface do Radar: IDs estáveis, data/hora, dia inteiro com fim exclusivo, ausência de duplicações, cancelamento parcial/final, ausência de participantes/alertas, preservação dos salvos anteriores e nenhuma falha de sincronização registrada.

Artefatos privados, ignorados pelo Git, em `.local/radar-calendar/`:

- `qa-real-sync.py`: ações reais HTTP de salvar/remover/sincronizar, com autenticação de teste e bloqueio de redirects externos.
- `real-sync-results.jsonl`, `real-sync-google-evidence.json` e `real-sync-assertions.json`: resultados locais e leituras independentes do Google.
- Cookies e URL privada ICS guardados em arquivos de modo `0600`, sem conteúdo reproduzido neste documento.

Capturas em `/Users/viniciusbrigido/.codex/visualizations/2026/10/29/01a1879e-bea0-7231-902b-c764c7d6e134/`:

- `mac-real-sync-inicial-3010.png`
- `mac-real-sync-dia-inteiro-3010.png`
- `mac-real-sync-atualizado-3010.png`
- `mac-real-sync-etapa-cancelada-3010.png`
- `mac-real-sync-cancelado-3010.png`
- `radar-google-sync-real-3010.png`

Estado final: a nova oportunidade de teste foi removida dos salvos nas duas contas; os eventos ficaram cancelados, sem apagar as agendas. A conexão Google e a assinatura Mac anteriores continuam disponíveis. O preview permanece aberto com a conta vitalícia. A assinatura local depende do servidor local em execução; a sincronização é do Radar para as agendas, sem editar o Radar a partir delas. No Mac, cancelamento é representado por evento riscado, não por desaparecimento do histórico.

Não houve nova execução da suíte completa de regressão: esta rodada foi dedicada às integrações externas reais e não modificou código funcional. Os resultados da suíte anterior estão documentados separadamente em `radar-eight-proposals-acceptance-local-20261030.md`.
