# Radar ao vivo — produção em 14/10/2026

## Autorização e release inicial

O proprietário autorizou expressamente a migração e o deploy da Apogee e do Webscraper, exigindo backup anterior e validação de publicação automática, catálogo comum e criar/editar/excluir. Também iniciou a sessão administrativa usada nos testes reais.

- [PR #26](https://github.com/brigidovinicius/apogee/pull/26), integrado em `76de863254623231e7a5158f17bbde1e662754b8`.
- [CI 38494271211](https://github.com/brigidovinicius/apogee/actions/runs/38494271211): os quatro jobs passaram, incluindo testes, tipos, lint, auditoria de dependências, builds, smoke e PostgreSQL descartável da galeria.
- Integração com o main vigente preservou blog, galeria, perfil/avatar e SEO. Validação local da base integrada: 243 testes Apogee e 102 Radar; tipos aprovados; Radar sem avisos de lint, Apogee com aviso anterior de imagem na galeria.
- Checkouts limpos da VPS atualizados por `git fetch` e `git switch --detach` para o SHA exato, sem copiar arquivos manualmente.
- Migrações Radar aplicadas pelo `scripts/migrate.mjs`: `0005_courses_national_scope.sql`, `0006_crawl_progress.sql` e `0007_automatic_live_catalogue.sql`.
- Troca inicial dos dois serviços concluída em 14/10 às 01:23 UTC (13/10 às 22:23 em Brasília). Ambos saudáveis e sem reinícios; agendador iniciado às 01:26 UTC. Revalidação na manhã de 14/10 confirmou os serviços saudáveis após cerca de dez horas.

## Backups e recuperação

Backup anterior à migração: `/opt/apogee-backups/radar-live-20261014T010848Z`, arquivos privados de root, modo 600.

| Arquivo | Verificação |
|---|---|
| `apogee-membros-production.dump` | 161.779 bytes; restaurado em banco temporário, 14 tabelas |
| `radar-academico-production.dump` | 30.424 bytes; restaurado em banco temporário, 6 tabelas |
| `apogee-configs.tar.gz` | configurações, ambiente e certificados preservados; não expostos |
| `SHA256SUMS` | integridade confirmada antes e depois do deploy |

O backup inicial chamado `apogee-membros.dump` apontava para o banco padrão vazio; isso foi detectado e corrigido **antes da migração**. Para recuperação usar os arquivos `*-production.dump` acima. Os bancos temporários de restauração foram removidos após a validação. O diretório também contém SHAs anteriores, inventário dos contêineres e log das migrações.

Backup complementar antes da correção do coletor: `/opt/apogee-backups/radar-followup-20261014T110544Z`. Dump Radar restaurado com sucesso, agora com 7 tabelas; configuração e inventário preservados; checksums aprovados.

## Validações efetivas

1. Criar, editar e excluir exercitados na interface administrativa real. Ficha temporária baseada em chamada oficial da UFSC, identificada como teste: `b766c21b-e2fc-4e16-95ce-eb10526838e4`. Criação e alteração apareceram na página pública; após exclusão saiu do catálogo. Banco confirmou versão 3, exclusão lógica, publicação removida e eventos `create/update/delete` com ator administrativo. Nenhuma ficha fictícia permaneceu publicada.
2. Catálogo público e administrativo comparados com conteúdo positivo: mesmos IDs e todos os campos públicos idênticos. Dados de auditoria/evidências/versão não aparecem na resposta pública. Requisição sem credencial e credencial de leitura usada na API administrativa retornaram 401.
3. Publicação automática real: fonte IFPE auditada e ativada. Um registro real de curso entrou por CSV com estado incompleto, `blocked=1` e `published=0`, ausente publicamente. A reconsulta da página oficial publicou o mesmo ID `c5c8e0d0-d8cf-4624-8681-68319a270fdd` às 01:30:20 UTC, com `verification_method=automatic`, `human_verified_at` nulo e evento `radar:automatic`. A ficha ficou visível tanto na página pública quanto no painel.
4. A prova positiva acima usa descoberta/importação assistida e reconsulta/publicação automática. Não é evidência de descoberta autônoma dessa URL desde a busca Web. A fonte IFPE permanece `manual_assisted`.
5. Primeira execução agendada persistida: três fontes, seis páginas, nenhuma nova oportunidade elegível e uma falha de fonte. Não contar execução, candidato ou log como publicação.

Fonte real usada: [IFPE — cursos de qualificação profissional](https://portal.ifpe.edu.br/noticias/ifpe-abre-150-vagas-para-cursos-gratuitos-de-qualificacao-profissional/), inscrições até 23/10/2026. A ficha real foi mantida; somente o registro temporário de CRUD foi excluído.

## Correções identificadas na validação

O [PR #27](https://github.com/brigidovinicius/apogee/pull/27) acompanha a correção complementar e seu registro final de CI/deploy:

- “Startup de sistemas elétricos”, na ementa do curso, era interpretado como público empresarial. O classificador passou a exigir público explícito e manter classificação mista quando não comprovada. Ensino médio completo não implica matrícula no ensino médio. Benefício financeiro do IFPE está documentado na fonte e foi preservado.
- Requisitos e valores não extraídos passam a orientar a consulta da fonte, sem afirmar que ela não fornece esses dados. Nova revisão do normalizador garante registro da retificação no histórico.
- Reconsulta agendada inclui fichas não excluídas de fontes assistidas quando vencidas; essas fontes continuam sem descoberta automática de novas páginas.
- O arquivo de ambiente legado tinha intervalo de execução de 86.400 segundos. Compose define padrão próprio de 300 segundos para o agendador, preservando o arquivo de segredos e os intervalos individuais das fontes.
- Validação local complementar: 115 testes Radar, tipos e lint aprovados. Não há migração adicional nem mudança no contrato v3; basta atualizar Radar/web e agendador, mantendo Apogee no release inicial validado.

O status final e os SHAs da correção são registrados no PR #27 após a conclusão dos gates; este documento não substitui a prova de execução de cada etapa.

## Sete categorias e meta de mil — release de 14/10

- [PR #28](https://github.com/brigidovinicius/apogee/pull/28), integrado em `288c59ee643d92747a056c2d77d7d2769bcf02ef`, introduziu categorias múltiplas persistidas no Radar, filtro e formulário comuns na Apogee, navegação pública e meta de 1.000 fichas únicas no PRD. [CI 38558647629](https://github.com/brigidovinicius/apogee/actions/runs/38558647629) passou nos quatro jobs. A árvore do merge era idêntica à revisão testada no PR.
- Backup **antes da migração** em `/opt/apogee-backups/radar-categories-20261014T114553Z`, diretório privado de root. Dumps `radar-academico-production.dump` e `apogee-membros-production.dump`, configuração dos dois serviços, SHAs e inventário de contêineres. `SHA256SUMS` confirmou integridade; restaurações em bancos temporários confirmaram 7 tabelas do Radar e 13 do banco de membros, iguais às contagens dos bancos de origem. Bancos temporários removidos.
- Checkouts limpos da VPS foram atualizados por `git fetch` e `git switch --detach` para o SHA exato. O agendador foi pausado, a migração `0008_opportunity_categories.sql` aplicada pelo serviço `migrate`, o web do Radar reconstruído e validado, e então o web da Apogee reconstruído. O agendador foi retomado na imagem `288c59e` somente após as verificações de saúde e da API.
- A migração classificou a ficha real do IFPE como `{formacao,bolsas}`, sem duplicá-la. As APIs pública e administrativa retornaram HTTP 200, o mesmo ID `c5c8e0d0-d8cf-4624-8681-68319a270fdd` e as mesmas duas categorias; a resposta pública não expôs versão ou evidências privadas. A página pública, a área de membros e o painel exibiram a mesma ficha e as sete opções. O formulário de criação mostrou as sete categorias; o de edição abriu a ficha com as duas já marcadas. Nenhum cadastro fictício foi feito em produção nesta etapa; a gravação das categorias e sua preservação após nova coleta passaram no teste de integração com banco isolado.
- A inspeção visual identificou rolagem horizontal que ocultava duas opções em tela comum e concordância incorreta no contador singular. [PR #29](https://github.com/brigidovinicius/apogee/pull/29), integrado em `c0150798c228db62097f98c3099d87f1b841a5dd`, corrigiu ambos. [CI 38560139604](https://github.com/brigidovinicius/apogee/actions/runs/38560139604) passou nos quatro jobs. Somente o web da Apogee foi reconstruído novamente; Radar e agendador permaneceram em `288c59e`.
- Estado final: Apogee/web `c0150798c228db62097f98c3099d87f1b841a5dd` saudável; Radar/web e scheduler `288c59ee643d92747a056c2d77d7d2769bcf02ef` saudáveis/em execução. Checkouts remotos limpos. A URL pública `/oportunidades` respondeu HTTP 200; filtro sem fichas mostrou estado vazio. Inspeção visual confirmou as sete opções visíveis no desktop e em duas colunas no celular e “1 oportunidade visível”. A área de membros autenticada exibiu a mesma ficha.
- A meta de 1.000 **não foi atingida**: produção ainda tinha 1 ficha publicada e vigente de 2 armazenadas, com 4 fontes ativas entre 10. A [medição de cobertura](radar-coverage-20261014.md) registra a lacuna de 999 e as limitações das fontes. Categorias somam aparições; o indicador de cobertura conta IDs únicos. Não declarar a meta alcançada nem preencher seções com registros fictícios.

Para reverter apenas o ajuste visual, retornar Apogee/web a `288c59e` e manter Radar em `288c59e`. Para reverter a funcionalidade inteira, pausar o agendador e coordenar Apogee/web em `76de863` com Radar/web e scheduler em `f24064b`; a migração `0008` é aditiva e pode permanecer, mas o código anterior não preencherá categorias em fichas novas. Não apagar a coluna nem restaurar dumps sobre dados posteriores sem avaliar as mudanças reais. Preservar o backup indicado acima.

## Limitações e rollback

A UFSC devolveu conteúdo comprimido mesmo sob solicitação de identidade; o transporte protegido atual recusou a resposta. A fonte ficou registrada com falha, sem flexibilizar tamanho, robots, TLS ou domínio. UFBA e USP foram consultadas sem produzir novas fichas elegíveis no primeiro lote. Cobertura completa da Web, adaptação multilíngue e preenchimento de todas as categorias continuam fora desta etapa, conforme o PRD.

Os contadores persistidos em `ingestion_runs.execution_metadata` contabilizam descobertas novas; a prova de uma reconsulta publicada usa também a ficha, horário, eventos e leitura na Apogee. Não interpretar zero novas descobertas como falha da reconsulta.

Para rollback da correção isolada, pausar agendador e retornar Radar/web e scheduler a `76de863254623231e7a5158f17bbde1e662754b8`, com o contrato v3 preservado. Para voltar antes da migração inicial, coordenar os dois serviços: código antigo não lê publicações automáticas sem auditoria humana. SHAs anteriores: Apogee `130019c7d4f385e328a8ccc88ca140bf5c73af1f`, Radar `e6c18222485c54a1b44b0d14fc518a886f9eba6d`. Não remover tabelas, eventos ou fichas para simular reversão; restauração de banco depende do ponto real de falha e dos dados posteriores ao backup.

## Correção da coleta UFSC — 14/10, 12:24 UTC

O [PR #31](https://github.com/brigidovinicius/apogee/pull/31) foi integrado em `c9ed9daaef7b9ea006e0c2fb409edb1c60a320d2`; os quatro jobs do [CI 38562362085](https://github.com/brigidovinicius/apogee/actions/runs/38562362085) passaram. O transporte agora trata 404 sem ler o corpo, o que resolve o `robots.txt` da UFSC enviado com compressão mesmo sob pedido de `identity`. Uma página 200 comprimida continua recusada. Antes da troca, `/opt/apogee-backups/radar-robots-20261014T122026Z` guardou dump do Radar, configuração e SHA anterior com checksums aprovados; o dump restaurou em banco temporário com 7 tabelas, depois removido.

O checkout remoto limpo foi fixado no SHA acima. A imagem do Radar foi construída, o scheduler pausado, o web recriado e confirmado saudável, e o scheduler retomado na mesma imagem. Não houve migração de banco ou reconstrução da Apogee. A API interna retornou 1 ficha antes da coleta; a coleta controlada `ufsc-propesq` (`maxPages=5`, `maxCandidates=10`) retornou 5 páginas, 1 candidato, 0 falhas, 1 bloqueado e 0 publicados. O candidato era o portal genérico POP, sem inscrição comprovada. O banco passou de 2 para 3 registros e a API pública permaneceu com 1; a página pública respondeu HTTP 200 após o redirecionamento para `www.apogee.community`. Radar/web saudável, scheduler em execução. A meta de 1.000 segue aberta, conforme a [medição de cobertura](radar-coverage-20261014.md).

Para reverter esta correção isolada, pausar o scheduler, retornar Radar/web e scheduler à imagem `radar-academico:288c59ee643d92747a056c2d77d7d2769bcf02ef`, validar saúde e retomar o scheduler. A alteração não exige reversão de esquema; preservar os dados posteriores ao backup. O checkout de código pode voltar ao mesmo SHA antigo após confirmar que está limpo.
