# Radar: diagnóstico das retenções e correções de extração

## Estado confirmado em 04/11/2026

A conferência somente leitura encontrou coletor e agendador em `343dfd413829583c7981debaf12c7e35fc221d7c`, saudáveis/em execução e sem reinícios. A API pública respondeu 200 com 1.031 oportunidades. O cruzamento de IDs confirmou **12 fichas criadas nas últimas 24 horas ainda visíveis no catálogo**. O zero informado no acompanhamento anterior dizia respeito à janela curta após a implantação, não ao dia inteiro.

Nos seis ciclos concluídos da amostra após a implantação houve 131 avaliações de links, zero novas fontes cadastradas e zero publicações pelo processador de descoberta. Esse processo é distinto da ingestão das fontes já cadastradas. Encontrar um link, reavaliá-lo e criar uma nova ficha não são a mesma métrica.

Principais motivos nos registros processados nas últimas 24 horas, às 22h08:

| Motivo | Registros | Interpretação |
|---|---:|---|
| `candidate_unconfirmed` | 633 | Motivo amplo que misturava dados incompletos, páginas antigas e falhas de leitura |
| `unsupported_content` | 121 | Formatos sem extração validada, incluindo documentos e mídia |
| `request_timeout` | 95 | Fonte sem resposta dentro do orçamento disponível |
| `source_authority_unverified` | 75 | Origem/organizador do destino não confirmado pelas regras atuais |
| `irrelevant_link` | 68 | Navegação ou link sem indicação suficiente de oportunidade |
| `listing_or_ambiguous` | 21 | Listagem ou página sem oportunidade individual identificável |

Essas contagens não demonstram que todas as retenções sejam corretas. A auditoria reproduziu a leitura de dez páginas públicas com o transporte protegido do Radar, sem banco ou publicação, e repetiu a análise offline sobre os mesmos bytes.

## Causas reproduzidas e corrigidas

1. O prazo aceitava somente datas numéricas. Datas por extenso com ano explícito, como `10 de novembro de 2099` nos testes, eram ignoradas. A correção converte a escrita da data, valida o calendário e preserva a precisão do horário. Não deriva ano da data de publicação, realização do evento ou relógio atual.
2. O leitor podia selecionar uma data posterior de resultado ou realização em cronogramas, em vez do encerramento das inscrições. Agora considera o prazo ou intervalo de candidatura e separa resultados, classificação, recursos e matrícula. Prazos conflitantes, datas impossíveis e horários inválidos ficam retidos.
3. Notícias do tema CPS sem `main`/`article`, páginas com notícias relacionadas e títulos repetidos de capas do WordPress eram descartadas. A leitura agora isola esses formatos quando existe um único conteúdo identificável. Títulos diferentes, múltiplas fichas e formatos ainda desconhecidos continuam retidos; não se usa o texto inteiro do site como fallback.
4. O diagnóstico ocultava a causa de falhas genéricas. Prazo ausente, vencido, rota de candidatura não confirmada e layout não reconhecido passam a ter motivos específicos. O painel usa “Publicação automática retida” para não declarar inelegível aquilo que ainda não foi confirmado.

A versão 5 permite uma reavaliação dos bloqueios de extração compatíveis da versão 4. Bloqueios de autoria/conteúdo já verificados na versão 4 não recebem outra tentativa apenas por essa mudança. Permanecem quatro tentativas máximas, orçamento de rede, alternância de alvos, leases, idempotência, decisões administrativas e verificação da cadeia oficial. Não há migração, fonte ativada manualmente ou reset de contadores.

## Evidências reais e retenções legítimas

| Página oficial | Resultado da análise corrigida |
|---|---|
| [ICIF/CPS 2026](https://arinter.cps.sp.gov.br/8-concurso-cif-2026/) | Layout reconhecido; prazo real 02/11/2026 às 23h59, já encerrado |
| [PROMAIPS 2027](https://arinter.cps.sp.gov.br/promaips-2027-1/) | Layout reconhecido; prazo real 13/10/2026 às 23h59, já encerrado |
| [Chamada de pesquisa SEE/MG](https://www.educacao.mg.gov.br/chamada-publica-para-a-inscricao-de-projetos-de-pesquisa-sobre-a-educacao-basica-segue-aberta-ate-6-de-novembro/) | Notícias relacionadas separadas; o prazo é 06/11/2023, não 2026 |
| [OBOFog/NOIC](https://noic.com.br/obo/foguetes/) | Título duplicado reconhecido; a página não confirma prazo e candidatura suficientes |
| [Hackathon UFMS](https://www.ufms.br/inscricoes-para-o-2o-hackathon-do-nucleo-de-formacao-cidada-vao-ate-9-de-novembro/) | A leitura genérica carece de prazo com ano; a oportunidade já existe na API pública como “2º Hackathon do Núcleo de Formação Cidadã — UFMS 2026” |
| [SOIF 2027](https://www1.fisica.org.br/olimpiada/2026/index.php/15-soif/391-soif-2027-inscricoes-abertas) | Texto da página sem prazo suficiente; imagens/documentos exigem extração validada |
| [Encontro COTIL](https://www.cotil.unicamp.br/2026/11/03/encontro-de-estudos-culturais-e-de-literatura-africana-acontece-no-dia-14-de-novembro/) | A leitura atual não confirma início completo e disponibilidade de participação para a exceção de evento sem prazo |
| [Olimpíada Itabirana](https://olimpiadaitabirana.com.br/noticias/detalhe/olimpiada-itabirana-de-matematica/) | Notícia de 2025, sem ano explícito no prazo extraível; não promover como chamada atual |
| [ABDC 2026](https://www.abdireitocivil.com.br/edital-das-etapas-qualificatorias-da-xiii-olimpiada-do-conhecimento-juridico-abdc-2026/) | Layout ainda não reconhecido; página de lançamento de etapas qualificatórias de abril a junho |
| [Bolsa IHS/OBMEP](https://www.obmep.org.br/bolsa-ihs.htm) | Layout ainda não reconhecido; a auditoria não comprovou chamada atual publicável |

Os quatro casos em que o layout deixou de impedir a leitura não se tornaram automaticamente novas oportunidades elegíveis. Na amostra auditada, não foi identificada uma ficha nova atualmente publicável. O código corrigido foi validado com oportunidades sintéticas válidas; isso não deve ser apresentado como publicação real.

## Validação e isolamento

- Antes das correções, nove regressões falharam para prazo por extenso, cronograma, conflito, estado de inscrição, layouts e publicação automática. Mais duas regressões reproduziram motivos genéricos incorretos; a revisão também cobriu números e horários malformados.
- Resultado final: **600 testes aprovados, 35 condicionados/ignorados**, nenhuma falha. Inclui PostgreSQL embutido isolado: descoberta → cadastro de fonte → publicação → idempotência, reavaliação única da versão 4 e preservação de bloqueios de autoria/tentativas esgotadas.
- Lint, typegen, TypeScript e build standalone do Radar aprovados. Todas as tarefas npm foram sequenciais pela fila global; nenhuma dependência ou migração foi adicionada.
- Dez páginas foram consultadas em duas amostras limitadas; replays usaram os mesmos arquivos capturados. As páginas completas e relatórios privados permanecem ignorados em `.local/audit/`.
- Worktree próprio `radar-retention-repair-20261104`, branch `fix/radar-retention-repair-20261104`, base `343dfd4`. Dependências em cópia APFS independente. O candidato regional `51c54a7` e sua branch foram preservados, sem testes, build ou edição no seu worktree.
- Produção foi consultada somente por leitura. Esta correção ainda é local; CI, PR e deploy do novo SHA permanecem pendentes. O deploy deve atingir somente Radar web/scheduler após autorização e validação remota.

Logs e evidências: `.local/validation.json`, `.local/audit/regression-red.log`, `.local/audit/reasons-red.log`, `.local/audit/final-summary.json` e `.local/audit/final-*/report.json`.
