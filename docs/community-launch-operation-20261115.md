# Operação, implantação e ativação da Comunidade

Documento revisável. Não autoriza publicação, migração real, envio ou cobrança. O executor único de release do outro chat tem autorização/evidências próprias; não duplicar seu trabalho. A hospedagem é exclusivamente Git + SSH na VPS.

## Responsáveis e dependências comerciais

| Frente | Responsável atual comprovado | Falta confirmar antes de vender |
| --- | --- | --- |
| Decisões de produto/preço/conteúdo | Vinicius, proprietário | Aceite concreto da oferta e do conteúdo. |
| Radar/Ferramentas | Não designado nesta revisão | Operador editorial; conferir links mensalmente e quando houver relato. Não inventar gratuidade, licenças ou parceria. |
| Trilha | Não designado | Revisão do exercício original e módulo real acessível; definir manutenção do conteúdo parcial. |
| Benefícios | Não designado | Acordo, parceiro, prova privada, elegibilidade, disponibilidade, vigência e procedimento real. Se exigir código/capacidade por conta, implementar controle mínimo antes de anunciar. |
| Convivência/moderação | Não designado | Canal gratuito real aprovado, relação com conta/fórum, regras de entrada, operador e agenda confirmada. |
| Suporte/cobrança | Não designado | Confirmar atendimento real de `contato@apogee.community`; portal, pedidos de reembolso e falhas. Sem SLA presumido. |
| Orientações do evento | Não designado | Destino/conteúdo de acesso efetivos e operador; cadastro não é reserva/vaga/acesso. |
| Indicadores | Não designado | Rotina de relatório, inventário das contas de teste e definições/cobertura de conversão/ativação/retorno. |

O pedido desta revisão não forneceu acordos nem aprovou o exercício. À pergunta editorial, o proprietário respondeu que ainda não sabia do que se tratava. Apresentar o texto completo; não tratar essa resposta como aprovação. Q01/Q02 não estão abertas.

## Procedimentos e modelos (nenhum envio executado)

1. **Evento:** consultar `/admin/comunidade`, conferir a finalidade e a data original. Não unir à conta por email. Antes do envio operacional autorizado, verificar orientação real e destino do evento. Registrar acompanhamento no ambiente privado já usado pelo operador: data, finalidade, estado (`pendente`, `orientado`, `falha`, `interrompido`), ator e referência da entrega. Sem conteúdo da resposta em analytics. Ausência de operador/destino bloqueia conclusão desse percurso.
2. **Drops:** usar somente `/admin/loja/drops` e a finalidade dos drops. Repetição não elimina consentimento original. Interesse não é estoque, compra, reserva ou assinatura. Não importar contatos do evento.
3. **Suporte:** canal descoberto sem login em `/membros/suporte`. Pedir apenas informação proporcional à questão. Nunca senha, código de autenticação, token ou cartão completo. Confirmação de identidade não deve revelar se outro email possui conta. Encaminhar conta, pagamento, benefício, conteúdo/link ou dados ao operador designado.
4. **Interrupção/dados:** receber no canal previsto na política; conferir identidade proporcionalmente; interromper a finalidade solicitada no processo do operador e registrar evidência privada. Não apagar o consentimento original para simular ausência de pedido. Não iniciar nova campanha promocional.
5. **Cobrança:** antes de qualquer concessão, consultar a fatura/assinatura canônica e vínculo da conta. Recuperar webhook pelo Workbench ou `/admin/assinaturas`, sem marcar fatura paga manualmente ou abrir nova assinatura. Reembolso/disputa/risco seguem a regra documentada; marcador de risco exige revisão operacional.

Modelos para revisão, sem destinatário preenchido:

> **Pedido do evento recebido:** Seu pedido de orientações foi registrado. Isso não confirma vaga, envio automático ou acesso ao evento. A Apogee enviará as orientações quando o conteúdo e o destino estiverem confirmados pelo responsável. Para ajuda ou interrupção deste aviso, use contato@apogee.community.

> **Orientação do evento:** Você pediu informações sobre o evento Codex Community. [Inserir somente instrução e destino confirmados pelo operador.] Este aviso atende ao pedido específico e não cria conta ou assinatura. Para interrompê-lo, responda ao canal atendido ou escreva para contato@apogee.community.

> **Boas-vindas após pagamento canônico:** Seu acesso anual está confirmado na área de assinatura. Na área de membros você encontra os recursos disponíveis, a Trilha parcial e suporte. Comece por um módulo publicado e confira o entregável antes de marcar conclusão. A licença de uma ferramenta de terceiros segue as condições do fornecedor.

> **Continuidade opcional:** Volte à sua atividade em andamento ou escolha uma oportunidade disponível no Radar; confira requisitos, prazo e próximo passo. Este modelo só pode ser enviado se houver autorização correspondente. Não cadastrar automaticamente assinantes em campanhas.

> **Pagamento pendente:** O retorno do checkout não confirma pagamento. Confira o estado na área de assinatura e atualize após alguns instantes. Havendo dificuldade, use o suporte antes de iniciar outra contratação.

Textos com colchetes não são mensagens prontas para envio. Não incluir o convite à oferta em aviso do evento sem autorização promocional própria e forma real de interrompê-la. Nenhum modelo confirma entrega à caixa de entrada.

## Gate de futura liberação

1. Escolher **SHA concreto aprovado**, verificar CI/build e árvore, checkout remoto limpo e imagem real. Não inferir imagem pelo Git. Usar `docs/apogee-routine-vps-deploy.md`; nenhuma ação em ALU, DNS, Caddy, redes ou outros serviços.
2. Inventariar journal/hashes/ordem e fingerprints de legado, compras, escolha anterior, cota, assinaturas/faturas e contatos. Backup privado com checksum e restauração em ambiente isolado com papéis/permissões compatíveis; não baixar dados reais para a prévia.
3. Ensaiar com a imagem exata: preflight, aplicação e repetição de 0019/0020 (se ainda pendentes). Recusar deriva, papel incorreto ou esquema parcial; nunca forçar journal. Comparar inventário antes/depois. Migrações não publicam exercício ou conteúdo de teste.
4. Com autorização específica, migrar antes da troca do web quando o código depende do novo schema. Preservar runtime/configuração e executar somente o serviço Apogee necessário. Há release coordenada que pode já ter cumprido esse passo; conferir antes de repetir.
5. Publicar somente conteúdo editorial aprovado e manifesto privado conferido; preflight/hash/repetição conforme `toolbox-curation-runbook-20261115.md`. Sem licença/crédito de fornecedor presumidos. Benefícios e Trilha sem conteúdo aprovado continuam indisponíveis.
6. A consulta operacional a `/domains` retornou `restricted_api_key`, compatível com chave de envio sem permissão de listar domínios; não ampliar escopo nem inferir falha de envio. Conferir email no provedor: domínio/remetente, entrega transacional autorizada, links, expiração e callbacks. Flag/chave não provam recebimento. Conferir audiência Google e callback no ambiente proprietário; não publicar consentimento Google por conta própria.
7. Após Gate 2 e autorização própria, preparar Stripe live na conta correta: produto, preço 143880 BRL/year/1, chave/modo, portal sem mudança de plano e webhook assinado; nunca reutilizar IDs test. Preservar configuração legada do Radar. Nenhuma dessas operações foi autorizada neste chat.
8. Smoke sem cobrança, observabilidade, acesso administrativo e suporte; revisão concreta do proprietário. Só então autorização específica de ativação de novas vendas. Nunca usar compra real automática como teste.

## Pausa e rollback

- `COMMUNITY_BILLING_ENABLED=false` impede apenas novos checkouts. **Manter** modo/chave/segredo/produto/preço/portal dos contratos existentes. Checkout test/live já aberto pode terminar depois da pausa; webhook deve conciliá-lo.
- Portal, cancelamento, suporte, conciliação, reembolsos e direito pago continuam operacionais. Configuração parcial gera erro recuperável, não ACK silencioso. Ver `community-sales-pause-20261115.md`.
- Pausar novas vendas se houver falha comprovada de liberação, cobrança/duplicação, conciliação, suporte ou entregável anunciado. Registrar incidente e recuperar canonicamente, sem criar nova cobrança.
- Voltar somente o código/imagem para revisão compatível que preserve esta semântica. Não voltar cegamente para versão que descarta webhooks anuais ao pausar, se já houver contratos.
- Preservar tabelas aditivas, direitos e registros novos. Não executar migração reversa, restauração ampla, DROP ou limpeza de contatos/cota para corrigir interface.
- Registrar SHA de saída/retorno, imagem, saúde, filas de webhook e responsável pelo acompanhamento. Testar restauração somente no ambiente isolado.
