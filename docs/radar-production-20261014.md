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

## Limitações e rollback

A UFSC devolveu conteúdo comprimido mesmo sob solicitação de identidade; o transporte protegido atual recusou a resposta. A fonte ficou registrada com falha, sem flexibilizar tamanho, robots, TLS ou domínio. UFBA e USP foram consultadas sem produzir novas fichas elegíveis no primeiro lote. Cobertura completa da Web, adaptação multilíngue e preenchimento de todas as categorias continuam fora desta etapa, conforme o PRD.

Os contadores persistidos em `ingestion_runs.execution_metadata` contabilizam descobertas novas; a prova de uma reconsulta publicada usa também a ficha, horário, eventos e leitura na Apogee. Não interpretar zero novas descobertas como falha da reconsulta.

Para rollback da correção isolada, pausar agendador e retornar Radar/web e scheduler a `76de863254623231e7a5158f17bbde1e662754b8`, com o contrato v3 preservado. Para voltar antes da migração inicial, coordenar os dois serviços: código antigo não lê publicações automáticas sem auditoria humana. SHAs anteriores: Apogee `130019c7d4f385e328a8ccc88ca140bf5c73af1f`, Radar `e6c18222485c54a1b44b0d14fc518a886f9eba6d`. Não remover tabelas, eventos ou fichas para simular reversão; restauração de banco depende do ponto real de falha e dos dados posteriores ao backup.
