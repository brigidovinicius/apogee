# Google Agenda — implementação e validação local (29/10/2026)

## Escopo e estado

Implementada a conexão direta do calendário pessoal com a API Google Calendar. A conexão é opcional e separada do login Better Auth. Sem deploy, push ou mudança do cliente OAuth de produção. Após autorização explícita, a conta Google do usuário foi conectada à conta fictícia vitalícia e os testes reais escreveram somente na agenda secundária “Apogee — TESTE LOCAL”, criada pelo produto.

**Conexão Google e testes reais concluídos.** O navegador confirmou o projeto `apogee-oauth-local`, com clientes distintos “Apogee Local” e “Apogee Produção”. O cliente local termina em `earocvt248dibbrmp00cmfamh2qcs6qa.apps.googleusercontent.com`. Após autorização explícita, a API Calendar foi ativada e o retorno do Agenda em 127.0.0.1:4381 foi acrescentado somente a esse cliente, preservando o retorno de login antigo. O cliente “Apogee Produção” não foi editado. A chave original foi localizada em configuração privada anterior do Apogee, conferida pelo ID local e sufixo mascarado do console, e copiada somente para o arquivo privado do harness. Nenhuma chave nova foi criada.

## Comportamento entregue

- Botão de conexão, estado da conexão, última sincronização, atualização manual e desconexão em Meu calendário.
- Permissão solicitada: `https://www.googleapis.com/auth/calendar.app.created`. Cria uma agenda secundária “Apogee — oportunidades”; no preview, “Apogee — TESTE LOCAL”.
- Inclui apenas etapas das oportunidades salvas. Alterações atualizam os mesmos eventos; remoções cancelam eventos; salvar novamente restaura com uma nova revisão estável.
- Eventos de dia inteiro têm final exclusivo, conforme o formato Google. Um horário sem duração positiva vira marcador de um minuto explicitamente descrito, sem inventar a duração real da etapa.
- Sincronização em um sentido: Radar → Google. Edições feitas manualmente no Google não retornam ao catálogo.
- Assinatura privada ICS existente preservada.
- Desconectar apaga o refresh token local, interrompe atualizações e mantém a agenda já criada. Não revoga o cliente OAuth compartilhado, pois isso poderia interromper o login Google.
- As ações usam a identidade da sessão, mantêm o acesso comercial atual e o job verifica o direito de acesso/bloqueio. Calendário principal e IDs arbitrários fornecidos pelo navegador não são aceitos.

## Persistência e segurança

Migração `0009_google_calendar`: conexão, tentativa OAuth e mapa de eventos. Aplicada somente ao PostgreSQL marcado do ambiente local (127.0.0.1:48763 / apogee_radar_calendar_local).

OAuth usa state aleatório vinculado a cookie HttpOnly/SameSite=Lax, hash no banco, validade de dez minutos, PKCE S256 e callback associado à sessão. O refresh token e o verificador PKCE usam AES-256-GCM, com chave privada e vínculo ao usuário. Credenciais ficam no servidor; respostas de erro não expõem tokens. Callback usa no-store/no-referrer e está excluído dos logs de requisições de desenvolvimento.

As sincronizações da mesma conexão são serializadas. IDs estáveis recuperam conflitos após respostas parciais; mapas das operações concluídas são preservados em falhas de API. Falhas de catálogo nunca são tratadas como remoção de todos os eventos. Quota/indisponibilidade ficam pendentes para nova tentativa; invalid_grant exige reconectar.

## Execução periódica

Após salvar/remover, uma sincronização é enfileirada e executada após a resposta. O endpoint POST `/api/internal/google-agenda/sync` processa até três conexões vencidas por chamada sequencialmente e exige Bearer secreto com pelo menos 32 caracteres. Cada conexão limita operações e tempo por rodada; normalmente atualiza a cada quinze minutos, retomando lotes incompletos.

O harness local chama esse endpoint a cada minuto, somente quando configurado. **Não foi instalado agendamento nem alterada infraestrutura em produção.** Antes de futura publicação autorizada, será necessário configurar o job no ambiente de destino; habilitar apenas a interface não garante atualizações periódicas.

## Configuração local e etapas de validação

1. Concluído mediante autorização: ativação da Google Calendar API no projeto existente (o projeto também contém o cliente de produção).
2. Concluído no cliente **Apogee Local**, preservando o retorno de login existente:
   `http://127.0.0.1:4381/api/integracoes/google-agenda/callback`.
3. Concluído: recuperada a chave original local sem exposição no chat. Configuração gravada com modo 0600; nenhuma geração/rotação foi necessária.
4. Para futura reconfiguração a partir de um JSON privado, usar a fila:
   `python3 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command node scripts/google-calendar-local-configure.mjs /caminho/privado/cliente.json`.
   O script aceita exclusivamente o ID local verificado, grava configuração 0600 em `.local/radar-calendar/google-calendar.json` e preserva a chave de criptografia entre execuções. O arquivo fica fora do Git.
5. Preview reiniciado com a conexão habilitada; conta fictícia `local_vitalicio` autenticada no Chrome. O usuário autorizou expressamente a conexão da conta Google, os testes fictícios e a continuação no aviso de aplicativo em teste ainda não verificado. O consentimento final mostrou somente criação de agendas secundárias e gestão de eventos nelas.
6. Criação, atualização, cancelamento e restauração confirmados no Google real; calendários pessoais preservados.

O harness recusa credenciais do cliente de produção. O login Google segue desativado neste preview; a conexão do Agenda usa seu próprio par de variáveis.

## Validações

- 37 testes direcionados aprovados: Google Calendar, calendário/ICS, ciclo de vida, formulário editorial e gestão.
- Integração com PostgreSQL local real e driver Drizzle: estado OAuth, PKCE, isolamento entre contas, replay, criptografia, criação, idempotência, atualização de datas, cancelamentos, remoção/restauração, falha de catálogo, perda de direito, desconexão/reconexão e revogação da autorização Google.
- Na suíte automatizada, somente as respostas HTTP Google foram simuladas. A validação real adicional abaixo foi feita pelo produto e conferida com o conector Google Calendar em modo de leitura.
- Geração de rotas Next e TypeScript aprovados. Lint sem erros, com um aviso anterior de `<img>` em `components/gallery/gallery-admin.tsx`.
- Build local final aprovado. Preview integrado reaberto em 127.0.0.1:4381; a interface mostra Google Agenda conectado, com última sincronização e controles de atualização/desconexão. O Chrome está autenticado como local_vitalicio; a sessão do navegador integrado não foi encerrada.
- OAuth real concluído: refresh token persistido criptografado, calendário criado e sincronizações posteriores executadas com renovação do acesso.

- Smoke HTTP do preview: job sem Bearer retorna 401; callback anônimo retorna 303 para a mensagem de acesso, sem códigos na URL de destino e com Cache-Control no-store.

## Validação real concluída

Oportunidade exclusivamente local: `radar-demo-google-sync-20261029`, título “QA Google 29-10 — Olimpíada fictícia”. Todas as gravações Google foram feitas pelo código do produto, sem escrita pelo conector; o conector foi usado somente para leitura independente.

| Cenário | Resultado observado |
| --- | --- |
| Salvar pelo botão da oportunidade | Dois eventos confirmados: prova em 03/11/2026, 14h–15h de Brasília, e resultado de dia inteiro em 05/11, com final exclusivo em 06/11 |
| Alterar prova no catálogo local | Sincronizador periódico mudou a prova para 04/11, 16h–17h, mantendo o mesmo ID; permaneceram exatamente dois eventos ativos |
| Remover apenas a etapa de resultado | Botão “Sincronizar agora” produziu `status=cancelled` no evento do resultado; prova preservada |
| Remover a oportunidade dos salvos | Evento da prova passou a `status=cancelled` no Google |
| Restaurar as etapas e salvar novamente | Exatamente dois eventos confirmados com novas revisões; os eventos anteriores continuaram cancelados |

Para validar o job periódico sem aguardar quinze minutos, o vencimento da conexão de teste foi antecipado apenas no PostgreSQL local. A atualização foi executada automaticamente pelo timer do harness, sem chamada manual de sincronização nessa etapa. Não foi alterado o intervalo do produto.

O conector retorna os horários com offset de Los Angeles; os instantes foram comparados em UTC e a interface Google aberta com `ctz=America/Sao_Paulo`, confirmando 16h–17h em Brasília. O link para a oportunidade apareceu completo na interface Google. Sem convidados ou notificações.

Estado final deixado para o usuário: Google conectado à conta fictícia vitalícia, oportunidade QA salva, dois eventos fictícios ativos (prova 04/11, 16h–17h; resultado 05/11, dia inteiro), preview local funcionando. A conexão periódica depende do preview permanecer em execução. Nenhuma agenda principal foi usada.

Evidências locais privadas na pasta de visualizações desta tarefa: `google-calendar-real-evidence.json`, `google-evento-inicial.png`, `google-evento-final.png` e `google-agenda-conectado-final.png`. As capturas do evento foram limitadas ao diálogo de teste para não mostrar compromissos pessoais. Nenhum token, cookie ou chave foi incluído no relatório ou no Git.
