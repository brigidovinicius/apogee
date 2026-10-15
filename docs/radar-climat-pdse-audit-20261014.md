# Radar — CLIMAT-AMSUD e PDSE, 14/10/2026

Auditar CLIMAT primeiro, depois PDSE; aplicar somente fontes aprovadas, com os mesmos gates, sem serviços pagos.

## Decisões e plano

**CLIMAT: pausado.** A CAPES informa prazo nacional de 29/10/2026 às 17h de Brasília e exige a submissão internacional, potencialmente anterior. O parceiro CNRS indica 15/10/2026, somente data. A plataforma ANID retornou robots HTTP403; não consultar a página pelo coletor nem contornar o bloqueio. O domínio antigo da secretaria respondeu com conteúdo alheio ao programa. Não seguir seus links nem tratá-lo como organizador atual. Fontes secundárias/indexadas com prazos divergentes não substituem a plataforma obrigatória. Não inferir encerramento ou disponibilidade a partir da falha de acesso.

**PDSE: aprovar uma seleção futura, Edital 22/2026.** Programa e retificação CAPES retornaram200, sem redirecionamento, robots permitido. Ambos confirmam etapa nacional20/10–18/11/2026, até17h de Brasília, e seleção interna IES até16/10. Prazos internos podem ser anteriores. Exigir doutorado reconhecido pelaCAPES, proposta de pesquisa, seleçãoPPG/IES, cota e homologação; observar regras de programas em rede/CAPES-Global.edu. Exibir inscrições futuras até a abertura nacional; não prometer ingresso aberto em qualquer IES. Uma ficha, independente de destinos/cotas/áreas. Benefícios e duração4–9meses explícitos; nenhum valor monetário ou geografia inferidos. Não inventar URL de formulário.

Arquivos: normalizadorPDSE, helper compartilhado deHTML/dataCAPES, integração de catálogo/rechecagem, migração0029, auditoriaJSON, fixtures e testes, PRD e este documento. Não alterar a Apogee para a ativação; a ponte existente aceita statusupcoming. Não ativar portal amplo nem qualquer domínio ANID/secretaria.

## Comportamento e validação

Criar/rechecar a partir das mesmas duas páginas próprias dentro do orçamento. Janela e seleção interna precisam coincidir entre as fontes. Rejeitar edição diferente, datas/fuso inválidos, divergências ou prazo vencido. Estado futuro antes de20/10 segundo calendário brasileiro; aberto depois, até limite exato. Fim apenas das inscrições internas não encerra etapa nacional. Página parcial ou indisponível preserva verificação com retry; suspensão/cancelamento/encerramento confirmado retira e guarda situação/evidência. Preservar overrides, identidade e tombstones.

Testes unitários e integraçãoRLS cobrem mudança futura/aberta, etapas separadas, prazo/fuso, conflitos, paridade, edições, indisponibilidade, terminal e exclusão; regressõesPDAI permanecem obrigatórias após compartilhamento do helper. Os HTML reais precisam passar pelo adaptador e gate.

Antes de produção: CI aprovado no HEAD exato, checkout limpo, imagem comSHA correspondente e backup protegido deRadar/Apogee/configurações, restaurado em banco isolado com contagens e impressões digitais iguais. Somente web/schedulerRadar podem ser recriados.

Rollback: pausar `capes-pdse-22-2026` e voltar a imagemRadar `0188fe476358a72ec9fefd13194f81bdea72af7e`, confirmando saúde e scheduler, sem sobrescrever banco/histórico. Qualquer recuperação de dados começa isolada e reconciliada. Site permanece `b8731c4e845d4a292b4f0b8ad03b49680506ce9c`.

Base antes deste lote:1.078 fichas únicas, com paridade de IDs/campos público/admin. Resultados finais e recibos de release serão registrados no artefato externo após aplicação. O usuário confirmou ambos os ajustes para vestibulares: seção própria e uma ficha por processo seletivo com os cursos reunidos. Essa mudança terá entrega e validação próprias após esta ativação; a contagem deve refletir processos únicos, preservando histórico, exclusões e edições.

Validação local concluída: `npm test -- --testTimeout=20000 --reporter=dot` — 38 arquivos, 215 testes aprovados; `npm run typecheck` e `npm run lint` aprovados. HTML real das duas páginas aprovado pelo normalizador e gate central; estado futuro e prazo exato confirmados. CI e produção continuam gates separados.
