# Medição de comportamento — site inteiro e Radar

Pedido: medir comportamento sem armazenar dados sensíveis. Escopo confirmado em 08/11/2026: site inteiro e Radar.

## Contrato e implementação

- Categorias de página, navegação, rolagem 25/50/75/100%, tempo visível em marcos 15/30/60s, seções do Make It Fly, uso dos filtros, ações principais do Radar/loja e abertura da inscrição externa. O formulário próprio legado tem adaptador para etapas, caso volte a ser utilizado; a rota atual contém Google Forms e não expõe seus passos internos ao coletor.
- Vocabulário fechado em `make-it-fly-current/lib/behavior-contract.ts`, validado no navegador, no servidor e por constraints no PostgreSQL. Eventos com campos extras ou texto livre são rejeitados por inteiro antes da persistência.
- As requisições não incluem cookies nem Referer. Não há UUID, conta, sessão, identificação de oportunidade/produto/artigo, URL completa, parâmetros, origem da visita, localização, user-agent, resposta, nome de campo ou mensagem de erro nos eventos.
- O banco recebe somente incrementos por dia/categoria/evento/marco/dispositivo. Não existe uma tabela com eventos individuais. Horário de Brasília; não há timestamp de cliente.
- Escolha explícita: coleta começa após permitir; recusa ou retirada descarta a fila. A escolha pode ser alterada. Somente `allow`/`deny` é guardado no navegador. DNT/GPC interrompem a coleta no cliente e no servidor. O cabeçalho de escolha é uma declaração do cliente, não prova de identidade ou consentimento individual.
- IP validado da borda é usado só para limite em memória por dez minutos, por hash com segredo efêmero. Não vai para banco/planilha/log desta implementação. Logs de infraestrutura e dados operacionais de autenticação/pagamento continuam sendo domínios separados e precisam de suas próprias regras.
- Admin, callbacks, redefinição com token, convites, perfis, conteúdo de fórum, links portadores de segredo e rotas desconhecidas não são medidos. Categorias cobrem os fluxos do site, não conteúdo pessoal de cada tela.
- Ações significam intenção, não confirmação de compra, pagamento, salvamento ou entrega de e-mail. O formulário distingue envio iniciado, confirmado e sem confirmação. Contagens não são pessoas únicas, sessões, atribuição de campanhas ou conversão individual. Medição best effort, sem reenvio que possa duplicar contagens.
- `/admin/comportamento` exige autorização no DAL e mostra até 500 combinações dos últimos 30 dias, com estados vazios/desativado/indisponível reais.

## Encerramento do modelo anterior

`/api/journey` passa a responder 410 sem acessar serviços. O adaptador do formulário transmite somente categorias fixas ao novo coletor; não transmite o contexto recebido. Abas antigas mantêm o cálculo HMAC v1 para retries idempotentes, usando o ID legado apenas nesse cálculo; ele não é escrito na coluna de jornada. Inscrições novas não persistem `journey_id`. O receptor Apps Script preparado deixa de aceitar `journey_events`. Os registros e vínculos antigos em Supabase/planilhas não são alterados ou apagados por este trabalho.

## Arquivos e validação planejada

Contrato/coletor: `lib/behavior-contract.ts`, `lib/behavior.ts`, `app/api/behavior/route.ts`. Cliente/escolha: `components/analytics/`. Instrumentação: componentes de oportunidades, formulário Make It Fly, loja e acesso Radar. Persistência: SQL separado `sql/behavior-daily.sql`. Relatório: `lib/admin/behavior.ts`, `app/admin/comportamento/page.tsx` e navegação admin.

Testar: bloqueio pré-escolha/recusa/DNT/GPC; payload com valores pessoais inclusive após troca de nomes; tokens em rotas/query; recusa após enfileirar; indisponibilidade de storage/rede/banco; limites de corpo/lote; atomicidade e concorrência dos incrementos; autorização antes de consultas; formulário sem vínculo; endpoint e Sheets antigos sem escrita. Executar testes, typecheck/lint e build sequencialmente na fila npm.

## Ativação e histórico

Padrão: `APOGEE_BEHAVIOR_ENABLED` ausente/false, sem coleta ou interface de escolha. Uma publicação do código não é ativação automática.

Para ativar, revisar o candidato e obter autorização específica de publicação e banco. Aplicar somente `make-it-fly-current/sql/behavior-daily.sql` no banco certo, confirmar backup/esquema e conceder SELECT/INSERT/UPDATE/DELETE exclusivamente ao papel privado do serviço web (confirmar o papel real; não conceder a anon/authenticated ou PUBLIC). Não inserir esta migração no journal geral para evitar aplicar migrações alheias. O script não realiza grants para papéis ainda não verificados.

Revisar o aviso/política antes de ativar, pois o texto aprovado atual ainda descreve associação de jornada com inscrição. Proposta de texto: “Se você permitir a medição de uso, somamos visitas por categoria de página, cliques, rolagem, marcos de tempo e etapas de fluxos. Não copiamos o que você digita nem associamos essas contagens à conta ou à inscrição. Você pode recusar ou alterar a escolha em Preferências de medição. Sinais de recusa do navegador desativam a medição.” O documento publicado e sua versão de aprovação não são alterados neste candidato.

Depois configurar `APOGEE_BEHAVIOR_ENABLED=true`, validar em navegador com dados sintéticos que não há chamadas antes de permitir, que a recusa interrompe chamadas, e que cookies/Referer/conteúdo de formulários não são enviados. Atualizar o Apps Script exige uma publicação separada; sua versão remota atual não foi modificada.

Retenção: a escrita exclui agregados anteriores aos últimos 90 dias. Sem tráfego, não existe execução de limpeza; para prazo independente do tráfego, agendar a mesma exclusão em rotina autorizada do banco. Consultas admin abrangem apenas 30 dias. Dados antigos do modelo individual requerem análise e autorização próprias para eventual exclusão/desvinculação, incluindo backups e planilhas. Não importar esse histórico para a nova tabela.

O formulário Google Forms atual é de outra origem: medimos a página hospedeira e o clique de abertura. Não observamos nem instrumentamos respostas, etapas, conclusão ou pixels dentro do iframe. As proteções no formulário/API próprios legados não significam que esse formulário esteja em uso na rota pública.

Referências técnicas: [Next.js usePathname](https://nextjs.org/docs/app/api-reference/functions/use-pathname), [W3C GPC](https://www.w3.org/TR/gpc/), e documentação da versão Next instalada lida antes de alterar código. GPC é tratado como recusa de medição por decisão do produto; isto não é uma conclusão sobre bases legais.

## Resultado

Validação local em 08/11/2026:

- Suíte completa: `npm test` — 666/666 aprovados; após os ajustes finais de abertura externa e teste do checkout, 109/109 testes afetados aprovados.
- `npm run typecheck` aprovado; a compilação também verifica os tipos.
- Lint dos novos módulos e integrações principais aprovado; `git diff --check` sem erros.
- `scripts/test-behavior-postgres.mjs`: cinco verificações aprovadas em banco temporário sem TCP, sem leitura de DATABASE_URL/.env: incrementos concorrentes, atomicidade/constraints, retenção de 90 dias e colunas sem identificação, abertura externa e ausência de acesso público. O processo de teste foi encerrado; artefato preservado em `/var/folders/c4/8pl0mxxs3kq329jkg3n3jr8h0000gn/T/apogee-behavior-test-jdtIHU`.
- Revisão independente de código concluída. Corrigidos fingerprint de retries anteriores e captura do checkout automático. Segunda revisão confirmou as correções e nenhum achado adicional.
- Build final aprovado: `APOGEE_LOCAL_PREVIEW=1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 npm run build` — compilação e TypeScript concluídos.
- `scripts/test-behavior-browser.mjs` concluído no Chrome com servidor temporário da compilação de produção. O teste intercepta analytics e bloqueia POSTs de negócio e todas as origens externas. Comprova escolha/recusa/retirada/GPC, clique sintético de salvar no Radar, abertura do Google Forms, interesse na loja, texto digitado fora dos eventos, ausência de cookies/Referer e limites da caixa em desktop/celular. Não cria conta, inscrição, salvamento, pagamento ou envio real. O Google Forms não é carregado no teste.
- Artefatos de navegador em `make-it-fly-current/outputs/behavior-validation/`: `browser-events.json` (4 lotes, 15 eventos sintéticos), `desktop-consent.png` (1280×800), `mobile-consent.png` (390×844), `preview.log`. A gravação do JSON ocorre somente após todas as asserções. Capturas conferidas visualmente. O servidor e o navegador temporários foram encerrados; fila vazia após a execução.
- `BEHAVIOR_PLAYWRIGHT_MODULE` aponta somente no teste para o módulo Playwright já instalado pelo conector. Nenhuma dependência foi instalada para esta tarefa.

Todos os comandos pesados foram executados sequencialmente pela fila FIFO. Sem push, publicação, migração em produção ou coleta de pessoas reais.
