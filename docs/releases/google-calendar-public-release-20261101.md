# Google Agenda: candidato para liberação pública

Preparação de 01/11/2026. A publicação e a ativação continuam pendentes de autorização para o candidato exato. Este documento sucede as fotografias anteriores de prontidão; não transforma testes locais em evidência de operação publicada.

## Comportamento preparado

Contas existentes anteriores a um corte UTC fixado uma única vez na ativação mantêm seu acesso anterior enquanto aguardam revisão. O corte não muda a cada reinício. Bloqueios e revisões já concluídas continuam prevalecendo: reapresentar uma solicitação rejeitada não reabre o acesso pela exceção de transição. Nenhuma maioridade é aprovada por script.

Novas contas seguem a conferência existente. A conexão e a sincronização Google exigem e-mail confirmado e aprovação da conta, ou papel administrativo identificado pela equipe. A exceção de transição não concede Google nem novos vínculos de dependentes. OAuth é conferido antes de criar o estado, no callback e dentro da transação de troca de credenciais; a sincronização também confere novamente após obter o bloqueio de execução. Revogar uma revisão interrompe novas chamadas ao Google sem apagar eventos anteriores.

O titular autenticado pode desconectar a integração mesmo enquanto aguarda revisão ou está sem acesso pago. O servidor deriva a identidade da sessão. A interface explica a conferência e oferece o caminho para Cadastro protegido.

A integração mantém as permissões de acesso do Radar. A liberação pública do OAuth não cria acesso gratuito nem altera compras existentes.

## Decisões do responsável

- Vinicius Brígido assumiu a revisão humana e o atendimento do canal principal `contato@apogee.community`.
- Foi escolhida a transição que preserva o acesso existente.
- O endereço pessoal autorizado fica restrito ao suporte exigido no consentimento Google e aos alertas operacionais. Não é incluído no texto público do site nem neste repositório.
- O procedimento presencial sem cópias de documentos e as demais decisões operacionais do [POP-RESP-01](../procedimento-conferencia-responsaveis-20261030.md) permanecem sujeitos à revisão do responsável. A designação não é prova de treinamento ou de conferência de uma pessoa real. Divergências e casos sem evidência continuam pendentes, sem aprovação improvisada.

Os [documentos completos para revisão](google-calendar-documents-review-20261101.md) refletem a transição e preservam o contato principal e as condições de compras existentes. Ambas as versões editoriais são `2026-11-01.2`. A aprovação editorial não é certificação jurídica nem aceite de contratos em nome de usuários.

## Constatações atuais do console Google

Consulta somente de leitura no projeto `apogee-oauth-local`:

- Audiência externa em teste; publicação ainda bloqueada por branding incompleto.
- Escopo `https://www.googleapis.com/auth/calendar.app.created` na seção de escopos não confidenciais; nenhuma linha nas seções confidencial ou restrita.
- Cliente de produção com os callbacks `https://www.apogee.community/api/auth/callback/google` e `https://www.apogee.community/api/integracoes/google-agenda/callback`.
- Calendar API ativada, com cotas de 10.000 consultas/minuto no projeto e 600 consultas/minuto/usuário. Limite de quota não é capacidade de membros medida.
- Homepage, privacidade e termos ainda precisam ser gravados após as rotas públicas existirem por HTTPS. Domínio autorizado não comprova, por si só, propriedade ou aprovação de marca. A exigência de verificação deve ser novamente lida após completar o branding.

Essas constatações não comprovam audiência em produção, marca aprovada ou OAuth real no site publicado.

## Operação e alertas preparados

O worker usa a mesma imagem e revisão do site, com lotes sequenciais e limites existentes. Nenhum serviço vizinho, rede, Caddy, DNS ou banco do ALU integra o escopo.

O novo workflow `google-calendar-monitor.yml` executa o monitor fora da VPS, com consulta somente de leitura. Fica desativado até configurar `APOGEE_GOOGLE_CALENDAR_MONITOR_ENABLED=true`. Recebe apenas uma credencial de leitura distinta da de sincronização, uma chave Resend dedicada apenas a envio no domínio e o destinatário autorizado, todos como secrets. Não recebe banco, OAuth, chave de criptografia ou credencial de sincronização.

O envio usa remetente fixo `contato@apogee.community`. Alertas contêm apenas razões técnicas e métricas agregadas. Estado e fila pendente são persistidos como artifact entre execuções; a origem do artifact é limitada ao mesmo workflow, repositório, branch main e eventos de operação. Falhas de restauração não reiniciam silenciosamente a deduplicação. Abertura e recuperação são comunicadas uma vez no funcionamento normal, com retentativas e chave de idempotência estável. Falha pendente de entrega torna a execução avulsa malsucedida mesmo após a recuperação do alvo.

O agendamento de cinco minutos é de melhor esforço: o GitHub pode atrasar execuções e desativar agendas de repositórios públicos após 60 dias sem atividade. O operador deve acompanhar falhas do workflow e sua continuidade. Interrupção do runner ou falha ao salvar o artifact pode exigir reconciliação e pode repetir um aviso; não há promessa de entrega exatamente uma vez ou SLA. [Documentação oficial do GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule).

## Implantação proposta, ainda não executada

1. Obter aprovação das versões editoriais, do plano operacional e do candidato exato para push, PR, merge, deploy e configuração Google. Não há migração nova neste candidato.
2. Revalidar a main e a VPS, inventariar migrações e saúde, fazer backup restaurável e registrar rollback. Se outro candidato tiver sido publicado, preservar suas mudanças e validar novamente qualquer conflito antes de publicar.
3. Publicar o site no SHA aprovado com supervisão ativa, corte fixado no instante da ativação e documentos aprovados. Manter a integração Google desativada nesta primeira passagem e verificar o acesso existente, as rotas legais públicas e a disponibilidade.
4. Completar o branding com homepage `https://www.apogee.community/`, privacidade `/privacidade`, termos `/termos`, domínio e contatos autorizados. Publicar audiência/branding conforme as exigências efetivas do Google. Não ampliar escopos ou alterar callbacks de login.
5. Criar credenciais operacionais restritas, ativar Google no mesmo SHA, iniciar apenas web e worker necessários e habilitar o monitor externo. Verificar autenticação de leitura/escrita, heartbeat, fila e persistência de estado.
6. Fazer nova autorização consentida da conta piloto no domínio publicado. Não transportar credenciais locais. Conferir criação de agenda secundária, etapas dos salvos, repetição sem duplicatas, remoção/cancelamento, desconexão e reconexão. Atualizações de data e cenários de revogação são também verificados de forma isolada, sem alterar datas verdadeiras do catálogo.
7. Executar um incidente e uma recuperação controlados do monitor com destino somente ao operador autorizado; comprovar recebimento, deduplicação e repetição após reinício. A aceitação do Resend não prova entrega na caixa.
8. Medir amostra real de sincronizações e capacidade antes de declarar atendimento amplo. Registrar limites e pendências efetivos. Alertas não autorizam novas mensagens aos membros, coleta de documentos em canal novo ou alterações em ofertas.

## Validação

- Suíte final: **607/607 testes** do site, sem falhas ou testes ignorados, executados por Node 22 e pela fila global.
- Build e typecheck aprovados após as correções; lint sem erros, com um aviso preexistente de imagem na galeria. O último teste de interface também recebeu lint focado.
- **29 verificações com PostgreSQL real isolado** para proteção e transição, incluindo uma corrida de revogação reproduzida antes da correção e aprovada depois: a autorização aguarda o bloqueio do revisor e relê a situação após o commit.
- Fluxo OAuth/sync completo em PostgreSQL isolado com HTTP Google simulado: estado, PKCE, replay, isolamento de conta, criptografia, criação, repetição, atualização de data, cancelamento, remoção/restauração, indisponibilidade, revogação, desconexão e reconexão. A revogação após iniciar OAuth impede a troca de credenciais.
- **70 verificações adicionais** de fila, retentativas, monitor independente, falhas, recuperação, deduplicação e capacidade sintética; PostgreSQL e HTTP de loopback reais. Nenhum alerta externo foi enviado por esses testes.
- Revisão estática independente concluída; os dois achados foram corrigidos e reconferidos, sem outro P1/P2 concreto remanescente nesse escopo.
- Navegador interno: termos e privacidade acessíveis sem sessão no preview, versão exata, aviso de minuta, `noindex`, links entre as páginas e contato principal. O e-mail pessoal de suporte Google não aparece no texto do site. O preview não tinha concessões Google ativas.

O commit que contém este relatório identifica o candidato local; o SHA exato também acompanha a solicitação de autorização. Evidências privadas ficam em `.local/google-release-20261101/` e não devem ser publicadas com configurações ou dados pessoais. O preflight continua sem poder autorizar release e mantém pendentes os passos que só podem ser comprovados depois da implantação. Não houve push, merge, deploy, alteração de flags em produção, publicação de audiência Google ou novo OAuth de produção nesta preparação.
