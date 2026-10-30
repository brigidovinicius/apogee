# Radar — processamento automático de links descobertos (30/10/2026)

## Objetivo e escopo autorizado

Corrigir as falhas das fontes e processar automaticamente os 80 links pendentes, publicando somente oportunidades elegíveis. Preservar exclusões, alterações administrativas e o histórico. A coleta continua limitada a fontes oficiais verificadas, com TLS, DNS público, robots.txt, limites e prazos vigentes.

## Implementação

- Migração 0046: estado de processamento, tentativas, lease/token, resultado e vínculos de auditoria em discovery_leads.
- Reavaliação auditada por redescoberta após 24h e por reativação/ação administrativa; não reinicia tentativas esgotadas pela simples redescoberta e preserva mapeados, descartados e leases ativos.
- Dois links por ciclo, claim atômico com SKIP LOCKED; I/O fora da transação; conclusão revalida lead, alvo e escopo da fonte. Persistência da ficha e conclusão do link são atômicas.
- Até quatro tentativas para falhas transitórias. Escopo não verificado, informação insuficiente e fontes não suportadas não são publicados.
- Reutiliza lockSource/persistCandidate, preservando aliases, tombstones e overrides administrativos. Repetições não criam duplicatas.
- Migração 0047: oito seleções/edições oficiais auditadas inicialmente inativas/pendentes, sem sobrescrever configuração existente. Ativação somente após a nova revisão ficar saudável, com comparação exata dos descritores.
- Cron normal integra descoberta e processamento. O modo protegido leadsOnly=1 processa o backlog sem nova coleta das demais fontes nem envio de alertas.
- Painel administrativo exibe o estado e o motivo do resultado. Scheduler registra criação, atualização, publicação, bloqueio, retry e perda de lease separadamente.
- Não existe aprovação humana de fichas como gate: fonte, evidência, inscrição, prazo e estado determinam a publicação.

## Fontes e prazos auditados

| Chamada | Prazo de inscrição |
|---|---|
| Mestrado em Farmácia UFSC | 30/10/2026 |
| NDI/UFSC — sorteio 2027 | 09/11/2026 |
| Colégio de Aplicação UFSC — sorteio 2027 | 10/11/2026 às 18h de Brasília |
| ViruSul/UFSC | 12/11/2026 |
| Experimenta UFSC 2026 | Entrada gratuita aberta; início em 03/11, sem inventar prazo de inscrição |
| SINTER Escala Gestores/Administradores 2027 | 09/11/2026 |
| SINTER Escala Docente 2027 | 03/11/2026; 13/11 é prazo de recurso |
| SINTER Escala Posgrado 2027 | 05/11/2026 |

Os normalizadores exigem a identidade e as evidências atuais, não apenas o título encontrado. As chamadas SINTER cruzam a linha da tabela vigente com a notícia/documento da edição. O PDF.js separa anos como 202 6/202 7: reparo restrito a esses tokens auditados, mantendo a comparação entre índice e documento. O PDF antigo de Gestores mudou de endereço; um alias exato mantém a identidade e usa a notícia oficial atual. Não inferir bolsa, gratuidade geral, localização ou abrangência quando ausentes.

## Correções de fontes existentes

- REC'n'Play: layout mudou; valida identidade 2026, datas, local, gratuidade e CTA exato sem depender de uma frase antiga.
- CPS cultural: reconhece a prorrogação oficial de 17 para 22/10; mantém a edição encerrada e rejeita conflito entre modalidades.
- CPS e USP: índices e robots responderam 200 na sondagem da VPS. Não aumentar timeout nem relaxar a política de rede sem causa.
- Propesq/POP: certificado expirado em 28/10; a VPS confirma CERT_HAS_EXPIRED. Não desabilitar TLS.
- PDFs CPS no Azure: robots retorna 400; o coletor deve bloquear.
- Fazendo Gênero 14: inscrições atuais em evento futuro, mas robots.txt bloqueia RadarAcademicoBot (User-agent * / Disallow /). Não publicar a partir de coleta proibida nem impersonar Googlebot.
- Reiki: sem prazo de matrícula e critérios suficientes; não mudar categoria para contornar a validação.
- Festiuni, PROMAIPS e ofertas antigas IsF/PROASA: não confundir inscrição encerrada com realização ou resultados futuros.
- Links de formulários, páginas de referência e documentos fora do escopo permanecem com motivo explícito; não conceder autoridade editorial automaticamente ao host.

## Validação e operação

Validação inicialmente executada no checkout isolado /opt/apogee-work/radar-automation-20261030. O Mac ficou sem espaço; não foram removidos projetos, worktrees, node_modules ou processos locais. Somente arquivos de código/teste enumerados foram transferidos, sem .env ou credenciais.

Primeira rodada corrigida: 402 testes aprovados, 19 dependentes de PostgreSQL ignorados; typegen, TypeScript e lint aprovados. Após integrar o main atual, a suíte completa passou com 468 testes aprovados e 29 dependentes de ambiente ignorados; typegen, TypeScript e lint aprovados. Os 21 testes PostgreSQL reais foram executados separadamente e aprovados, incluindo reenfileiramento. Os oito extratores também passaram com páginas oficiais reais, sem banco/publicação. A extração do PDF foi verificada com o PDF.js da produção.

Os testes de banco cobrem claims concorrentes, lease/token, idempotência/tombstone e rollback da ficha/evento/conclusão.

Main foi atualizado para 3e682f3 (PR96) durante o trabalho. Nossas migrações foram renumeradas para 0046/0047. As migrações anteriores 0043–0045 são aditivas; quatro candidatos de calendário permanecem inativos e pendentes. Não ativar essas fontes nesta execução nem reconstruir o site.

Antes da produção: inventário, backup privado e restauração isolada. Depois de CI e revisão: integrar branch, aplicar somente 0046/0047, reconstruir a imagem Radar e recriar web/scheduler; verificar revisão, saúde, catálogo público, resultados dos 80 IDs, idempotência e preservação dos demais contêineres. O resultado final da execução será registrado separadamente, sem usar testes históricos como prova atual.

## Complemento FAPESC e reconsulta final (30/10, após 17h25 UTC)

A revisão dos 80 IDs identificou também a 8ª CECTI regional de Santa Catarina. A notícia FAPESC de 29/10, post 58157, confirma seis regionais de 03 a 16/11/2026, das 9h às 12h, representantes da quadrihélice e inscrições até a capacidade de cada local. O site do organizador foi consultado somente para confirmar o CTA vigente de inscrição; o formulário não foi acessado nem preenchido. A coleta automática usa somente o artigo HTTPS da FAPESC, com robots e validação de transporte normais. Normalizador exato, uma ficha por edição; sem inventar prazo de inscrição ou gratuidade e sem tratar a etapa estadual como inscrição aberta. Fonte preparada inativa na migração 0048; ativação e reavaliação do link original após a revisão saudável.

A Propesq e o POP voltaram a responder com HTTP200 e TLS válido na VPS às 17h26 UTC; a reconsulta real do coletor completou três páginas sem falhas. O erro de certificado registrado às 16h04 era verdadeiro naquele momento; a recuperação externa não foi causada por bypass ou alteração de TLS nesta entrega. REC’n’Play e CPS mobilidade virtual foram reconsultados e publicados; CPS cultural foi validado encerrado após prorrogação, sem reabertura. USP completou a consulta sem falhas, sem nova oportunidade elegível. CPS/ICIF continua inativo por falha de acesso à evidência externa.
