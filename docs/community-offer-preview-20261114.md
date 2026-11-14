# Prévia local da oferta Apogee — 14/11/2026

## Estado da entrega

Adequação das páginas ao PRD aprovado, disponível para revisão local. Branch `feat/community-offer-preview-20261114`, a partir do PRD local `7410fed` e da base principal `d6a422d`.

Nenhum push, PR remoto, deploy, migração, cobrança, cadastro real ou envio de mensagem foi realizado nesta etapa.

## Links para revisar

- Home: http://127.0.0.1:3461/
- Comunidade e planos: http://127.0.0.1:3461/comunidade
- Evento gratuito: http://127.0.0.1:3461/evento-openai
- Radar demonstrativo: http://127.0.0.1:3461/oportunidades
- Entrada gratuita demonstrativa: http://127.0.0.1:3461/previa/entrada
- Área de membros demonstrativa: http://127.0.0.1:3461/previa/membros

O servidor atende somente o loopback local. O usuário determinou o uso do navegador interno do Codex para manter o externo livre. A tentativa de controle interno retornou erro de transporte; a abertura pelo painel do Codex foi solicitada e retornou `queued`, sem confirmação visual dessa abertura.

## Mudanças apresentadas

- Home alinhada à proposta de comunidade com Radar, Learn, Perks e Community, mantendo a composição e a identidade existentes.
- Página da comunidade com os quatro pilares, entrada gratuita, assinatura exclusivamente anual e condições de disponibilidade.
- CTAs de entrada com destino próprio, substituindo o diálogo que remetia ao evento.
- Comunicação das 10 consultas de eventos distintos, sem renovação automática e sem consumir outra consulta ao reabrir.
- Retirada do preço avulso do Radar e do checkout automático nos percursos visuais de detalhes bloqueados.
- Preservação do destino do evento no encaminhamento à comunidade e ao cadastro.
- Mensagens e estados de acesso antigo preservado, com apresentação opcional dos demais pilares.
- Prévia da área de membros com acesso aos quatro caminhos, e ajustes na navegação e nos metadados.
- Formulário do evento com validação e confirmação demonstrativa no modo local, sem requisição de cadastro.

Os valores da assinatura continuam apresentados como proposta, com contratação indisponível. Trilhas, créditos, descontos e experiências têm as condições de disponibilidade previstas no PRD; a prévia não atesta contratos de parceiros ou conteúdo já produzido.

## O que é demonstrativo

O modo local é habilitado por `APOGEE_LOCAL_PREVIEW=1` em servidor de desenvolvimento. As rotas `/previa/*` retornam indisponibilidade fora dessa condição; a prévia recebe `X-Robots-Tag: noindex, nofollow`.

O catálogo de eventos da prévia, a conta de entrada, o saldo e a simulação de acesso antigo usam dados ilustrativos. A contagem fica apenas na tela da demonstração. Não representa controle real por conta, persistência entre dispositivos ou migração concluída.

O formulário do evento valida os campos e apresenta uma confirmação local; não envia os dados. A medição de comportamento não é iniciada nesse modo de revisão.

As páginas protegidas reais mantêm autenticação e autorização; a área de membros demonstrativa é uma rota separada e não abre uma sessão real.

## Validações concluídas

- Geração dos tipos de rotas aprovada.
- Typecheck da aplicação aprovado.
- Lint dos arquivos TypeScript alterados aprovado.
- 30 testes focados aprovados: detalhes e direitos do Radar, ausência de checkout automático, finalidade da captura, metadados e seleção de oportunidades da Home.
- `git diff --check` aprovado antes do registro local.
- Interface conferida em 390 px nas seis páginas da prévia; comunidade, evento e Radar também em 320 px; comunidade em 768 px; comunidade, planos e Home em 1440 px. Sem transbordamento horizontal nas conferências registradas.
- Na primeira versão, a alternância mensal/anual foi conferida. A revisão posterior do proprietário substitui essa oferta pela assinatura exclusivamente anual, com total anual em destaque e equivalente mensal informativo.
- Consulta demonstrativa aumenta o saldo uma vez; reabertura mantém o saldo; a 11ª ficha leva à comunidade; eventos liberados continuam abrindo após o limite.
- Simulação de acesso antigo permite continuar sem consumir a cota.
- Formulário vazio apresenta os três erros esperados; envio demonstrativo válido move o foco à confirmação e não cria requisição ao endpoint de contatos.
- Zero erros de console nas navegações observadas. Avisos de pré-carregamento de fontes/CSS e prioridade de imagem apareceram no servidor de desenvolvimento.

Build de produção, validação financeira real e integração de banco não foram executados. O servidor de prévia ocupa a fila global enquanto permanecer aberto; nenhuma tarefa pesada adicional foi iniciada em paralelo.

## Dependências antes de publicar

Esta versão é uma prévia das páginas, não uma ativação completa do modelo comercial. Antes de promover a oferta:

1. Resolver o acesso gratuito às categorias que não são eventos e a integração da oportunidade gratuita já liberada anteriormente, preservando o acesso em qualquer decisão.
2. Implementar e validar a cota de 10 eventos no servidor com persistência por conta, concorrência, reabertura e direitos antigos. O controle funcional atual de uma oportunidade foi preservado nesta etapa.
3. Configurar o ciclo de assinatura e suas permissões após confirmar preços, cobrança, renovação, cancelamento e tratamento de falhas.
4. Encerrar a criação de novas compras avulsas no endpoint e nos links do provedor, preservando histórico, conciliação e compras anteriores ou em processamento. A camada financeira não foi alterada nesta prévia.
5. Confirmar o conteúdo, os benefícios e as atividades disponíveis na contratação, o canal gratuito e os responsáveis pela operação.
6. Validar a versão completa, as condições comerciais e a migração em ambiente isolado; apresentar o resultado para autorização específica de publicação.

A atualização automática de um nível de título em `make-it-fly-current/AGENTS.md`, feita pelo Next em desenvolvimento, foi preservada fora do commit funcional.

## Ambiente local

Worktree utilizado: `/private/tmp/apogee-prd-review-20261114`. Dependências existentes foram reutilizadas por link, com Next 16.4.2; não houve instalação.

Comando do servidor, executado pela fila global:

```sh
APOGEE_LOCAL_PREVIEW=1 /Users/viniciusbrigido/.codex/npm-queue/npm-queue.py --command /opt/homebrew/bin/npm run dev -- --hostname 127.0.0.1 --port 3461
```

O worktree inicialmente criado em Documents apresentou arquivos `dataless` indisponíveis para leitura. Foi preservado; o trabalho efetivo continuou no diretório temporário acima.

## Revisão — assinatura exclusivamente anual

Em 14/11/2026 o proprietário definiu a contratação da comunidade somente no plano anual. A opção mensal e o seletor de periodicidade foram retirados; a entrada gratuita permanece.

A prévia destaca R$ 1.438,80/ano, com o equivalente de R$ 119,90/mês apenas para comparação. O valor continua sendo a referência proposta anteriormente; a forma de pagamento, a renovação e o cancelamento seguem pendentes antes de vender. O PRD registra a decisão em D08 e a FAQ esclarece a periodicidade.

Validação desta revisão: renderização da página no navegador interno, total anual e equivalente mensal visíveis, ausência do seletor mensal e captura atualizada. `git diff --check` aprovado. A alteração de apresentação não exigiu novos testes pesados; o servidor de prévia permanece na fila global. Nenhuma cobrança ou publicação foi ativada.
