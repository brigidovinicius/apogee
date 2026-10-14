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

## Aplicação e resultado real do primeiro lote

PR #52 integrado e quatro checks do CI 38639760565 aprovados. SHA aplicado nos dois serviços e no scheduler: `b8731c4e845d4a292b4f0b8ad03b49680506ce9c`; checkouts limpos, serviços saudáveis e nenhuma porta dos aplicativos publicada. Migração 0024 aplicada. Apenas web/scheduler necessários foram recriados; banco, Caddy, certificados, volumes e outros projetos preservados.

Backup protegido `/opt/apogee-backups/radar-audit-sc-20261014T212301Z`: checksums aprovados e restauração isolada comparou as **13 tabelas Radar e 14 tabelas Apogee**, sem divergência. A primeira saída do contador incluiu também as consultas SQL geradas; os totais acima contam somente linhas reais de tabelas. Recuperação removeu os bancos temporários. A imagem anterior `53d5072eb57d4b0fe539e8c4230ab32530045718` foi preservada.

Teste adicional com cópia do dump e imagem exata: criar ficha real ACATE, rejeitar duplicata e versão antiga, editar, coletar novamente da fonte oficial, preservar edição, excluir logicamente e impedir reaparecimento/recriação. APIs público/admin idênticas. Ambiente isolado sem portas publicadas e envio desativado; zero assinantes/e-mails. Contêiner, banco e ambiente temporário removidos após o teste.

O primeiro comando de migração consumiu o restante da entrada SSH. A Apogee e a migração concluíram; a troca do Radar e retomada do scheduler foram executadas em comando separado e verificadas. Os próximos comandos de migração devem usar entrada `/dev/null`.

**Medição de produção em 14/10/2026 às 18h48 de Brasília: 351 IDs únicos públicos e 351 administrativos, mesmos campos públicos e nenhuma divergência.** Entraram três edições ACATE, nenhuma retirada e todas as 348 fichas anteriores foram preservadas. Faltam **649** para 1.000. Primeiro ciclo real ACATE: quatro páginas, três criadas, zero falhas. As três chegaram à API pela ponte real do contêiner Apogee.

| Categoria | Fichas vigentes |
|---|---:|
| Formação e aprendizagem | 257 |
| Bolsas e apoios financeiros | 85 |
| Intercâmbios | 3 |
| Competições e hackathons | 2 |
| Pesquisa e inovação | 82 |
| Carreira e experiência | 4 |
| Eventos e comunidades | 5 |

Categorias se sobrepõem e não devem ser somadas para a meta. Fontes anteriores mantiveram suas contagens; `acate-audited-events` acrescentou três fichas. UFSC/IFSC/FAPESC foram ativadas apenas como descoberta privada. Das 93 candidatas importadas, três estão auditadas/ativadas e **90 continuam pausadas**: IFC requer listagem específica; CIEE exige auditoria do endereço canônico e não possui inscrição vigente no programa próprio consultado; as outras 88 ainda não receberam auditoria individual.

Configuração protegida conferida sem exibir valores: Resend/remetente habilitados, teto 50 tentativas/dia, tokens público/admin diferentes e RLS das três tabelas privadas. Há zero assinantes e zero mensagens. O teste com assinante real em produção permanece sem comprovação e não foi feito novo envio. A verificação visual anterior confirmou 348 e as categorias existentes; a inspeção visual posterior foi bloqueada pela política do navegador, sem contornar o bloqueio. Integração posterior validada pela API.

Rollback: pausar scheduler e somente fonte ACATE/três novos monitores, voltar às imagens anteriores preservando tabelas e dados. Reconciliar quaisquer dados posteriores ao backup antes de restauração integral. A meta continua aberta; próximos lotes começam pela qualificação IFSC, com cursos/vagas e inscrições comprovadas.

## Segundo lote — qualificação IFSC

URL exata `https://www.ifsc.edu.br/qualifica`, HTTP 200 sem redirect, robots permitido e inscrição no sistema oficial do IFSC. Editais 24 a 27/2026/2: inscrições de 7 a 27/10/2026, gratuidade e oito cursos reais. Adaptador limitado à edição 2026.2; Jogos de Tabuleiro consolida os dois turnos em uma ficha. Câmpus não comprova local de aula: geografia estruturada permanece vazia; requisitos específicos remetem aos editais. Nenhuma afirmação de remuneração ou auxílio.

Fonte/evidência: `references/source-audit-ifsc-qualification-20261014.json`; migração aditiva 0025. Falha de estrutura preserva evidência anterior; vagas zeradas, suspensão no bloco Edital e curso/turma cancelados retiram as ofertas afetadas. Avisos condicionais de cancelamento não equivalem a fato ocorrido.

192 testes Radar passaram; typecheck/lint aprovados. Após o ajuste final de avisos condicionais, três regressões do adaptador passaram novamente. Normalização do HTML oficial salvo confirmou oito candidatos com gates aprovados. Revisão independente estática sem bloqueador. CI, backup/recuperação, aplicação e contagem real deste lote ainda pendentes.
