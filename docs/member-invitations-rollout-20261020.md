# Convites de membros e administradores — publicação

Implementação integrada na [PR #71](https://github.com/brigidovinicius/apogee/pull/71) e publicada na VPS em 20/10/2026, revisão `28747e8f74700f9ce5f33771ceca08bf645720f8`. Este registro público contém somente o resumo operacional. Capturas de produção e snapshots de contas permanecem sob custódia local, sem inclusão nesta publicação.

## Comportamento entregue

- Convites de membro e administrador com tokens aleatórios armazenados somente como hash, prazo de validade, revogação, rotação no reenvio e aceitação transacional.
- Aceitação exige sessão do destinatário, mesmo e-mail verificado e confirmação por POST. Abrir o link ou verificar o e-mail não concede papel administrativo.
- Administradores ativos podem convidar membros. Convites administrativos exigem a permissão adicional `can_manage_admins`, que não é herdada pelo convidado.
- Nomes validados nas escritas e exibidos como texto, sem interpretação de conteúdo ativo.
- Administrador principal e remetente de e-mail são configurações independentes. A conta principal autorizada mantém a permissão adicional; o remetente vem de `MEMBERS_RESEND_FROM` e não precisa ter papel administrativo na aplicação.

## Validação

O [CI funcional 39364174093](https://github.com/brigidovinicius/apogee/actions/runs/39364174093) aprovou os quatro jobs. O site passou em 309 testes; convites em 16 testes integrados; migração e armazenamento em um teste integrado PostgreSQL. Tipos, lint, auditoria de dependências de execução, builds e smokes passaram. O lint do site manteve um aviso preexistente de `<img>`.

Os testes locais e de CI cobriram a aceitação de convites administrativos, concessão do papel, acesso ao painel, consumo único e não herança da permissão adicional. A autenticação real contra banco descartável também validou o Radar.

Em produção, foram confirmados envio e recebimento real de convites de membro e administrador em caixa controlada, links HTTPS da aplicação, verificação nativa do e-mail e recusa de acesso ao painel antes da aceitação. A promoção da conta de validação e o acesso administrativo positivo por essa conta **não foram executados em produção**. A conta de validação permaneceu como membro, os três convites de teste foram revogados e não restaram convites pendentes para essa caixa.

As [verificações HTTP públicas](evidence/member-invitations/deploy-public-smoke.json) confirmaram `200` no site, cadastro, login e convite sem token; `307` para login na administração sem sessão; e `401` na API de convites sem sessão. A API não permite cache. A página de convite informa link indisponível para token ausente e inclui a política de referência no HTML.

## Operação

A migração aditiva `0004_member_invitations` foi executada após autorização explícita, por executor restrito e transacional que verifica o histórico completo. A repetição retornou `changed:false`. O backup protegido foi restaurado em PostgreSQL temporário sem rede ou portas antes da migração.

O envio foi ativado reutilizando a credencial do provedor somente dentro da VPS, sem incluí-la em código ou logs. O arquivo de ambiente manteve modo `0600`. A permissão adicional foi concedida somente à conta principal autorizada.

Somente o serviço web da Apogee foi reconstruído e recriado. A verificação de encerramento confirmou web saudável, zero reinícios e a revisão publicada acima. Os outros 12 containers preservaram ID, imagem e horário de início durante o deploy; DNS, Caddy, certificados, volumes e redes não foram alterados.

O rollback de código permanece na revisão `72162980db2655329b3f7dd1a9ef1e6a7a4b79d3`, mantendo as tabelas e colunas aditivas. Os backups e o ambiente anterior protegido permanecem na VPS. Para execução, seguir o [runbook de deploy](apogee-routine-vps-deploy.md). Esta atualização documental não exige novo deploy da aplicação.
