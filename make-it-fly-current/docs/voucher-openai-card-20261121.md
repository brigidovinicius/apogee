# Card do voucher OpenAI no padrão de Benefícios

21 de novembro de 2026. Especificação da alteração pedida para o Codex Community Workshop: o resgate dos créditos do ChatGPT fica no topo de Benefícios, com o logo da OpenAI e no mesmo formato das demais ofertas.

Base: `origin/release/home-cards-20261120` (`aa215dc`), a release mais recente e a única linha que contém o voucher. A `main` não contém esse código.

## O que já existe e não muda

O fluxo de vouchers descrito em [workshop-voucher-openai.md](workshop-voucher-openai.md) já cobre o pedido:

- `WorkshopVoucherCard` aparece antes das ofertas em `/membros/beneficios` (`components/benefits/workspace.tsx`) e no catálogo da conta gratuita (`components/benefits/preview-catalogue.tsx`), fora do bloqueio da assinatura anual. Ele só é exibido quando `voucherConfigured()` é verdadeiro.
- O painel `/admin/beneficios/voucher-openai` recebe os links e o CSV de check-in do Luma, fixa o lote na liberação e mantém os links criptografados no banco.
- `/membros/beneficios/voucher-openai` libera o link para a conta com o mesmo e-mail confirmado do ingresso, ou para a conta vinculada pelo código individual.

Não há mudança de banco, rotas, regras de acesso, criptografia, e-mail ou limite de links.

## Alteração

### 1. Card no formato de `BenefitCard`

`components/workshop-voucher/card.tsx` passa a usar a mesma estrutura e as mesmas classes de `components/benefits/benefit-card.tsx`:

| Região | Conteúdo |
|---|---|
| Topo (`offerTop` › `brand` › `brandMeta`) | Parceiro `OpenAI` e selo `Evento · Codex Community Workshop` |
| Corpo (`offerBody`) | Título com `PartnerMark` da OpenAI e o texto “Voucher OpenAI”; descrição curta; bloco “Quem pode resgatar” |
| Rodapé (`offerFooter`) | Validade “Reserva por ordem de check-in” e o link “Acessar meu voucher” para `VOUCHER_PATH` |

Conteúdo dos textos:

- Descrição: “Crédito individual para os primeiros participantes com check-in presencial no workshop.”
- Quem pode resgatar: “Conta Apogee com o mesmo e-mail do ingresso no Luma, ou vinculada pelo código recebido por e-mail.”

O card não recebe `BenefitSaveButton`, porque o voucher não é uma linha de `member_benefit` e salvar falharia. Ele mantém `data-ap-card`, `prefetch={false}` no link e a condição `voucherConfigured()`. O título continua sendo “Voucher OpenAI”, igual ao da página de resgate e coerente com o assunto do e-mail de aviso (“Seu voucher da OpenAI está reservado na Apogee”).

### 2. Logo da OpenAI

Seguindo `docs/sistema-visual.md` (“Em Benefícios, `PartnerMark` usa a marca do parceiro”):

- Arquivo `public/brand/benefits/openai.png`: PNG quadrado de 36×36, gerado a partir do ícone público de `https://openai.com/favicon.ico`.
- Entrada `"OpenAI"` em `content/benefit-brands.json` com `image`, `source` e o `background` (`light` ou `dark`) que preserve o fundo de origem do ícone.

Com a marca cadastrada, `PartnerMark` usa o arquivo local. Se ele falhar, segue a mesma sequência das demais ofertas: serviço de imagens da Apogee e, por último, as iniciais.

### 3. Documentação da operação 45 + 5

Atualizar a seção “Operação na recepção” de `workshop-voucher-openai.md` com a regra deste evento, sem alterar o código:

1. Carregar os 50 links no painel, com os **5 links reservados para a dinâmica nas linhas 46 a 50**. O painel exige exatamente 50 links, e o link de cada linha vai para o e-mail da mesma posição.
2. Pausar o check-in ao completar **45 pessoas distintas**, exportar “Check-in Feito” no Luma e carregar o CSV com 45 e-mails. O painel aceita até 50 e-mails.
3. Conferir os e-mails exibidos e liberar. A liberação fixa o lote: os links 46 a 50 não são atribuídos a ninguém, e a equipe entrega esses 5 diretamente na dinâmica.
4. No cadastro guiado, orientar quem tem Gmail a usar “Entrar com Google” com o mesmo e-mail do Luma, que já chega confirmado. Quem cria conta com senha precisa confirmar o e-mail na página do voucher.

## Fora do escopo

- Aceitar menos de 50 links no sistema.
- Mudar o título, a página de resgate, o e-mail de aviso ou a regra de acesso.
- Executar migração. A `0025_workshop_voucher` já faz parte do fluxo publicado e deve ser conferida no painel antes do evento.

## Validação

- Teste de renderização do card: com `WORKSHOP_VOUCHER_KEY` presente, o HTML contém a marca `/brand/benefits/openai.png`, o parceiro `OpenAI`, o selo do evento e o link para `VOUCHER_PATH`; sem a chave, o card não renderiza.
- `npm run typecheck`, `npm run lint` e `npm run build`.
- `tests/workshop-voucher.integration.mjs`, que continua passando sem alteração de comportamento.
- Conferência visual do catálogo em `/membros/beneficios` e `/beneficios` (conta gratuita), nos temas claro e escuro.

## Publicação

Somente com autorização explícita após revisão. Deploy rotineiro de `web` conforme `docs/apogee-routine-vps-deploy.md`, sem migração. O SHA publicado hoje não foi confirmado daqui: o preflight deve verificar que o checkout remoto está em `aa215dc`, a base desta branch, antes de trocar para o SHA aprovado. Se estiver em outro SHA, parar e reavaliar a base.
