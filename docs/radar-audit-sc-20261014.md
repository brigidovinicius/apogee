# Radar — auditoria e primeiro lote SC, 14/10/2026

Base de produção medida às 17h41 de Brasília: 348 IDs únicos públicos e administrativos, mesmos campos públicos, zero divergência; faltam 652. As 93 candidatas importadas estavam pausadas, sem verificação individual. Migrações 0022/0023 aplicadas. Checkout de dados Radar `900debf9db5cf161d37f16c9666e58a65b1a4126`; imagens Radar/Apogee `53d5072eb57d4b0fe539e8c4230ab32530045718`. Não confundir a importação de dados com nova imagem em execução.

## Auditoria do código

Revisão independente somente leitura encontrou e foram corrigidos:

- Prazo mencionado inválido/ambíguo era tratado como ausente em alguns eventos. Detector agora distingue menção e ausência e examina todos os contextos de candidatura, sem converter a data do evento em prazo.
- Encerramento explícito sem extração completa retirava a ficha mas não finalizava acompanhamento. Rechecagem guarda `closed` e evidência oficial; não simula encerramento após falha técnica.
- Retenção privada dependia de Resend habilitado. Limpeza de sete/30 dias agora funciona com envio desativado.
- Limite global de cadastros bloqueava confirmação/cancelamento. Os controles passam a ter orçamento próprio por token com hash.
- Horários textuais sem fuso ganhavam Brasília por inferência. Precisão fica somente data quando o fuso não está explícito.
- Nove vínculos do inventário relacionavam instituições sem prova a CNPq/MinC. Removidos; nenhuma fonte tinha sido ativada por esses campos.
- Página encontrada em fontes diferentes podia duplicar a edição. Bloqueio por URL compartilhada e por título nos catálogos preserva também tombstones; não substitui auditoria entre URLs diferentes.

## Lote de fontes

Evidência por URL, método, timestamp, HTTP, robots, hash, redirects e limitações: [source-audit-sc-20261014.json](../radar-academico/references/source-audit-sc-20261014.json). Método `operator_authorized_agent`; não preencher campos de auditoria humana.

| URL exata | Decisão proposta após checks e recuperação | Motivo/limitação |
|---|---|---|
| https://noticias.ufsc.br | Descoberta privada diária | Portal oficial, HTTP 200, robots ausente HTTP 404 permitido; notícias não provam oportunidade vigente. |
| https://www.ifsc.edu.br/editais | Descoberta privada diária | Hub oficial de editais, HTTP 200, robots permitido; evitar duplicação do coletor técnico já ativo. |
| https://fapesc.sc.gov.br | Descoberta privada diária | Portal oficial e hub de chamadas; links permanecem candidatos privados até auditoria de cada edição. |
| https://ifc.edu.br | Pausada | Página institucional ampla; selecionar rota de ingresso específica e evitar sobreposição com catálogo existente. |
| https://www.cieesc.org.br | Pausada | Redireciona ao domínio canônico; robots da URL original também redireciona e coletor recusa. Programa próprio de pré-aprendizagem consultado tem prazo encerrado em maio/2026, não é ficha vigente. Listas de empregadores não autorizadas. |
| https://www.acate.com.br/agenda-de-eventos/ | Coletor diário limitado às três edições auditadas | Agenda inclui eventos de terceiros. Allowlist de edições impede monitoramento/publicação deles. |

As três edições auditadas são Decola ACATE Startups Rio do Sul, 27/10/2026; Decola Lages, 29/10/2026; e Peopletech Summit, 21/10/2026. São encontros independentes, com página/data/local próprios. “Inscreva-se” consta no artigo oficial de cada edição; prazo final não informado. Cidade/SC vêm do local do evento, não da sede. Hora permanece textual por ausência de fuso expresso; retirada no começo do dia confirmado em Brasília. Não consultar Sympla/terceiros, afirmar gratuidade, inventar requisitos ou multiplicar workshops/ingressos/vagas.

## Validação e recuperação

189 testes Radar e 253 testes Apogee passaram, com typecheck e lint (Apogee: arquivos alterados). A migração 0024 passou na integração isolada com todas as migrações; validação CI ainda pendente nesta versão do registro. Nenhuma oportunidade fictícia, assinante ou novo teste de e-mail criado. Fluxo com assinante real permanece sem comprovação em produção.

Aplicação requer checkout limpo, SHA exato integrado, checks aprovados, dumps protegidos com checksum e restauração em bancos isolados com comparação das tabelas. Preservar imagens anteriores. Migração 0024 é aditiva; rollback mantém dados e pausa somente novas fontes/monitores. A Apogee precisa da correção do orçamento dos controles; nenhum outro fluxo do site é alterado.

Depois do lote, registrar SHA, backups, contagem por categoria/fonte, novas fichas/retiradas, paridade de IDs, preservação das 348 e chegada pela ponte real da Apogee. O alvo de 1.000 continua aberto. Prioridade SC somente até 18/10/2026; não há nova automação GitHub nem serviço pago.
