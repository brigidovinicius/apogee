# Radar — candidato de conclusão das etapas parciais

Implementação local das etapas 2, 3 e 5, em branch `fix/radar-partials-20261101`, sobre `26251383456dc6faa9ca7d62243e36e0505fea25`. Sem push, publicação, migração de produção ou ativação das recuperações. Etapas 4 e 6 permanecem fora deste pedido.

## Comportamento entregue

- Calendário: combina área, modalidade, UF/cidade, público, tipo, calendário temático, etapa, mês e visualização. Salva até 20 combinações por conta; atualiza por nome e permite remover. Preserva mês/visualização escolhidos. Inscrição encerrada pode continuar exibindo provas e resultados futuros. Filtros não adicionam oportunidades nem eventos automaticamente.
- Acompanhamento recorrente: diretório `/competicoes`, adesão explícita separada por identidade, dupla confirmação por e-mail e cancelamento. Assinaturas anteriores continuam limitadas à edição escolhida. Histórico de identidades explícitas de edição impede repetir aviso após falha/fechamento, reconhece nova edição na mesma ficha e evita anunciar reabertura da edição antiga ou simples enriquecimento de metadados. Edições futuras continuam pendentes até abrir, inclusive com outra edição aberta ou com a ficha fechada. Fichas incompletas só passam ao histórico após qualificação; sem identidade explícita, só uma ficha distinta pode comprovar outra edição. Sem vínculo ativo/verificado, o diretório mostra avisos em preparação e a API recusa adesão. Só uma fonte explicitamente mapeada estabelece que uma ficha é edição daquela competição; portal genérico não serve como vínculo.
- Catálogo: seis recuperações qualificadas, idempotentes e protegidas contra substituição de configuração posterior. Sete fontes continuam dependentes de acesso institucional. Detalhes e limites em `../research/radar-completion-20261101/README.md`.
- Google: fluxo existente preservado, apenas oportunidades escolhidas; calendários criados pelo próprio app. Filtros salvos têm armazenamento separado. Minuta de privacidade atualizada em versão `2026-11-01`; aprovação editorial e liberação pública continuam separadas.

## Validação

Testes executados com Node 22, sequencialmente pela fila global do Mac:

| Verificação | Resultado |
| --- | --- |
| Site completo | 586/586; sem falhas ou skips, incluindo regressão de preflight |
| Preflight Google | 8/8, incluindo exigência da migração 0013 (RED → GREEN) |
| Radar completo | 527 aprovados, 32 ignorados, sem falhas |
| Site e Radar | Lint, tipos e build passaram; um aviso preexistente de imagem em gallery-admin |
| Filtros em PostgreSQL isolado | Persistência, isolamento de contas, atualização por nome, remoção e limite concorrente de 20 passaram |
| Google com PostgreSQL real e provedor simulado | OAuth/PKCE, replay/isolamento, criptografia, idempotência, atualização, cancelamento, retirada/restauração, indisponibilidade, revogação e reconexão passaram |
| Fila Google | Sete conexões, lotes, skip locked e leases passaram |
| Retentativas/monitor | 70 verificações passaram, HTTP local e processos separados de worker/monitor; nenhuma mensagem externa enviada nessa suíte |
| Auditoria externa | Executada explicitamente pelo transporte seguro e vinculada ao pacote por hash |
| Google real | Criação de 3 eventos, mudança de data sem duplicar, retirada de etapa (2), retirada da oportunidade (0), desconexão local |
| E-mail real NASA | Recebido no Gmail autorizado em 01/11 às 08:32:26 BRT; confirmação e cancelamento retornaram 200; assinatura de teste cancelada |

Os 32 skips do Radar são 21 verificações de roles em PostgreSQL externo, nove auditorias externas de descoberta e duas auditorias opt-in de fontes. A auditoria do pacote novo foi executada separadamente com opt-in. PGlite exercitou as migrações e integrações do backend. O banco PostgreSQL de calendário é novo e isolado na porta 48931; nenhum banco anterior foi reutilizado.

Piloto Google real concluído após autorização pessoal. O app criou uma agenda secundária nova: três eventos fictícios; prova alterada de 18 para 19/11 preservando o mesmo ID e sem duplicar; retirada da prova deixou dois eventos; retirada da oportunidade deixou zero eventos. Leitura independente pelo conector Google confirmou cada etapa. Fixture restaurada e conexão local desconectada, sem token persistido. A agenda secundária vazia permanece no Google para remoção pelo usuário. Nenhuma agenda primária nem agenda de teste anterior foi usada.

Navegador interno: login real com conta fictícia, persistência de mês/visualização, alternância A → B → Limpar e diretório passaram. Desktop 1280px sem excesso de largura. Celular 390px encontrou texto de acessibilidade escapando do contêiner da tabela; ajuste de posicionamento aplicado e build repetido com sucesso. Conferência final: largura de página 390px, tabela de 720px contida em área de rolagem de 318px; desktop com largura de página 1280px. Remoção das duas combinações de teste confirmada após navegação. Trata-se de viewport simulado, sem validação em aparelho físico.

## Preparação de implantação, após aprovação

1. Revisar o candidato exato, CI, inventário dos dois serviços e migrações realmente aplicadas. Comprovar backup restaurável de ambos os bancos e registrar imagens/SHA anteriores.
2. Aplicar migração aditiva do site `0013_radar_calendar_filters.sql` antes do novo código; respeitar journal/checksums do Drizzle. O novo calendário lê essa tabela mesmo com Google desabilitado. Preflight exige 0013; não usar somente o inventário antigo 0008–0012.
3. Para Radar, parar temporariamente a coleta/envio durante migração/cutover, aplicar `0048_series_alerts.sql` e iniciar o novo código de web e scheduler juntos. Ela preserva os escopos e consentimentos antigos. Verificar que oito mapeamentos auditados coincidiram sem sobrescrever os existentes.
4. Repetir a auditoria de recuperação com o pacote/código exatos; aplicar apenas as seis recuperações ainda qualificadas se isso estiver no escopo autorizado. Verificar uma coleta normal sem criar fichas ou prazos por suposição.
5. Publicar somente o SHA aprovado. Conferir saúde, versão, calendário, filtros, diretório e processamento de avisos. Inscrição de aviso recorrente é separada da assinatura antiga e exige confirmação própria.
6. Google para usuários reais continua sujeito ao runbook existente de OAuth/privacidade/cadastro supervisionado, worker, receptor de alerta e monitor externo. O piloto local não libera automaticamente produção. Não alterar flags ou aprovações editoriais por inferência.

Rollback: a tabela 0013 é aditiva; voltar código do site preservando a tabela. No Radar, a versão antiga espera `opportunity_id` não nulo: após existir assinatura por série, NÃO voltar somente o binário antigo. Pausar envio/coleta e restaurar conjuntamente backup compatível, ou usar correção progressiva compatível com os dois escopos. Preservar as confirmações/cancelamentos recebidos após backup e reconciliar antes de reativar envio. Não remover a nova coluna/check/tabela como limpeza de rollback.

## Estado final do candidato

Todas as correções apontadas na revisão foram aplicadas e cobertas por regressões reproduzidas antes da correção. A última condição do revisor (primeira metadata com edição futura já pendente) passou na suíte final. Evidências privadas e capturas ficam somente em `.local/radar-completion/`, sem tokens no relatório. Preview temporário e PostgreSQL próprios encerrados, com arquivos preservados; viewport restaurado; fila liberada.

A publicação deve ser revisada separadamente conforme `make-it-fly-current/AGENTS.md`: “nenhuma nova versão, inclusive preview hospedado, seja publicada sem sua autorização explícita após revisão”. O pedido de implementação/testes não alterou essa regra. Google em produção permanece desabilitado; as seis recuperações e as migrações novas continuam não aplicadas.
