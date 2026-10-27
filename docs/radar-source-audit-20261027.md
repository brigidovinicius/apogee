# Auditoria e publicação do Radar — 27/10/2026

Autorização do operador: “audite, teste, valide e publique”, em 27/10/2026. Escopo: coleta de oportunidades, fontes com falha e fila de descoberta. Branch isolada a partir da main/produção `861c3b2ea9396b491d29c2d504c0cfeebacf066a`.

## Diagnóstico e decisões

- Baseline somente leitura: 44 fontes ativas/verificadas, 1.290 registros armazenados e 1.046 visíveis. Última publicação anterior em 26/10 às 16h13 de Brasília.
- Triagem dos 159 links pendentes: 99 páginas capturadas pelo coletor protegido, 11 falhas de transporte e 49 documentos/destinos externos que exigem revisão específica. 82 itens classificados como navegação, notícias sem candidatura, resultados ou chamadas/eventos encerrados; 11 links sustentam oito edições preparadas; 66 permanecem em revisão. As decisões estão em `radar-academico/references/source-audit-20261027.json`.
- NIAVI/StartTech ocorreu em 24/10. WorkInTech começou em 26/10. JECT/IFMG começa em 27/10 e encerrou inscrições em 20/10. Pausar a coleta dessas três edições evita repetir falhas sobre eventos que já deixaram de ser elegíveis. A operação preserva os registros e as evidências históricas.
- IFPE é uma importação manual específica, com prazo armazenado em 23/10 e URL indisponível na auditoria. Pausar sua coleta não declara nova verificação nem encerramento comprovado pela rede.
- USP permanece com falha de conectividade; a consulta de robots na VPS também excedeu 20 segundos. Nenhuma proteção de robots, TLS, DNS, tamanho ou redirecionamento foi relaxada.
- As duas páginas oficiais da chamada de transferências UFSC (DAE e notícia vinculada) devolvem gzip mesmo com `Accept-Encoding: identity`. A compatibilidade fica limitada ao ID da fonte e a esses dois endereços exatos, com teto tanto para bytes recebidos quanto para a saída do zlib; codificações comprimidas continuam bloqueadas por padrão. Testes cobrem expansão acima do limite, corpo inválido, escopo e bloqueio por robots.
- Falhas de coleta e reconsulta agora registram categorias fixas (timeout, DNS, TLS, HTTP, robots, limites e mudança de evidência), sem copiar erros arbitrários ou respostas privadas. Descoberta ignora links de navegação e blocos de cabeçalho/lateral.

## Edições preparadas

| Fonte | Prazo | Público e distinção relevante |
|---|---|---|
| CNPq/CAPES MAI/DAI 30/2026 | 11/12/2026 | ICTs por representante institucional; estudantes procuram sua instituição |
| CNPq/ANR 32/2026 | 31/03/2027 | Projetos Brasil–França via coordenador brasileiro com doutorado e vínculo |
| CNPq Produtividade 33/2026 | 07/01/2027 | Pesquisadores, critérios DT/PQ/PQ-Sr e errata preservados |
| UFSC PROAA 2027 | 27/10/2026 às 17h de Brasília | Docentes e TAEs apresentam projetos; não é candidatura direta de aluno |
| UFSC PPGTG 2027.1 | 27/11/2026 | Seleção de mestrado; inscrição gratuita sem bolsa garantida |
| UFSC transferências e retornos 2027.1 | 30/10/2026 | Um processo, sem multiplicar 5.139 vagas em fichas |
| CPS/ICIF 8º concurso | 02/11/2026 | Docentes Etec/Fatec; bolsa única ao vencedor, custos próprios preservados |
| Encontro IEG/UFSC | 13/11/2026 | Prazo de envio de trabalhos; evento em 23–24/11, distinto de inscrição de ouvinte |

As migrações 0039–0041 apenas cadastram oito fontes inativas e pendentes. Cada ativação depende da revalidação isolada na VPS. País, UF, cidade e valores não comprovados não são preenchidos. Foram usados os leitores PDF existentes; as ferramentas Adobe não estavam disponíveis.

## Validação local

- Primeira execução completa detectou instalação compartilhada de dependências anterior à correção `braces`; o link criado para esta tarefa foi substituído por instalação isolada com `npm ci`. Nenhuma instalação de outro projeto foi alterada.
- Suíte completa com dependências isoladas: **365 testes aprovados; 15 dependentes de configuração externa ignorados localmente**, 53 arquivos (52 aprovados, um ignorado). Limite de tempo local de 60 segundos para inicialização dos bancos descartáveis; testes preservam asserções.
- Checagem TypeScript após geração de tipos: aprovada com Node 24.19.0.
- Lint: aprovado. CI e resultado da implantação: registrar na evidência final após execução.
- Revisão independente corrigiu o público estruturado do PROAA para incluir TAEs e fez a evidência de prazo apontar para o trecho que contém 17h de 27/10.
- Seis candidatos passaram na captura local e no primeiro dry run da VPS com HTML/PDF reais. A versão anterior bloqueou transferências por gzip não solicitado e ICIF por robots indisponível; transferências será revalidada após a correção limitada. ICIF permanece inativa enquanto a origem bloquear a coleta. Isso não é confirmação de publicação.

## Backup e procedimento de publicação

Backup: `/opt/apogee-backups/radar-audit-20261027T124610Z/radar.dump`, com SHA-256 conferido e restauração em banco temporário separado: 13 tabelas, 1.290 oportunidades e 51 fontes. Somente o banco temporário criado pela auditoria foi removido após o teste.

Após CI aprovado: conferir checkout remoto limpo e SHA; implantar somente Radar; aplicar as três migrações aditivas; executar `scripts/audit-source-calls-20261027.mjs` no builder isolado, sem banco ou credenciais; ativar apenas as fontes que passaram; realizar ingestão limitada por fonte e repetir para verificar idempotência. Conferir IDs/campos público/admin, buscas e saúde pública. Pausar somente as quatro fontes auditadas citadas acima. Atualizar decisões por ID, target e URL exatos, sem apagar links ou fichas. Site, proxy, segredos, assinaturas, pagamentos, emails e aplicações vizinhas não fazem parte da alteração.

A chamada controlada por `sourceId` não invoca o ciclo de alertas. O scheduler existente conserva seu comportamento normal. A evidência final deverá informar o SHA implantado, fontes aprovadas/bloqueadas, fichas novas, duplicatas e limitações.
