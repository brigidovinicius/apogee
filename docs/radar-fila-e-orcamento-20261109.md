# Radar — fila e orçamento de processamento, 09/11/2026

## Diagnóstico confirmado

Consulta somente leitura em produção às 13h03 (Brasília): nas últimas 24 horas houve 1.188 avaliações de links e nenhuma criação/publicação pelo processador de descoberta. Não havia lease ativa ou expirada. A fila tinha 4.722 pendências, 243 retentativas e 1.722 retenções; 4.953 pendências/retentativas estavam elegíveis para processamento. Nenhum link novo foi registrado nesse intervalo. O agendador e o coletor estavam ativos em `314f2c7`.

Motivos das avaliações: formato não reconhecido 279, prazo insuficiente 264, timeout 255, conteúdo não suportado 109, tentativas esgotadas 79, autoria não comprovada 63 e prazo vencido 47, além de motivos menores. Esses números não demonstram que toda retenção seja indevida. As fontes cadastradas também registraram 349 falhas de página/reconsulta, concentradas em evidência não confirmada e HTTP 404.

A amostra pública inclui notícias de 2012 e 2024, resultados e páginas sem candidatura comprovada. As chamadas CNPq 34/2026 e 36/2026 têm intervalos explícitos de inscrições, mas seus resumos HTML não comprovam sozinhos o canal de submissão. Não foi concedida autorização de publicação a partir apenas do título, do domínio ou de um prazo. Não foram relaxados robots, DNS, TLS, tamanho, autoria ou evidência.

## Defeitos reproduzidos

1. A seleção de um lote e toda a cadeia de cada candidato compartilhavam o mesmo prazo absoluto de 90 segundos. Um candidato iniciado após 75 segundos recebia só 15 segundos para alvo, robots e detalhes. A auditoria encontrou timeouts de 1–7 segundos; a regressão reproduziu o prazo reduzido, sem simular uma indisponibilidade da fonte. Esse corte podia consumir tentativas de consulta sem dar o tempo completo ao candidato.
2. A ordenação privilegiava antiguidade. Um acervo de mais de 24 links antigos do mesmo alvo podia ocupar o lote inteiro e impedir uma chamada recém-descoberta de ser examinada. Uma regressão com banco isolado reproduziu a ausência de publicação dessa chamada no primeiro lote.

## Correção

A seleção continua limitada a 90 segundos e 24 candidatos, com diversidade de alvos. Antes de reservar um candidato, o processador exige espaço para uma cadeia completa de 90 segundos e cinco segundos de margem para a reserva. A etapa pode deixar o último candidato terminar, com teto de 185 segundos; a rota fornece um limite de 240 segundos desde o início da requisição para preservar margem antes do timeout de 300 segundos do agendador. Cada requisição HTTPS mantém o limite de 15 segundos e as demais políticas de transporte.

Se o banco consumir essa margem depois da reserva e antes de qualquer consulta à fonte, o candidato retorna à fila com `processing_budget_exhausted`, para nova tentativa em cinco minutos. Somente essa reserva não iniciada é devolvida: não conta como falha da fonte e não gasta uma das quatro tentativas reais. O evento registra `attempt_consumed=false`. Timeouts reais continuam com backoff e bloqueio na quarta tentativa. Não há reset ou reabertura em massa de retenções anteriores.

A cota de reavaliação ocupa o primeiro lugar de cada grupo de quatro, com tempo disponível. O segundo lugar privilegia chamadas recentes; os demais continuam atendendo o acervo antigo. A preferência por sinais de candidatura precede antiguidade. Nenhum candidato recebe exceção por URL, instituição ou ano presumido.

A política de processamento é registrada como versão 2. A versão de extração permanece 6; a mudança não reabre todos os bloqueios de conteúdo/autoria já examinados. O agendador passa a registrar separadamente adiamentos por orçamento.

## Validação e isolamento

As três regressões iniciais falharam antes da correção. A suíte final cobre janela completa do candidato tardio, falta de margem no processo pai, atraso do banco antes de consultar a fonte, devolução da reserva, quarta falha real, alternância recente/antigo, publicação/idempotência e decisões administrativas.

Validação local concluída: **612 testes aprovados e 35 condicionados/ignorados**; lint, typegen, TypeScript e build standalone aprovados. Comandos serializados pela fila global. Não há migração nem dependência nova.

Worktree exclusivo `radar-retention-20261109`, branch `fix/radar-retention-20261109`, base `8f9b031` de `origin/main`. A versão de busca publicada pela outra sessão, `ede5733`, e o trabalho do blog não são editados. O escopo é somente o coletor, a rota interna, seus testes e este diagnóstico. A implantação, quando validada, deve preservar o site e os demais serviços.

Evidências locais ignoradas: `.local/audit/baseline.json`, `.local/validation/red.log`, `.local/validation/green.log`, `.local/validation/test.log` e `.local/validation/validation.json`. Nenhuma publicação nova deve ser alegada a partir desses testes: ela exige confirmação de criação por ciclo nativo e novo ID visível no catálogo.
