# Integração de hackathons — 20/10/2026

Autorização do operador: integrar/publicar Decola Saúde, Hack Day SJC, Junction e ClimX; preparar Gemma, CHI-Bench, 3LC e BuildArena para futura atualização automática. Pesquisa e condições: [auditoria das oito candidatas](radar-hackathon-research-20261020.md).

## Implementação

- Adaptadores restritos a oito URLs/edições exatas. Decola exige HTML e regulamento PDF em cada coleta; nenhuma navegação pelo checkout. Inscrição geral preservada em 26/10, propriedade intelectual do Senac e Figma obrigatórios.
- SJC mantém prazo de inscrição desconhecido e sai do catálogo quando o evento começa. Junction preserva 25/10 sem conversão de horário/fuso incerto; auxílio de viagem encerrado não fecha inscrição geral. Localização internacional fica em país, sem UF/cidade brasileira inventada.
- ClimX preserva 15/12 como prazo de **envio**, sem inventar inscrição ou início de evento. Evidência `submission_deadline` produz `deadlineKind=submission` no contrato v3 público e administrativo. Site mostra “Envios até” e texto de participação compatível; clientes existentes continuam aceitando o contrato aditivo.
- Migração 0038 cadastra oito fontes inativas/pendentes, sem inserir fichas nem alterar flags existentes. Ativação operacional será limitada às quatro legíveis após CI, backup restaurado e deploy.
- As quatro Kaggle dinâmicas têm configuração, URLs de overview/regras, prazos, condições e roteamento de dois documentos preparados. Envelope JS não passa na validação. Além da inatividade, o rascunho retorna `sourceConflict=true`, bloqueando publicação até uma captura oficial compatível, auditada a cada execução, ser implementada. Nenhum texto de pesquisa é usado como resposta de coleta.

## Atualização automática

As quatro fontes legíveis usam a fila oficial existente, intervalo de 24 horas, coletor protegido e publicação na mesma transação da ingestão validada. O scheduler verifica fontes devidas a cada cinco minutos, sujeito ao tempo de execução e fila. A página visível já refaz a leitura do catálogo a cada 60 segundos. Não há disparo manual da rota global de cron ou de alertas.

As quatro dinâmicas **ainda não fazem atualização automática**. A preparação não equivale a um navegador em produção nem autoriza contornar a plataforma. Antes de liberar: implementar captura suportada de overview e regras, revalidar prazos/valores/elegibilidade/rotas, retirar explicitamente a trava do adaptador, executar testes e só então verificar/ativar a fonte. Não serão publicadas por este lote.

## Verificação local

- Coletor protegido da VPS revalidou as quatro páginas e o PDF em 20/10/2026, 15:52:42–15:52:49 UTC. Robots, TLS, allowlists, limites e intervalos preservados. Hashes em `radar-academico/references/hackathon-integration-20261020.json`.
- Suíte Radar: 340 testes passaram, dos quais quatro testes temporários usam o HTML atual e os bytes reais do PDF. O corpus permanente contém fatos resumidos, não os documentos integrais nem caminhos `/private/tmp` dependentes do ambiente.
- Casos cobertos: identidade/URL/edição, fatos escondidos em script, inscrição indisponível, lotação/encerramento/cancelamento, expiração, suplemento obrigatório, IP/Figma, prazo desconhecido, auxílios encerrados, prazo de envio, geografia e migração idempotente. Contrato público/admin inclui tipo de prazo coerente.

## Release

Pendente dos gates de CI, backup/restore e verificação em produção. Atualizar esta seção somente com evidência efetiva.
