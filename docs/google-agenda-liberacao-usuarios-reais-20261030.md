# Google Agenda para usuários reais: situação e plano de liberação

> Atualização posterior, ainda local: [retentativas, quotas e alertas implementados e testados](google-agenda-fila-retentativas-local-20261030.md). A lacuna técnica de espera fixa e transporte de alertas descrita nesta consulta foi tratada no candidato; instalação, destinatário e dimensionamento real de produção continuam pendentes. O inventário de migrações passa a incluir também `0011_google_calendar_retries`.

**Conclusão em 30/10/2026: candidato local validado, produção ainda não liberada.** Esta rodada prepara procedimento e pendências; não autoriza deploy, push, migração, alteração OAuth, mensagens ou coleta de documentos reais.

Código funcional auditado: `82a901c` na branch `feat/radar-calendarios-local-20261029`. [Procedimento de conferência proposto](procedimento-conferencia-responsaveis-20261030.md). [Validação local anterior](supervised-registration-local-20261030.md). [Runbook VPS](apogee-routine-vps-deploy.md).

## 1. Evidência atual e alcance

Consulta SSH somente de leitura em **30/10/2026, aproximadamente 14:38 UTC**: checkout remoto limpo na revisão `1702dfd45f8fa84aa3a5cb2643e86cc9e15f65a0`, web `healthy`, configuração modo `0600`. Nenhum arquivo remoto, dado, serviço ou configuração Google foi alterado nesta consulta.

| Item | Confirmado agora | O que isso não comprova |
| --- | --- | --- |
| Site | Login público `200`; web saudável | Jornada Google Calendar real em produção |
| Política HTTPS | `/privacidade` retorna `404` | Política pública pronta para branding |
| Sincronizador | Endpoint público interno retorna `404`; worker não está rodando | Agendamento permanente ativo |
| Flags remotas | Calendário pessoal `false`; Google `false`; supervisão não definida | Funcionalidades liberadas |
| Credenciais | Par OAuth existente presente; formato da chave de criptografia e comprimento do segredo do worker válidos | Credencial aceita pelo Google, roundtrip de criptografia ou integração completa |
| E-mail | Flags de envio/domínio habilitadas, formato de chave e remetente esperado presentes | Entrega atual na caixa, resposta ao pedido ou revisão humana |

Console Google consultado nesta rodada no projeto **apogee-oauth-local**, compartilhado pelos clientes Local e Produção:

- Cliente **Apogee Produção** contém os callbacks de login e de calendário: `https://www.apogee.community/api/auth/callback/google` e `https://www.apogee.community/api/integracoes/google-agenda/callback`.
- `calendar.app.created` consta nos escopos **não confidenciais**, após recarregar a página. Não há escopos confidenciais/restritos listados nessa tela. Não alterar o escopo de login nem acrescentar acesso à agenda principal.
- Audiência **Externo**, publicação **Testando**, um usuário de teste. **Publicar app** está desabilitado e remete ao branding.
- Branding com nome Apogee e domínio `apogee.community`, mas campos de homepage, privacidade e termos sem URL. A inscrição de um domínio autorizado não comprova sua verificação no Search Console.
- Central de verificação informa dispensa apenas por estar em teste externo. Isso não é aprovação da futura configuração pública.

Os resultados de 540 testes, 21 verificações de banco e 27 de aceitação HTTP pertencem à etapa anterior no candidato funcional. Não foram repetidos nesta rodada documental. A conexão, criação/alteração/cancelamento de eventos reais validados até agora pertencem à agenda secundária de teste, e não a usuários reais de produção.

## 2. Pendências para liberação

| Prioridade | Pendência | Evidência para encerrar | Responsável proposto |
| --- | --- | --- | --- |
| Antes do piloto | Aprovar método de conferência, operador/substituto/revisor, registro restrito e retenção | POP assinado internamente e ensaio com pessoas fictícias; canal de atendimento funcionando | Controlador + operação/privacidade |
| Antes do piloto | Avaliar melhor interesse, riscos, operadores/transferências e texto público | Revisão documentada da LGPD/ECA Digital e dos tratamentos reais | Controlador + assessoria habilitada |
| Antes do piloto | Planejar contas existentes | Titulares avisados, fila/capacidade de revisão, sem aprovações em massa | Produto + operação |
| Antes do piloto | Concluir documentos públicos | Política revisada e termos de uso preparados/revisados; homepage com links correspondentes | Produto + privacidade |
| No release autorizado | Publicar código e migrações necessárias | SHA aprovado, CI aplicável, inventário do banco, backup restaurável, migrações pendentes conferidas e serviços saudáveis | Técnico |
| Após documentos HTTPS acessíveis | Concluir branding/domínio e exigências da Central de verificação | URLs reais sem login, domínio verificado quando exigido e estado confirmado no console | Administrador Google |
| Antes de usuários fora do teste | Publicar audiência OAuth e, quando aplicável, branding/verificação | Estado efetivo **Em produção**, exigências satisfeitas, consentimento real com o escopo esperado | Administrador Google, com confirmação própria |
| No release autorizado | Ativar flags e worker permanente | Mesma imagem/SHA do web e worker, rotas protegidas, heartbeat saudável e fila drenando | Técnico |
| Antes do piloto | Configurar observação e destino de alertas | Responsável/canal definidos; teste de alerta e recuperação, sem credenciais ou identidades no aviso | Operação técnica |
| Após ativação, antes de expansão | Validar conexão e e-mail no ambiente publicado | Nova autorização da própria conta real consentida; entrega confirmada; criar/alterar/cancelar evento fictício em agenda secundária | QA + titular autorizado |
| Antes de liberação geral | Tratar limite de uso e medir capacidade | Retentativa com espera progressiva/aleatoriedade e teste de quota; limites reais do projeto conferidos; volume suportado medido | Técnico |

O POP está preparado para revisão, não aprovado em nome do controlador. O método inicial proposto é presencial sem retenção de documentos; atendimento remoto ainda exige canal e processo aprovados. A conferência humana e sua capacidade são parte da operação que falta, não um resultado que testes automatizados possam certificar.

## 3. Google: configurações específicas

As URLs propostas são a homepage `https://www.apogee.community/`, política `https://www.apogee.community/privacidade` e uma futura página pública de termos ainda a preparar. Não registrar URL inexistente nem afirmar que os termos são opcionais para qualquer configuração pública: a documentação Google atual exige os links para apps externos de produção e a submissão à verificação. A implementação atual não possui rota própria de termos. Conferir os requisitos efetivos da Central de verificação quando o branding estiver completo. [Requisitos oficiais de branding](https://support.google.com/cloud/answer/15549049?hl=en).

Confirmar endereço de suporte selecionável no Google e contato do desenvolvedor monitorados. O e-mail da política não se torna automaticamente uma opção no dropdown de suporte do console. Não criar usuário Google, trocar senha ou ampliar papéis para resolver isso sem escopo específico.

Publicar audiência, publicar branding e verificar escopos são estados distintos. O escopo mínimo consta hoje como não confidencial, mas isso não permite prometer ausência de qualquer revisão da marca ou aprovação automática do Google. O nome do projeto contém “local”, porém a audiência é compartilhada com o cliente de produção; mudanças de publicação podem afetar os dois clientes. Revalidar ambos os logins após qualquer configuração autorizada.

Enquanto o app estiver em teste, o consentimento com Calendar não serve como conexão permanente para o público: há limite de usuários de teste e o refresh token desse fluxo está sujeito a expirar em sete dias. A exceção de login básico não se estende ao escopo de calendário. Mudar para produção não ressuscita tokens inválidos; cada usuário deve conectar/reconectar por seu próprio consentimento. Não copiar tokens da conta fictícia. [Audiência e publicação](https://support.google.com/cloud/answer/15549945?hl=en), [expiração de tokens](https://developers.google.com/identity/protocols/oauth2).

## 4. Produção: sequência para uma execução futura autorizada

1. Concluir as decisões operacionais acima e revisar o candidato. Obter autorização explícita para enviar a branch/SHA e para o release/migrações; não executar esses passos nesta preparação.
2. Repetir preflight: checkout remoto limpo, SHA atual, saúde/capacidade, imagem de rollback e backup/restauração isolada. Inventariar o histórico real do banco antes de aplicar somente migrações pendentes, incluindo `0008_radar_calendar`, `0009_google_calendar` e `0010_supervised_registration`. Esta consulta não leu o journal de produção nem executou SQL; não assume ausência de uma migração só porque sua rota está indisponível.
3. Publicar o candidato aprovado pelo fluxo Git/SSH da VPS. Confirmar a compatibilidade do backend Radar e de suas etapas/fontes com o web; a atualização periódica dos dados de origem é uma dependência distinta do worker Google. Se o backend exigir release/migração, listar e autorizar esse escopo separadamente. Não tocar em DNS, Caddy ou stacks vizinhas.
4. Ativar o controle supervisionado somente com a migração e a operação prontas. Ele bloqueia contas comuns existentes sem aprovação, inclusive a sincronização. Não ligar a flag sem o plano de comunicação e atendimento. A política só se torna disponível fora do preview com essa flag na implementação atual.
5. Verificar política e termos por HTTPS, sem sessão, e seus links na homepage. Então preencher o branding, cumprir a verificação aplicável e publicar audiência/branding com autorização própria. Preservar callbacks e permissões existentes.
6. Conferir o par OAuth efetivo (incluindo fallback do login), origem HTTPS, chave de criptografia, segredo do sincronizador e flags `RADAR_CALENDAR_PERSONAL_ENABLED`/`RADAR_GOOGLE_CALENDAR_ENABLED`. Não imprimir o `.env` nem inserir segredos na linha de comando. Ativar o serviço `google-calendar-sync` no perfil `google-calendar`, usando a mesma imagem/SHA do web. Nenhum agendamento depende do Mac permanecer ligado.
7. Fazer o piloto consentido e acompanhar um ciclo completo. Só expandir após evidência de estabilidade, atendimento e quota. Se houver falha, pausar o worker/funcionalidade pelo plano aprovado e preservar dados, chaves e eventos; rollback de código não desfaz migração automaticamente.

Não há assinatura `.ics` ou integração Mac a publicar; a decisão vigente mantém somente Google Agenda.

## 5. Fila: o que existe e o que ainda falta

Implementado localmente: lote padrão de **três contas**, configurável até 20; lotes sequenciais, nova chamada após um segundo enquanto houver backlog e consulta após 60 segundos quando não houver mais trabalho. Reserva atômica com lease de três minutos, sem processamento paralelo pelo mesmo worker. Sucesso agenda nova consulta da conta em 15 minutos; trabalho parcial em um minuto; falha temporária em cinco minutos. Limites individuais de tempo e até 50 alterações de eventos por passagem evitam prender uma conta indefinidamente.

Isso ainda não é um limite validado de usuários. O código identifica quota e faz uma nova tentativa posterior, mas atualmente usa **espera fixa de cinco minutos**, sem backoff exponencial, aleatoriedade, contador de tentativas ou tratamento específico de `Retry-After`. Antes da expansão, implementar e testar a política de retentativas e conferir quotas por projeto e por usuário no console, sem presumir que sejam as mesmas de exemplos/documentação. Google recomenda backoff exponencial e dispersão de tráfego. [Limites e retentativas oficiais](https://developers.google.com/workspace/calendar/api/guides/quota).

Estimativa inicial de capacidade, não benchmark: para `N` contas vencidas, tempo médio `t` por conta e lote `b`, considerar `N × t + ceil(N/b) × 1 segundo`, além de polling, falhas e novos eventos. O orçamento por chamada pode reduzir o lote efetivo; não aumentar `b` antes de medir. Objetivo proposto para o piloto: drenar o volume normal com folga dentro de 15 minutos, e não apenas no limiar de falha. Definir teto do piloto a partir da medição; ainda não existe número aprovado.

Métricas já implementadas: conexões, contas vencidas, maior atraso, erros, reconexões necessárias, quantidade processada e duração do lote. GET/POST internos exigem Bearer e não expõem identidade. O GET acusa indisponibilidade/configuração ou atraso acima do limite padrão de 900 segundos. Logs JSON e heartbeat do container existem no candidato.

Ainda faltam histórico de métricas, latência p95 por conta, volume de chamadas Google, taxa de sucesso e destinatário de alerta configurados. Duração de lote não é medição exata de duração de cada conta. Healthcheck baseado em atraso não substitui alerta de erro/reconexão: uma fila sem atraso excessivo pode conter contas que precisam de intervenção.

Proposta de operação, a aprovar/configurar:

| Sinal | Ação |
| --- | --- |
| Worker parado, requisição falhando ou heartbeat unhealthy | Aviso ao operador; investigar antes de repetir/ativar múltiplos workers |
| Atraso acima de 900 segundos | Investigar quota, latência, backlog e fonte; avisar recuperação quando normalizar |
| Erros persistentes, quota ou reconexões pendentes | Encaminhamento específico mesmo se o healthcheck ainda estiver verde |
| Catálogo/coletores sem atualização | Acionar coleta/curadoria; Google não descobre sozinho datas oficiais novas |

Propor uma notificação por incidente e outra na recuperação, sem repetir mensagens a cada lote. Não registrar nomes, e-mails, tokens, corpos de erros Google ou URLs privadas. Não enviar alertas a terceiros até canal e destinatário serem autorizados. `restart: unless-stopped` recupera processo encerrado, mas estado unhealthy sozinho não reinicia container.

O tempo total de uma alteração inclui atualização da fonte, aprovação/publicação quando aplicável, próxima sincronização da conta, espera da fila e exibição pelo Google. “15 minutos” é intervalo nominal da conta, não SLA da descoberta da data nem garantia de atualização instantânea na tela do usuário.

## 6. Aceite do piloto real

- Conta adulta e-mail confirmado e aprovada por conferência efetiva; entitlement existente respeitado. Vínculo de menor testado somente com autorização e prova apropriadas, sem documento em logs ou eventos.
- Conexão Google escolhida pelo titular e callback HTTPS concluído; permissão esperada e agenda secundária do Apogee confirmadas, sem convidados nem alteração da agenda principal.
- Salvar oportunidade fictícia, conferir criação, alterar etapa no catálogo de teste autorizado e verificar atualização pelo worker, remover dos salvos e confirmar cancelamento. Repetir passagem sem duplicação. Não modificar uma oportunidade real compartilhada só para ensaiar.
- Desconectar/revogar e reconectar com consentimento; verificar comportamento de erro e recuperação sem reaproveitar token local.
- Demonstrar entrega de e-mail e resposta do atendimento. Não confundir aceitação pelo provedor de envio com recebimento.
- Confirmar que outro usuário não vê vínculo, token ou salvos; endpoints de monitoramento anônimos recusam acesso. Conferir heartbeat, fila, alerta e recuperação. Observar pelo menos um ciclo nominal completo antes da expansão.

## 7. Decisões ainda a cargo da Apogee

Designar equipe de conferência/privacidade; aprovar presencial como método inicial e alternativa remota; aprovar retenção e registro restrito; revisar juridicamente política/termos e riscos; definir destinatário de alertas, teto do piloto e plano para contas existentes. Depois, revisar e autorizar o SHA e cada etapa de produção. Nenhuma dessas decisões foi presumida por este documento.
