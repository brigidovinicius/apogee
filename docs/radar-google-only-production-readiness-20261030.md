# Google Agenda exclusivo: preparação de produção e privacidade

Decisão de 30/10/2026: manter o calendário pessoal do Radar e somente Google Agenda como integração externa. A assinatura `.ics` foi retirada da interface, das ações de geração de tokens, da rota pública e dos módulos de exportação. Migrações históricas e dados existentes foram preservados; não houve exclusão de tabelas de usuários.

## Sincronização e capacidade

O serviço permanente `google-calendar-sync` foi adicionado ao Compose do site, com perfil `google-calendar`, reinício automático, execução sem root na imagem do site, filesystem somente de leitura e limites de 128 MB/0,25 CPU. Recebe apenas o segredo de sincronização e a origem interna do site; não recebe credenciais OAuth ou de banco.

O limite de três contas passa a ser um tamanho de lote, não o limite de processamento por minuto. Enquanto houver contas vencidas, o worker solicita o próximo lote após um segundo. Quando a fila termina, consulta novamente após um minuto. Não executa chamadas sobrepostas no mesmo processo.

Cada conexão é reservada atomicamente com `FOR UPDATE SKIP LOCKED` e lease de três minutos. Isso evita reservas concorrentes da mesma conexão por workers periódicos; se um processo morrer, a conexão volta a ficar elegível após o lease. O fluxo existente de salvar/remover continua disparando sincronização, e a transação por conexão serializa operações concorrentes. Falhas isoladas não interrompem as demais contas do lote.

Configurações no processo web:

| Variável | Padrão | Limite |
| --- | --- | --- |
| `GOOGLE_CALENDAR_SYNC_BATCH_SIZE` | 3 conexões | 1–20 |
| `GOOGLE_CALENDAR_SYNC_BUDGET_SECONDS` | 90 segundos por chamada | 1–120 |
| `GOOGLE_CALENDAR_SYNC_MAX_LAG_SECONDS` | 900 segundos de atraso tolerado | 1–86400 |

O orçamento é verificado antes de reservar cada conexão. Uma sincronização individual em andamento pode usar seu tempo próprio antes do encerramento do lote. O worker tem timeout de 170 segundos, abaixo do limite de 180 segundos do endpoint. Os intervalos existentes por conexão continuam em 15 minutos para sucesso, um minuto para lotes de eventos incompletos e cinco minutos para falhas temporárias.

Não foi prometida uma quantidade fixa de usuários a cada quinze minutos. A capacidade real depende do tempo de renovação OAuth, número de eventos alterados e quotas Google. Para dimensionar, acompanhar tempo médio/p95 por conta, quantidade de conexões e atraso mais antigo; o objetivo operacional é concluir a fila antes do próximo ciclo das conexões. O teste de sete conexões comprova reservas e drenagem, não é um benchmark de latência da API Google em escala.

## Monitoramento

- `GET /api/internal/google-agenda/sync`, protegido pelo mesmo Bearer privado, retorna apenas agregados: conexões, pendências vencidas, maior atraso, erros e reconexões necessárias. Não expõe contas, e-mails ou tokens. Retorna `503` quando o recurso não está configurado ou o atraso supera o limite.
- `POST` continua processando lotes e retorna métricas, quantidade processada e duração.
- O worker gera logs JSON com componente, horário, situação, tamanho da fila, atraso, erros e duração; não registra headers de autorização nem corpos de erro do provedor.
- Healthcheck local ao container verifica heartbeat recente e saudável. Heartbeat vencido, falha de chamada e excesso de atraso tornam o container unhealthy. `restart: unless-stopped` reinicia processos que terminarem; estado unhealthy, sozinho, não provoca reinício pelo Docker Compose.
- Não foi configurado envio de alertas a terceiros. Destinatário/canal de notificações operacionais deve ser definido separadamente. Reconexões e erros são visíveis nas métricas mesmo quando não há atraso excessivo.

## Configuração externa realizada

Preflight remoto somente de leitura: site saudável, checkout limpo e revisão `1702dfd45f8fa84aa3a5cb2643e86cc9e15f65a0`. Essa revisão ainda não tem as rotas do calendário nem os arquivos de migração `0008_radar_calendar.sql` e `0009_google_calendar.sql`.

A pedido do usuário, foram preparadas duas chaves privadas novas no arquivo de configuração da VPS: criptografia das credenciais e autenticação do sincronizador. Arquivo e backup têm modo `0600`. Backup anterior: `.env.before-google-calendar-20261030T133057Z`, SHA-256 `2e95d5ec08349cb855fbf6008d401f194f626bb99d55430d2a6775ef6b584c2b`. Valores privados não foram trazidos para o Git ou exibidos. O cliente existente de login de produção permanece disponível como fallback; não houve rotação dessa credencial.

As flags de calendário foram preparadas como `false`, sem reiniciar o site. O worker não foi iniciado em produção, pois sua rota ainda não existe na revisão publicada.

No projeto Google `apogee-oauth-local`, após confirmações específicas do usuário:

- Cliente **Apogee Produção** recebeu `https://www.apogee.community/api/integracoes/google-agenda/callback`.
- Callback de login `https://www.apogee.community/api/auth/callback/google` foi preservado.
- Escopo `https://www.googleapis.com/auth/calendar.app.created` foi salvo em **Acesso a dados**, classificado pelo console como não confidencial. Não foram adicionados escopos de acesso à agenda principal.
- O consentimento permanece **Testando**. O botão **Publicar app** está bloqueado pelo cadastro incompleto de branding: homepage, política e informações públicas precisam ser concluídas com URLs válidas. A publicação do consentimento é uma etapa própria, não foi inferida da gravação do escopo.

Uma tentativa anterior de aplicar o escopo foi rejeitada pela revisão automática por falta de confirmação específica no momento da alteração. O usuário autorizou expressamente a aplicação e gravação em seguida; o console confirmou a gravação.

## Minuta da política de privacidade

Página local `/privacidade`, com link no rodapé do site e na seção Google Agenda. Controlador informado pelo usuário: **62.858.706 ROSA MARIA PEREIRA MIRANDA - ME**, CNPJ **62.858.706/0001-46**. Os dígitos verificadores foram conferidos; isso não substitui confirmação cadastral na Receita Federal.

A minuta cobre os tratamentos observados no código: autenticação e sessões, perfis/fórum, inscrições e avaliação automática de critérios, pagamentos, telemetria de navegação do Make It Fly, provedores, sincronização Google, retenção, direitos, incidentes e menores. Não promete que desconectar exclui eventos no Google ou cópias de segurança. Não presume que todo tratamento exige consentimento nem aplica o prazo de quinze dias indistintamente a todos os direitos.

O texto é uma minuta, não uma certificação de conformidade integral. Enquanto o contato de privacidade e a política etária não forem confirmados, a página fica acessível apenas no preview local, com aviso de revisão e `noindex`; em runtime de produção, retorna `404`. A identidade do controlador é registrada em `lib/privacy-policy.ts`, sem inventar endereço, responsável nomeado ou caixa de atendimento operacional.

Pendências para a política e a operação:

1. Confirmar cidade/UF e o e-mail que realmente receberá solicitações de privacidade.
2. Definir público etário e implementar as proteções necessárias antes de oferecer cadastro a menores. O código atual não tem fluxo próprio de aferição de idade/vínculo parental. A mera redação da política não implementa isso.
3. Registrar prazos de retenção por categoria e o procedimento de atendimento/exclusão, inclusive backups e registros legais.
4. Confirmar localização/contratos dos operadores e mecanismo aplicável às transferências internacionais. Não foi presumida a existência de cláusulas ANPD já assinadas.
5. Avaliar e documentar a base legal da telemetria, proporcionalidade e mecanismo de oposição/preferências. O respeito a Do Not Track existente não foi apresentado como consentimento nem anonimização.
6. Revisar juridicamente o texto e os tratamentos antes de sua publicação definitiva, com atenção à LGPD, ao ECA Digital e às regras de dados das APIs Google.

Fontes oficiais consultadas em 30/10/2026: [LGPD atualizada](https://www2.camara.leg.br/legin/fed/lei/2018/lei-13709-14-agosto-2018-787077-normaatualizada-pl.html), [ANPD: direitos e bases legais](https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes), [ANPD: menores](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes), [ECA Digital](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/), [transferência internacional](https://www.gov.br/anpd/pt-br/assuntos/assuntos-internacionais/transferencia-internacional-de-dados), [dados das APIs Google](https://developers.google.com/terms/api-services-user-data-policy).

## Ativação pendente de release

Depois de revisar o candidato e concluir a política pública: backup/restore do banco de membros, autorização e aplicação das migrações necessárias, publicação do SHA aprovado pelo fluxo Git/SSH da VPS, configuração do branding/consentimento com a política HTTPS válida, ativação das duas flags de calendário e inicialização explícita de `google-calendar-sync` com a mesma imagem/SHA do web. Não iniciar o profile `public`, recriar Caddy ou alterar serviços vizinhos.

Após a liberação, validar conexão real de uma conta autorizada, salvar/alterar/remover um evento, verificar os logs e o healthcheck do worker e consultar as métricas autenticadas sem registrar o Bearer. A credencial Google da conta local fictícia não deve ser transferida para contas reais de produção.

Até aqui, nenhuma versão foi publicada, nenhum container de produção foi reiniciado e nenhuma migração de produção foi executada. As alterações remotas se restringem ao preparo das chaves/flags desativadas e às configurações OAuth autorizadas acima.

## Validação local concluída

- Regressão completa do site: **534/534** testes na revisão final.
- Lint: zero erros, um aviso preexistente de imagem em `components/gallery/gallery-admin.tsx`.
- Build do preview e typecheck: aprovados. Um build com configuração standalone também passou antes da inclusão da minuta; não foi construído nem iniciado Docker local.
- PostgreSQL local real: sete conexões sintéticas consumidas em lotes 3+3+1, sem tocar nas conexões existentes. Reserva de outra conexão enquanto a mais antiga estava bloqueada validada no banco. Tabela exclusiva de teste removida ao final.
- Regressão de OAuth/Google com PostgreSQL real e respostas Google simuladas: state/PKCE, replay, isolamento de conta, criptografia, criação, idempotência, atualização, cancelamento parcial, remover/restaurar, falhas, perda de acesso e reconexão aprovados.
- **Google real**, somente agenda **Apogee — TESTE LOCAL**: novo evento sintético `radar-demo-google-only-sync-20261030` salvo pela aplicação, alterado para 10/11/2026 das 15h às 16h BRT e atualizado pelo endpoint da fila; leitura independente no Google confirmou o horário e o ID. Remoção pelos salvos cancelou o evento, confirmada por leitura independente. Conta vitalícia local e exemplo anterior preservados.
- Dez verificações HTTP da versão Google exclusiva: ausência da assinatura, link ICS anterior `404`, monitor GET/POST anônimo `401`, métricas autenticadas, salvar, sincronizar e cancelar aprovados. Fila final sem pendências e sem erros.
- Política: HTTP local `200`, identificação confirmada, aviso de minuta, `noindex` e link na homepage. Teste verifica que a minuta incompleta retorna `404` fora do preview e não pode ser indexada. Conferência visual da página realizada no navegador.

Resultados privados em `.local/radar-calendar/`: `google-privacy-regression-final.log`, `google-privacy-final-validation.log`, `google-only-http-results.jsonl` e `qa-google-only-http.py`. Evidências visuais em `/Users/viniciusbrigido/.codex/visualizations/2026/10/29/01a1879e-bea0-7231-902b-c764c7d6e134/`: `google-prod-callback-salvo-3010.png`, `google-escopo-minimo-salvo-3010.png` e `privacidade-minuta-local-3010.png`.

O preview foi reaberto ao final, com a conta vitalícia preservada, e a minuta ficou aberta no navegador. A suíte do backend Radar não foi repetida nesta rodada, pois seu código não foi alterado.
