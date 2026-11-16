# Conclusão da oferta Apogee — execução isolada

Autorização: implementação, testes com dados sintéticos e revisão. Sem deploy, migração real ou configuração/cobrança live.

## Base e diagnóstico

- Worktree próprio: `offer-completion-20261115`, branch `feat/offer-completion-20261115`.
- Base: web efetivamente servido `4dfef55ed3c85880c6f4a772ec3262bd2d29316e`; ancestral `b6810ce` preserva Comunidade completa e Loja aprovadas. Integradas ancestralidade de `origin/main` (`4f1d6ad`) e documentação `2bcaa63`, sem substituir o visual por main.
- VPS consultada somente para leitura: checkout limpo `b6810ce`, container `4dfef55`, healthy, zero reinícios, cobrança anual false, lock disponível. Há trabalho editorial de outro chat; esta execução não publica.
- Código existente: autenticação/proteção, consentimentos separados de evento e drops, administração de contatos, cota transacional de dez eventos, preservação legada, checkout anual, conciliação, portal e cancelamento. Validação anterior é histórica; será repetida proporcionalmente no candidato.
- Caixa de Ferramentas coordenada com o chat proprietário após autorização explícita do usuário. Integrados `b2f63d7` e correção `a3a5a4a`, sem editar sua árvore. A prévia anterior foi encerrada pelo proprietário, com autorização específica, preservando seu banco.
- Faltam: catálogos/gestão de Benefícios e Trilha/progresso, quatro destinos internos reais, operação consolidada e evidências finais. Conteúdos e acordos não são presumidos.

## Lotes e arquivos

1. **Base e plano**: este documento; integração Git sem publicação. Aceite: ancestralidade preservada e nenhum arquivo de outro worktree alterado.
2. **Entregas**: `drizzle/0020_member_deliverables.sql`, `lib/deliverables/{validation,store}.ts`, `app/membros/{beneficios,trilha}/`, `app/admin/{beneficios,trilha}/`, componentes internos existentes. Dados: benefício com evidência privada, elegibilidade/disponibilidade/vigência/instruções; trilha/módulo/atividade e conclusão por titular; auditoria mínima sem contatos. Aceite: validação antes de publicar, autorização anual independente do Radar, administração separada, progresso idempotente/privado e estados honestos. Sem parceiros/aulas fictícias. Resgate inicial por instrução/link oficial validado, sem inventar códigos ou integração.
3. **Integração da Caixa de Ferramentas e navegação**: integrar commit revisável, preservar F01–F10 e adaptar os quatro acessos; `components/community/member-offer-overview.tsx`, `components/members/member-bar.tsx`, `components/admin/admin-nav.tsx`. Aceite: destinos existentes, proteção direta/HTML/RSC e direitos antigos inalterados.
4. **Funil e gestão de assinatura**: revisar `components/community/`, `lib/community/`, `lib/store/`, `lib/members/`, `lib/billing/`, rotas relacionadas; corrigir somente lacunas comprovadas. Aceite: persistência de finalidade sem conversão automática; erro recuperável; retorno seguro; confirmação de pagamento exclusiva do servidor.
5. **Migração e ambiente de revisão**: journal, Docker, runner, `scripts/local-offer-review.mjs` e testes. Aceite: banco PostgreSQL novo em loopback, sem `.env`, Stripe bloqueada na prévia comum, email sem envio real; migração aditiva/repetível com preflight; backup/restauração sintéticos e inventário de direitos.
6. **Validação e entrega**: matriz de perfis, integração/concorrência, navegador interno desktop/celular/teclado, lint/tipos/build, revisão do diff, commits e PR; PRDs, mapa de rotas, runbook e pendências reais. Cobrança live continua desativada.

## Matriz de aceite

Visitante; lead; gratuita com 0/9/10 consultas; legado; anual ativo; renovação cancelada no período pago; expirado; reembolsado; administrador; conta bloqueada; tentativa de dados de outro titular. Pagamento não concede administração; legado não concede novos catálogos; catálogo/progresso não consomem cota.

## Dependências do proprietário

Acordos e regras de benefícios; materiais autorizados da Trilha; responsável editorial/suporte; configuração live anual e email/OAuth no ambiente proprietário antes de vender. Perguntas agrupadas enviadas, trabalho independente continua. Se não houver conteúdo confirmado, registros permanecem em preparação e as vendas bloqueadas.

## Execução

Lotes de implementação concluídos em commits próprios; revisão estática corrigiu retenção do formulário após erro e ordenação do próximo passo entre trilhas. Integrações PostgreSQL: 14 anuais, dez da Caixa, nove de entregas; mais seis checks com Better Auth real/email interceptado. Unidade: 791. Sandbox integrado detalhado em `stripe-annual-offer-validation-20261115.md`. O exercício original de três atividades foi preparado apenas para revisão, sem publicação automática. Resultados finais de UI, CI e links estão em `offer-completion-review-20261115.md`.
