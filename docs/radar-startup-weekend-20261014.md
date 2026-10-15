# Extracurriculares — Startup Weekend, 14/10/2026

Pedido: continuar pelas fontes pausadas, uma por vez, priorizando extracurriculares, Startup Weekends, hackathons, eventos, bolsas, intercâmbios e pesquisa; preservar agrupamento por processo, mesmos gates e nenhum serviço pago.

## Auditoria sequencial e decisão

1. Techstars Startup Weekend: programa e `/events/search`/`events` HTTP200, robots permitido. Programa genérico e HTML da busca não trazem edições/inscrição atual. Resultados indexados não comprovam vigência. Monitor amplo permanece pausado.
2. Sebrae Startups: URL candidata redireciona pela variante lowercase até conteúdo genérico. Calendário SC é uma aplicação no cliente e descreve apoio/fomento; isso sozinho não prova organização individual. O bundle público foi inspecionado, sem executar código, usar sua API/backend, seguir analytics ou registrar credenciais. Monitor amplo permanece pausado.
3. Edição própria ACIM: evento e homepage HTTP200 sem redirects, robots permitido. Homepage lista Startup Weekend Imbituba e a página da edição vende seus ingressos. CNPJ 80.987.837/0001-05 e política de privacidade conferidos. Aprovar somente essa edição, sem liberar outros eventos do domínio.

## Oferta e comportamento

Uma ficha **Startup Weekend Imbituba — 2ª edição 2026**, categoria eventos. Início em 06/11/2026 às 18h de Brasília e término em 08/11 às 20h, SCPAR Porto de Imbituba, Imbituba/SC/Brasil. JSON-LD EventScheduled e InStock concorda com data/local e venda visíveis. Ingresso R$80 + taxa R$2, total R$82; não há compra, reserva ou serviço pago para a execução deste trabalho. Não presumir idade, escolaridade mínima, gratuidade, auxílio financeiro ou quantidade de vagas.

Prazo final de inscrição não informado; exibir esse estado, sem usar o início ou fim do evento como deadline. Retirar ao início confirmado, esgotamento, cancelamento/adiamento ou perda de comprovação. Resposta parcial/indisponível preserva o histórico com retry. Comparar os valores e as datas visíveis com a estrutura Event; não confiar em textos de tradução ocultos como aviso real. A quantidade zero do seletor de ingressos não significa ausência de vagas.

Coleta e rechecagem diárias limitadas a uma URL de edição. Não seguir checkout, formulários, lotes, dias, equipes ou convidados como novas fichas. Sem API paga, assinatura, compra, e-mail ou nova automação GitHub. Identidade, overrides e tombstones continuam protegidos. Agrupamento vestibular permanece 59 IFSC e 41 IFC em duas seleções.

## Implementação e gates

Normalizador de edição; integração no catálogo limitado de uma página; migração0030; fixture extraída do HTML real sem dados de convidados/sessão; testes de normalização, scheduler e RLS; auditoria JSON e PRD. Apogee não precisa de alteração: versão60ce1024 aceita eventos sem prazo e seus alertas optativos existentes.

Antes de aplicar: testes locais, typecheck/lint, revisão de diff e CI completo no HEAD exato. Novo backup protegido Radar/Apogee/configurações; restauração em bancos isolados com contagens/hashes iguais, clones removidos e checksums dos dumps. Checkout remoto limpo, imagem exata e rollback preservado. Rebuild somente Radar, sequencial, sem tocar volumes, DNS, certificados ou outros projetos.

Rollback: pausar somente `acim-startup-weekend-imbituba-2026`, retornar Radar/scheduler à imagem `0fae84fc58dcabb939cf8e0816b7ea5cd7ec5264`, preservar banco e histórico. Apogee continua `60ce1024c8bde3a5345051dc36f8540c85afa869`. Recuperação de dados começa isolada e reconciliada.

Base real 14/10/2026 às22h17: 1.014 oportunidades independentes, 1.112 registros de opções. Público/admin/ponte idênticos; vestibulares em dois grupos (59/41). Medir novamente depois do lote, separando a nova edição da coleta rotineira, retiradas justificadas e categorias/fontes. A API bruta não substitui a contagem agrupada.

Validação visual em navegador de produção não é presumida; integração real e conversor da Apogee precisam ser conferidos após o deploy. Recibos e medição finais serão registrados no artefato externo desta sessão.

Validação local concluída com a migração0030: 40 arquivos/224 testes Radar aprovados, incluindo regressões do agrupamento (59/41), RLS, coleta de uma página e tombstones. Typecheck e lint aprovados. HTML real de 1,46MB passou pelo adaptador e pelo gate central: uma ficha aberta, início exato e prazo final ausente, valores concordantes. CI e produção permanecem gates separados.
