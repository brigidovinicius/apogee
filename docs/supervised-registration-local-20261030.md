# Cadastro supervisionado e privacidade: candidato local de 30/10/2026

## Escopo e decisão de acesso

O usuário confirmou `contato@apogee.community`, Florianópolis e a inclusão de menores de 16 anos. O texto usa Florianópolis/SC, Brasil e o controlador informado: **62.858.706 ROSA MARIA PEREIRA MIRANDA - ME**, CNPJ **62.858.706/0001-46**. A confirmação do usuário não constitui consulta cadastral na Receita Federal nem comprova o funcionamento da caixa postal.

O modelo implementado mantém a conta de acesso em nome de um adulto. Crianças e adolescentes ficam em vínculos privados desse responsável, nas faixas menor de 12, 12–15 e 16–17. Não são criados login, perfil público, acesso ao fórum ou conta Google para o menor. Radar, salvos e Google Agenda continuam na conta e nas permissões do adulto; não há segmentação dos eventos por dependente. Registrar ou aprovar um vínculo não concede acesso pago e não inscreve alguém em uma oportunidade externa.

Com `MEMBERS_SUPERVISED_REGISTRATION_ENABLED=true`, uma conta comum precisa confirmar o e-mail e ter a revisão de maioridade aprovada. A declaração de adulto no cadastro não libera o acesso. Login Google também não substitui essa revisão. O servidor restringe comunidade, calendário, troca de credenciais Google, checkout Radar e envio de foto antes da aprovação. Perfis de contas pendentes ficam indisponíveis para terceiros.

**Impacto da ativação:** contas comuns já existentes também precisarão de revisão. Não há aprovação automática de usuários reais. O harness local aprova somente quatro pares fixos de ID/e-mail fictícios `@radar.test`, com referência explícita de dado simulado. Administradores já autorizados são operadores de confiança e preservam o acesso administrativo.

## Responsável, autorização e revisão

O responsável aprovado pode solicitar um vínculo com apelido, faixa etária, relação pai/mãe ou responsável legal e consentimento específico versionado. O formulário não pede nome completo, CPF, documento, escola ou data exata de nascimento. A solicitação nasce pendente; só a revisão administrativa pode aprová-la. A equipe não recebe documentos por esse formulário.

As ações extraem o ator da sessão. Apenas o responsável vê seus vínculos e pode revogar sua autorização. Outro membro não pode revogar, consultar ou assumir o vínculo. A revogação é imediata no cadastro e uma aprovação reapresentada não a desfaz. Rejeitar a revisão adulta também revoga seus vínculos ativos. O banco e a aplicação registram autorizações, decisões e revogações; aprovação exige data e referência de conferência. O administrador não pode revisar a própria conta nem o próprio dependente.

O painel `/admin/protecao` registra uma decisão humana, após atestação de conferência e referência interna. **Não faz reconhecimento de documentos, aferição automática de idade ou comprovação automática de parentesco.** O envio real do e-mail de verificação e a execução humana dessa conferência não foram certificados por testes de código.

### Procedimento operacional a validar antes de liberar usuários reais

1. Definir um operador autorizado, canal de atendimento seguro e critérios documentados de conferência. Não solicitar documento em fórum, formulário de dependente ou campo de referência.
2. Conferir a identidade e maioridade do titular por mecanismo proporcional e adequado ao risco. E-mail confirmado ou autodeclaração não bastam. Se documentos forem necessários, definir previamente o canal, acesso restrito, base legal e descarte; não anexar imagens ao sistema atual.
3. Para dependentes, conferir faixa etária, identidade e responsabilidade legal do solicitante, assim como a autorização e o melhor interesse do menor. Não tratar um simples clique como comprovação de parentesco.
4. Registrar somente uma referência de atendimento sem CPF, número de documento ou imagem. Registrar a decisão no painel; manter a solicitação pendente quando a prova for insuficiente e orientar o responsável pelo atendimento.
5. Atender revogação e pedidos de acesso/correção/exclusão pelo canal confirmado, com identificação proporcional. Definir retenção dos registros de consentimento, auditoria e backups, responsáveis e prazos. O soft-delete do vínculo não representa eliminação de todos os dados.
6. Revisar o procedimento, o texto e a avaliação de riscos antes da ativação. A implementação desses controles não certifica, por si só, conformidade integral com LGPD/ECA Digital. Contratos de operadores, transferências internacionais e telemetria continuam sujeitos à revisão operacional descrita no relatório anterior.

O Make It Fly continua sendo uma experiência para adultos: formulário e API rejeitam menores de 18 **antes de persistir** a inscrição. Sua faixa de elegibilidade existente 18–35 permanece; a opção de acompanhamento de oportunidades para menores não altera esse requisito.

## Implementação e migração

- Migração `make-it-fly-current/drizzle/0010_supervised_registration.sql`: declaração adulta, revisões, vínculos privados e auditoria. Aplicada somente no PostgreSQL isolado do preview.
- `lib/members/protection.ts`: regras e transações. Páginas e ações `/membros/protecao` e `/admin/protecao`: atendimento e revisão integrados.
- `/privacidade`: identificação e canal preenchidos, regras reais de menores, Google com escopo mínimo e direitos de titulares. A página só se torna pronta fora do preview com o controle supervisionado habilitado; é necessário aplicar a migração antes de ativá-lo.
- Integração externa mantida exclusivamente no Google Agenda, com `calendar.app.created`. Nenhuma credencial da conta fictícia foi transferida para produção.

## Validação executada nesta etapa

Todos os comandos npm/Node de projeto foram serializados pela fila global. O preview foi pausado com autorização já concedida, migrado e reaberto em `http://127.0.0.1:4381`.

| Verificação | Resultado e limite |
| --- | --- |
| Regressão completa do site | **540/540** testes aprovados na execução final |
| Lint | Zero erros; um aviso preexistente sobre imagem em `components/gallery/gallery-admin.tsx` |
| Build do preview e typecheck | Aprovados |
| PostgreSQL local real | **21** verificações de restrições, revisão, isolamento, consentimento, revogação e auditoria aprovadas; fixtures removidas |
| Cadastro HTTP real | Cadastro bruto sem declaração rejeitado sem linha criada; declaração cria conta pendente sem acesso; 19 verificações concluídas antes de corrigir uma expectativa do teste para o `notFound` transmitido por streaming do Next |
| Aceitação HTTP final | **27/27** verificações aprovadas, usando uma única conta sintética pendente isolada; ações reais de revisão administrativa, todas as três faixas, consentimento, acesso entre contas, revogação e replay |
| Google real | Conta vitalícia fictícia sincronizou a agenda secundária **Apogee — TESTE LOCAL**; sem ampliar escopo nem criar eventos pessoais. Criação/atualização/cancelamento reais foram validados na etapa anterior |
| Interface | Conferência visual da política com identificação/contato e do cadastro protegido autenticado como `local_vitalicio` |

A primeira aceitação HTTP precisou adaptar as expectativas de redirect/notFound à resposta de streaming do Next, sem alterar os controles do produto. A última rodada não repetiu o cadastro bruto para não consumir novamente a quota de cadastro; usou fixture isolada e login real. Não houve reset de quotas ou troca de IP. A confirmação de e-mail foi simulada somente para a conta fictícia local; não foi testada entrega de mensagem a usuário real. Os dados de verificação de identidade e parentesco foram explicitamente fictícios.

Evidências privadas locais (não versionadas, sem dados de produção): `.local/radar-calendar/supervised-full-validation.log`, `supervised-http-signup-results.json`, `supervised-http-results.json`, `qa-supervised-http.py`. Teste reproduzível de banco: `make-it-fly-current/scripts/supervised-registration-local-integration.mjs` (valida host/porta/banco/marcador antes de criar e remover somente suas próprias fixtures).

Evidências visuais: `/Users/viniciusbrigido/.codex/visualizations/2026/10/29/01a1879e-bea0-7231-902b-c764c7d6e134/cadastro-protegido-local-3010.png` e `privacidade-identificacao-local-3010.png`. O preview fica aberto, com a conta vitalícia fictícia preservada. O backend Radar não mudou nesta etapa e sua suíte não foi repetida; resultados anteriores não são apresentados como nova execução.

## Situação de produção e próximos gates

Nenhum push, deploy, migração de produção, reinício ou ativação de worker ocorreu nesta etapa. A revisão local inclui como ancestral a revisão publicada `1702dfd45f8fa84aa3a5cb2643e86cc9e15f65a0`; isso evita omitir aquela base, mas não substitui preflight no momento do release.

As configurações OAuth e chaves desativadas já preparadas na etapa anterior estão registradas em `radar-google-only-production-readiness-20261030.md`. O consentimento Google continua em teste e o worker permanente ainda não está rodando em produção. A política HTTPS precisa existir no site publicado antes da conclusão do branding/consentimento para usuários reais.

A liberação depende de procedimento de conferência pronto e autorização explícita do SHA revisado, publicação e migrações necessárias (`0008`, `0009`, `0010`), com backup/restore verificável, plano para contas existentes e ativação do serviço/flags. Respeitar a topologia e serviços do runbook; não alterar DNS, Caddy ou serviços vizinhos. A publicação do consentimento Google é uma configuração externa própria e deve ser confirmada no momento apropriado. Não importar tokens locais para produção.

Após a liberação autorizada, repetir conexão real consentida, salvar/alterar/remover evento fictício em agenda secundária e verificar healthcheck, logs e métricas da fila. O lote padrão de três contas é drenado sequencialmente pelo worker preparado; capacidade de produção e notificações operacionais ainda dependem de observação e de canal de alerta definido.
