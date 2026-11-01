# Expansão automática de fontes do Radar — 01/11/2026

## Problema e resultado

A descoberta excluía links cobertos pelo registro de fontes, mas seu processador aceitava somente esse registro. Links novos em fontes existentes desapareciam da descoberta; páginas de sites monitorados sem uma fonte de coleta ficavam em `scope_unverified`. A conferência inicial de produção encontrou 411 links nessa condição, sem comprovar que todos eram oportunidades válidas.

O candidato baseado no `main` `ea993532bd09fb07c87674adaf94d89bfdbe7b51` fecha esse caminho para páginas de sites oficiais já verificados. A implementação está no commit `801f6e0`. O código ainda não foi implantado nesta entrega.

## Fluxo implementado

1. A descoberta conserva novos links de fontes cadastradas. Páginas que já possuem uma ficha, inclusive excluída, não ocupam novamente a fila de descoberta; suas atualizações permanecem na coleta da fonte.
2. Quando não existe fonte de coleta, o processador verifica a identidade e a habilitação do monitor, exige o mesmo domínio HTTPS e consulta novamente a página oficial de origem. O link precisa continuar presente, em uma âncora ou nos metadados estruturados do evento.
3. A página de destino passa pelo transporte seguro existente: DNS público, TLS, robots, redirecionamentos restritos, limites de resposta e de frequência. Uma página de artigo precisa identificar uma oportunidade única; listagens, documentos não suportados e evidências insuficientes ficam retidos.
4. Fonte e ficha são criadas na mesma transação que conclui o link. A autorização é da URL exata, incluindo query string; não libera o domínio inteiro, caminhos irmãos ou redirecionamentos para outras páginas.
5. O cadastro preserva fontes existentes, inclusive inativas ou pendentes, fichas excluídas, identidades compartilhadas e alterações administrativas. A conclusão revalida o monitor depois da consulta de rede e exige evidência com até cinco minutos.
6. A nova fonte continua sendo consultada pelo agendador existente, com o mesmo normalizador utilizado na validação inicial. Encerramentos, esgotamento e falhas de reconsulta seguem as regras normais do catálogo.

O lote permanece em dois links por ciclo. Links novos e tentativas transitórias têm precedência; bloqueios legados por `scope_unverified` recebem uma reavaliação identificada por versão, sem repetição ilimitada nem reativação de descartes. O scheduler registra `sourcesRegistered` além de criação/publicação e motivos de bloqueio. O registro da execução guarda os hashes das páginas e a cadeia de autoridade usada.

## Limites explícitos

- Um link para outro domínio continua exigindo validação da autoria nesse domínio. A descoberta não converte referências externas em autoridade editorial.
- Um monitor pausado ou sem verificação não autoriza cadastro automático.
- Luma exige um calendário de organizador já verificado, correspondência exata do nome e da URL do organizador, evento futuro relevante e inscrição disponível. Agendas genéricas de cidades não comprovam autoria. Nesta versão, o adaptador reaproveitado cobre localidades SP/RJ; demais casos permanecem retidos.
- Não há nova integração com buscadores gerais, dispensa de robots/TLS, preenchimento de formulários, envio de avisos de teste ou aprovação humana de fichas elegíveis.
- O total de fontes pode incluir fontes de uma página/edição específica; não representa o número de instituições diferentes.

As restrições de rede reaproveitam o transporte auditado, em linha com a [orientação de SSRF da OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html). O tratamento de robots permanece no fetcher existente; [robots não comprova autorização editorial](https://www.rfc-editor.org/rfc/rfc9309.html#section-3).

## Validação

- `npm test`: 538 aprovados e 33 ignorados por pré-condições externas/execução explícita, na base integrada ao PR #104. Inclui os testes novos com PGlite e todas as migrações do Radar.
- Testes de cadastro + publicação atômicos, rollback de erro na ficha, fonte desativada, outro domínio sem consulta de rede, link removido, prazo vencido, alteração de autoria durante a consulta, idempotência e escopo exato de URL.
- Regressões da descoberta, do processamento anterior e do adaptador Luma.
- Auditoria real e somente leitura de quatro links do backlog, repetida com o código final às 10h13 de Brasília: `IA na Prática`, da WoMakersCode, com realização em 07/11/2026, qualificou como candidato; os outros três ficaram retidos por informação insuficiente. Isso não equivale a publicação ou cadastro em produção.
- Artefatos locais privados de operação: `.local/source-expansion/live-sample.json` e `.local/source-expansion/live-audit.json`. Contêm apenas os metadados públicos necessários e não integram o commit.
- `npm run lint`, `npm run typegen` e `npm run typecheck`: aprovados.
- `BUILD_STANDALONE=true NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS='--max-old-space-size=3072' npm run build`: aprovado com dependências isoladas no próprio checkout, sem arquivos omitidos do tracing. As dependências existentes foram clonadas com copy-on-write; não houve instalação ou alteração de versões.
- `npm-queue.py --command node ../scripts/security-smoke.mjs radar-academico`: aprovado. Configuração sintética sem credenciais ou banco real; verifica inicialização, health, cabeçalhos, proteção do catálogo/cron e redirecionamento administrativo.

Todos os trabalhos npm passam pela fila global do Mac. Não houve Docker local, instalação de dependências ou encerramento de processos de outros chats.

## Ativação e conferência de produção

Publicação da branch, PR/CI, integração e implantação exigem autorização para o candidato exato. Antes da troca: conferir revisão e checkout da VPS, saúde e inventário dos serviços, backup PostgreSQL validado e revisão de rollback. Não há migração de schema nesta alteração.

Implantar somente o par web/scheduler do Radar pelo runbook Git + SSH. A ativação permite novas gravações de fontes e fichas, portanto precisa incluir essa operação na autorização. O backlog é retomado automaticamente em lotes limitados; não requer reset dos 411 registros nem alteração em massa de sua classificação.

Depois da publicação, conferir revisão dos dois containers, saúde e catálogo público; observar `sourcesRegistered`, `leadsCreated`, `leadsPublished` e motivos, cruzando com as fontes/fichas realmente criadas. A quantidade inicial de links bloqueados não é promessa de crescimento equivalente do catálogo. Em falha, voltar à imagem anterior e preservar os registros criados para avaliação, sem restaurar automaticamente o banco.
