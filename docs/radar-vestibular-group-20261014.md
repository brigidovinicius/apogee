# Ingresso por vestibular — seção e ficha por processo

Pedido confirmado em 14/10/2026: reunir os processos com vestibular/prova em uma seção própria e consolidar a apresentação dos cursos em uma ficha por seleção.

O servidor identifica somente as duas edições auditadas com seleção explícita: IFSC técnicos 2027.1 por prova e IFC integrados 2027 por Exame de Classificação. Cursos por sorteio/ordem de inscrição continuam independentes. Não classificar por mera menção à palavra vestibular; nova fonte/edição exige evidência e inclusão explícita na regra.

A integração recebe metadado adicional `admissionProcess` sem mudar a versão 3 nem substituir IDs de cursos. A Apogee pública, de membros e administrativa usa o mesmo mural: seção “Ingresso por vestibular”, uma ficha por processo, opções de curso expansíveis com câmpus, requisitos, custos/apoio e controles administrativos originais. A exclusão de um curso o remove da lista; não criar registros substitutos nem contornar tombstones. Títulos editados permanecem. A contagem do mural, das categorias e da cobertura usa processos únicos. A API mantém os registros de opções para compatibilidade e edição; seu tamanho bruto deixa de ser interpretado como total de oportunidades independentes.

Aplicar filtros de área, modalidade, nível e localização aos cursos antes de agrupá-los. Cada processo aparece se houver ao menos uma opção correspondente; indicar quantas opções correspondem. Não atribuir uma localização única ao grupo. Se houver prazos/estados divergentes, manter uma ficha e mostrar o prazo de cada opção, sem inventar uma janela comum. Fonte e verificação permanecem por opção. Ordenação de processos segue o primeiro prazo das opções já ordenadas; demais oportunidades mantêm sua ordenação.

Base medida: 100 opções com prova (59 IFSC e 41 IFC), que passam a contar como duas seleções; redução esperada de 98 na contagem de oportunidades, sem retirada dos dados dos cursos. A meta de 1.000 será reavaliada com essa contagem, sem reduzir critérios para recuperar o número.

Gates: testes de classificação conservadora, agrupamento sem mutação, filtros aplicados previamente, renderização dos detalhes/controles, integração RLS público/admin e preservação de edições/exclusões. Typecheck/lint de ambas aplicações; CI completo no HEAD exato. Novo backup protegido de Radar/Apogee e restauração isolada com contagens/hashes iguais antes de aplicar. Reconstruir Radar e site sequencialmente, sem tocar volumes, segredos, certificados ou outros projetos. Sem serviços pagos e sem e-mails.

Rollback: imagens anteriores do Radar e da Apogee; nenhuma migração de dados é necessária. Implantar primeiro o metadado aditivo no Radar e depois a apresentação na Apogee. Validar a ponte real, IDs de opções idênticos, grupos, categorias, saúde e revisão das imagens. Registrar limitações de verificação visual sem declarar E2E de navegador.

Validação local: Radar 39 arquivos/217 testes aprovados, incluindo paridade RLS do novo metadado e preservação do ID após edição/exclusão; Apogee 258 testes aprovados, incluindo renderização pública/admin, busca e cidade antes do agrupamento e links de edição originais. Typecheck de ambas aplicações aprovado. Lint de ambas aprovado; permanece um aviso anterior de `<img>` na galeria, fora do escopo. Não há teste visual de navegador nesta etapa.
