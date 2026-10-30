# Radar e calendários — validação local

Estado posterior das fontes: [coletores e bateria completa local](radar-calendar-collectors-local-20261029.md). OBMEP/OBI foram homologadas e importadas somente no ambiente local; Comvest/Fuvest permanecem bloqueadas para coleta real. As pendências de fontes descritas abaixo registram a primeira entrega.

Validação ampliada posterior: [relatório de testes de 29/10/2026](radar-calendarios-testes-20261029.md). Os números da primeira rodada abaixo são históricos.

## Escopo acordado

- Manter uma oportunidade gratuita por conta e o acesso vitalício existente. Nenhum detalhe protegido entra em páginas públicas, metadados ou calendários anônimos.
- Evoluir o catálogo existente com classificação independente de benefício, áreas explícitas, edições e etapas com evidência. Campos desconhecidos continuam desconhecidos.
- Calendários de Olimpíadas e Vestibulares sobre os mesmos registros; inscrição encerrada não significa fim das etapas.
- Simplificar cards, reduzir atualização de contadores e acrescentar descoberta por área.
- Salvos e calendário pessoal aproveitam contas e direitos de acesso existentes; assinatura ICS privada para acesso vitalício.
- Preservar publicação automática, controles administrativos e identidade das fichas.
- Preparar novas fontes sem ativação automática nem migração de dados reais.

## Validação e publicação

Somente implementação e testes locais foram autorizados. Não fazer push, deploy, migração remota, publicação de preview ou ativação de fonte. A publicação depende de testes e validação pelo usuário.

## Arquivos e camadas

1. Radar: contrato de descoberta, persistência opcional, leitura de calendários, migração aditiva e validação do editor.
2. Apogee: transporte, filtros, cards, calendários públicos e detalhes com acesso existente.
3. Membros: salvos e feed privado, migração aditiva, verificação de direitos em toda leitura/mutação.
4. Testes: calendário e fuso, conteúdo protegido, acesso gratuito/vitalício, ICS, validação e persistência de etapas.

## Fontes candidatas

- OBMEP: https://www.obmep.org.br/ — página oficial consultada em 29/10/2026; a edição 2026 já está na fase de resultados. Confirmar calendário e regras de coleta antes de qualquer ativação. Não inferir inscrições de 2027.
- Fuvest: https://www.fuvest.br/vestibular-da-usp/ — consulta retornou HTTP 403. Não ativar nem preencher datas a partir de suposições.

Os calendários vazios devem explicar a ausência de datas confirmadas, sem conteúdo fictício.


## Ampliação de fontes preparada

A lista local `radar-academico/references/calendar-source-candidates-20261029.json` documenta quatro candidatas, sem ativá-las. A [OBMEP](https://www.obmep.org.br/calendario.htm) tem calendário anual; a [OBI](https://olimpiada.ic.unicamp.br/calendario/datas_importantes) exige separar modalidade, nível e inscrição da escola/competidor; a [Comvest](https://www.comvest.unicamp.br/ingresso-2027/vestibular-2027/) exige preservar a diferença entre vestibular e ingresso pelo Enem. São páginas oficiais consultadas, ainda sem homologação do coletor. A Fuvest permanece bloqueada por HTTP 403.

Não foi alterada a composição do catálogo real. A ativação e os extratores específicos continuam pendentes da validação dessas fontes. As classificações conservadoras dos coletores existentes são atualizadas em novas coletas, sem uma reclassificação em massa dos dados atuais.

## Migrações e disponibilidade

- Radar: `0043_opportunity_discovery.sql`, aditiva. Armazena classificação, edições e etapas no próprio registro e permite a leitura de próximas etapas quando a inscrição já fechou.
- Membros: `0008_radar_calendar.sql`, aditiva. Salvos por conta, histórico dos eventos exportados e apenas hash dos tokens privados.
- O calendário pessoal fica **desabilitado por padrão**. A variável privada `RADAR_CALENDAR_PERSONAL_ENABLED=true` só deve ser configurada após a migração correspondente em ambiente de teste aprovado. Acesso exige os direitos vitalícios/admin/legado existentes. O acesso gratuito aos detalhes continua com uma oportunidade.
- As migrações foram inicialmente exercitadas em PGlite e posteriormente em PostgreSQL real exclusivamente local, nos bancos isolados de homologação. Nenhum banco remoto foi migrado.
- A assinatura ICS exige revalidação do direito de acesso a cada consulta; a rotação invalida o link anterior. O feed usa `private, no-store`, e indisponibilidade do Radar responde 503 em vez de cancelar tudo.
- Antes de qualquer futura publicação, validar uma conta gratuita, uma vitalícia e uma revogada em ambiente de teste, edição de etapas pelo painel e sincronização real no Google/Apple/Outlook. Revisar o proxy de produção para não registrar tokens de `/meu-calendario/` nos logs; a aplicação já os omite dos logs de desenvolvimento.


## Evidência da versão local (29/10/2026)

- `npm run test --prefix make-it-fly-current`: **512 aprovados, zero falhas**.
- `npm run test --prefix radar-academico`: **368 aprovados, 15 ignorados** por condições externas já previstas pela suíte; zero falhas.
- `npm run typecheck` e `npm run lint` nas duas aplicações: sem erros. O Apogee conserva um aviso preexistente de `<img>` na administração da galeria.
- `APOGEE_LOCAL_PREVIEW=1 npm run build --prefix make-it-fly-current` e `npm run build --prefix radar-academico`: builds concluídos, um processo por vez pela fila obrigatória.
- Banco em memória: migração aditiva, preservação de etapas na recoleta, retirada de fonte conflitante/excluída, isolamento dos salvos por conta, unicidade dos tokens e exclusão em cascata.
- Regras: acesso gratuito/vitalício preservado; nenhum requisito ou URL protegida nos dados públicos; calendário sem inventar prazo; encerramento da inscrição separado de prova/resultado; token inválido/revogado bloqueado; ICS com UID estável, fuso, data sem horário, escape, linhas UTF-8 e cancelamento. Histórico do feed guarda somente ID, título e etapa, sem repetir a ficha completa a cada data.
- Chromium/Playwright com **dados fictícios explícitos**, API de teste e servidor apenas em `127.0.0.1`: páginas em 1440 px e 375 px sem transbordamento horizontal; três etapas de olimpíada; vestibular encerrado com duas próximas etapas e sem prazo legado; filtro com estado vazio; URL antiga redirecionando no navegador para a canônica; detalhes anônimos redirecionando ao login; feed inválido retornando 404 e `private, no-store`.
- Inspeção do HTML/RSC público não encontrou os marcadores privados da fixture. Console sem erro de aplicação; avisos de preload de CSS e um 404 intencional no teste do token inválido.
- O primeiro preview temporário foi substituído pelo ambiente persistente de homologação, mantido ligado para revisão. Nenhum processo de outro projeto é interrompido.

### Pendências para homologação

1. Revisão visual do usuário, incluindo dispositivo físico e preferências para a densidade das etapas.
2. A edição completa pelo painel conectado ao serviço editorial segue pendente. Login, contas gratuita/vitalícia/revogada, salvar/remover/rotacionar já foram validados no ambiente local; consultar o relatório ampliado.
3. Assinatura real em aplicativos externos, incluindo alteração e cancelamento de etapa. Os testes locais verificam o arquivo ICS, não o comportamento de cada provedor.
4. Validar robots, extração, retificações e deduplicação de cada nova fonte antes de ativação; a diversificação do catálogo real ainda não foi publicada.
5. Após a homologação, obter autorização expressa de publicação. Não houve push, deploy, migração remota ou nova fonte ativada nesta tarefa.
