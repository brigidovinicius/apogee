# Radar Apogee — resultado real de produção, 14/10/2026

Medição UTC: `2026-10-14T23:06:21.498Z`. **1004 fichas únicas vigentes públicas e administrativas, mesmos campos públicos, nenhuma divergência. Distância até 1.000: 0.**

Lote EV.G: 645 fichas novas, 0 retiradas e 359 das 359 anteriores preservadas. Desde o começo deste trabalho: 656 novas; 348 das 348 iniciais permanecem. Categorias se sobrepõem; não somar para a meta.

| Categoria | Vigentes |
|---|---:|
| Formação e aprendizagem | 910 |
| Bolsas e apoios financeiros | 85 |
| Intercâmbios | 3 |
| Competições e hackathons | 2 |
| Pesquisa e inovação | 82 |
| Carreira e experiência | 4 |
| Eventos e comunidades | 5 |

| Fonte | Vigentes |
|---|---:|
| EV.G / Enap — cursos com matrícula própria (`evg-enap-open-courses`) | 645 |
| Senac SC — turmas com vagas gratuitas PSG (`senac-sc-psg-open-cohorts`) | 112 |
| IFSC — cursos técnicos 2027.1 (`ifsc-technical-courses-2027`) | 103 |
| FAPESP — Oportunidades de Bolsas (`fapesp-open-fellowships`) | 82 |
| IFC — cursos técnicos integrados 2027 (`ifc-integrated-technical-2027`) | 41 |
| IFSC — qualificação e idiomas 2026.2 (`ifsc-qualification-courses-2026-2`) | 8 |
| ACATE — edições próprias auditadas (`acate-audited-events`) | 3 |
| Braskem — Programa de Estágio 2027 (`braskem-internship-programme`) | 1 |
| IFPE — Cursos gratuitos de qualificação (`ifpe-cursos-2026`) | 1 |
| Joinville — estágio remunerado 003/2025 (`joinville-paid-internship-003-2025`) | 1 |
| MinC — Intercâmbio Audiovisual 2026 (`minc-intercambio-audiovisual-2026`) | 1 |
| NASA Space Apps Challenge 2026 (`nasa-space-apps-2026`) | 1 |
| SED — estágio Novos Valores 2026 (`sed-novos-valores-2026`) | 1 |
| São José dos Campos — estágios abertos (`sjc-open-internships`) | 1 |
| Hackathon Tecnologia contra o Tráfico de Pessoas 2026 (`trt-udesc-hackathon-2026`) | 1 |
| UFSC/AUGM — Escala Grado 2027.1 (`ufsc-augm-grado-2027-1`) | 1 |
| UFSC — intercâmbio Outgoing 2027.1 (`ufsc-outgoing-2027-1`) | 1 |

## Qualidade e integração

EV.G: 645 IDs, 645 chaves de programa, 645 URLs de detalhe e 645 URLs de matrícula distintas. Nenhuma duplicata de chave ou inscrição entre as publicadas. Fluxo contínuo com prazo NULL e geografia sem inferência conferidos.

Ponte real do contêiner Apogee: HTTP 200, versão 3, 1004 recebidas em 116 ms, 1004 aceitas na validação local do conversor versionado do site e 0 rejeitadas. O rótulo é Inscrições em fluxo contínuo. Verificação visual posterior não realizada: navegador bloqueou a navegação, sem contornar a política.

Cada curso EV.G exige certificador ENAP, idioma Português, oferta aberta, CTA de matrícula na própria escola, declaração de início imediato e ausência de restrição/prazo contraditório. A FAQ de gratuidade é revalidada em cada execução. Conteudista é atribuído separadamente. Componentes, trilhas, versões e homônimos 318/627 ambíguos ficam fora. Não contar módulos curriculares, idiomas, vagas, turnos ou inscrições em mais de uma categoria como fichas adicionais.

## Operação e limites

PRs 52/53/54 integrados. SHA do coletor nesta medição: `df96e6c2c05dac90f8cf96468cb8efa32fbb0831`; Apogee: `b8731c4e845d4a292b4f0b8ad03b49680506ce9c`. Migrações 0024–0026 aplicadas; checkouts limpos e imagens exatas.199 testes Radar,253 testes Apogee e os quatro checks do CI aprovados. Revisão independente estática e da primeira amostra publicada sem bloqueador de qualidade. O ajuste posterior de separadores de ementa não muda critérios, programa ou contagem.

Backups protegidos com checksums e restauração isolada das 13 tabelas Radar/14 Apogee: `/opt/apogee-backups/radar-audit-sc-20261014T212301Z`, `/opt/apogee-backups/radar-lote-2-20261014T220321Z`, `/opt/apogee-backups/radar-lote-3-20261014T223105Z`. Imagens anteriores preservadas. O plano histórico dos lotes de ativação prevê pausar somente a fonte nova/scheduler e voltar à imagem anterior, preservando tabelas/volumes; reconciliar novos dados antes de restaurar dump integral.

Para o ajuste de separadores de ementa do PR 55, realizar novo backup com restauração isolada antes da aplicação. Se necessário, voltar à imagem `df96e6c2c05dac90f8cf96468cb8efa32fbb0831`, mantendo a fonte EV.G ativa, os registros publicados e o scheduler operacional. Este patch não ativa fonte nem altera esquema; seu rollback não exige restaurar o banco ou desativar a EV.G.

Três monitores privados UFSC/IFSC/FAPESC ativados após auditoria. Das 93 candidatas privadas,90 permanecem pausadas: ENAP já é atendida pelo coletor dedicado; IFC precisa de rota específica sem duplicar o catálogo; CIEE exige URL canônica auditada e programa próprio vigente; outras 87 ainda sem auditoria individual. As novas auditorias registram o método de agente sem preencher campos humanos.

Agenda na VPS existente: até 10 páginas por execução EV.G, até 6 rechecagens, progresso em 5 minutos e cadência de 24h após ciclo completo. Durante a coleta controlada, somente o scheduler Radar foi pausado, com retomada garantida ao terminar. Nenhum serviço/API pago, crédito, excedente ou automação GitHub agendada foi criado. Outros projetos, volumes, certificados e segredos preservados.

Privacidade: 0 assinantes e 0 mensagens no banco. Nenhum novo teste ou envio de e-mail neste trabalho. Opt-in, confirmação, cancelamento, retenção e limite de 50/dia validados por código/testes/configuração; fluxo completo com assinante real continua sem comprovação, conforme restrição de envio.

Prioridade SC somente até 18/10/2026; nenhuma regra permanente de localização ou retirada de oportunidades acadêmicas pela nova prioridade. O crescimento deste lote se concentra em formação; as demais categorias continuam com as contagens acima. A coleta diária deverá retirar oportunidades que perderem vigência.

Evidências locais: `radar-lote-3-final-20261014.json`, `radar-lote-3-identity-20261014.json`, `radar-lote-3-delta-20261014.json`, `apogee-bridge-lote-3-final-20261014-validation.json`, `radar-lote-3-catchup-20261014.jsonl`. Evidências de fonte versionadas em `radar-academico/references/source-audit-*-20261014.json`.

A participação da escola na oferta, gestão acadêmica e certificação consta no [institucional EV.G](https://www.escolavirtual.gov.br/conheca-a-escola); a [FAQ oficial](https://www.escolavirtual.gov.br/perguntas-frequentes) detalha gratuidade, matrícula contínua e os casos de público restrito. A avaliação individual de cada detalhe continua necessária.
